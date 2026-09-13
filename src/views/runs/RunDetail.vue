<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTimeseries } from '@/api/metrics'
import { listRuns } from '@/api/runs'
import type { Run, TimeseriesPoint } from '@/types/api'
import { echarts, type EChartsType } from '@/utils/echarts'
import { formatDateTime } from '@/utils/format'
import { isRunActive, runStatusTagType, runStatusText } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const projectId = Number(route.params.projectId)
const runNo = route.params.runNo as string

const chartRef = ref<HTMLDivElement>()
let chart: EChartsType | null = null
let timer: number | null = null

const run = ref<Run | null>(null)
const loading = ref(false)

const metricTabs = [
  { key: 'tps', label: 'TPS' },
  { key: 'avg_rt', label: '平均响应时间(ms)' },
  { key: 'error_rate', label: '错误率(%)' },
]
const activeMetric = ref<'tps' | 'avg_rt' | 'error_rate'>('tps')

const fetchRun = async () => {
  // runs 无详情端点：用列表里的字段组装
  try {
    const res = await listRuns(projectId, 1, 1000)
    run.value = res.items.find((r) => r.run_no === runNo) || null
  } catch {
    // 拦截器已弹 ElMessage
  }
}

const render = (rows: TimeseriesPoint[]) => {
  if (!chart) return
  const labels = [...new Set(rows.map((r) => r.label))]
  const valueOf = (r: TimeseriesPoint) => {
    if (activeMetric.value === 'tps') return r.tps
    if (activeMetric.value === 'avg_rt') return r.avg_rt
    return r.error_rate
  }
  const series = labels.map((label) => ({
    name: label,
    type: 'line',
    smooth: true,
    showSymbol: false,
    data: rows
      .filter((r) => r.label === label)
      .map((r) => [r.ts * 1000, valueOf(r)]),
  }))
  chart.setOption(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: labels, type: 'scroll', bottom: 0 },
      grid: { left: 50, right: 20, top: 30, bottom: 60 },
      xAxis: { type: 'time' },
      yAxis: {
        type: 'value',
        name: metricTabs.find((m) => m.key === activeMetric.value)?.label,
      },
      series,
    },
    { notMerge: true },
  )
}

// 运行中（pending/running/stopping）视为活跃，滚动查自场景开始时间起的全程；终态查一次全程
// naive ISO（如 "2026-09-08T13:16:10"，北京墙钟）按浏览器本地时区解析为绝对 epoch
const toEpoch = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : Math.floor(t / 1000)
}

const buildWindow = (): { start: number; end: number } => {
  const now = Math.floor(Date.now() / 1000)
  const startTs = toEpoch(run.value?.start_time)
  // 运行中：start=场景开始时间（提前 60s 余量），end=now 滚动展示全程；
  // start 缺失（run 信息未取到）时退化为最近 5 分钟
  if (isRunActive(run.value?.status)) {
    return { start: startTs !== null ? startTs - 60 : now - 300, end: now }
  }
  if (startTs === null) {
    return { start: now - 300, end: now }
  }
  const endTs = toEpoch(run.value?.end_time) ?? now
  return { start: startTs - 60, end: endTs + 60 } // 终态：全程（前后各留 1 分钟余量）
}

const poll = async () => {
  const { start, end } = buildWindow()
  try {
    const rows = await getTimeseries(runNo, start, end)
    render(rows)
  } catch {
    // 拦截器已弹 ElMessage
  }
}

let tickCount = 0
const startPolling = () => {
  timer = window.setInterval(async () => {
    await poll()
    // 每 60s 刷新一次 run 状态；翻终态后停止轮询并按全程窗口补查一次
    tickCount += 1
    if (tickCount % 12 === 0) {
      await fetchRun()
      if (!isRunActive(run.value?.status) && timer) {
        clearInterval(timer)
        timer = null
        await poll()
      }
    }
  }, 5000)
}

const handleMetricChange = () => poll()

onMounted(async () => {
  loading.value = true
  await fetchRun()
  loading.value = false
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    await poll()
    // 仅运行中轮询；终态 run 查一次全程即可
    if (isRunActive(run.value?.status)) startPolling()
  }
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  chart?.dispose()
  chart = null
})
</script>

<template>
  <el-card v-loading="loading">
    <template #header>
      <div class="header">
        <div class="header__left">
          <el-button link @click="router.back()">← 返回</el-button>
          <span class="header__title">运行 {{ runNo }}</span>
          <el-tag v-if="run" :type="runStatusTagType(run.status)">{{ runStatusText(run.status) }}</el-tag>
        </div>
      </div>
    </template>

    <el-descriptions v-if="run" :column="3" border class="info">
      <el-descriptions-item label="Run No">{{ run.run_no }}</el-descriptions-item>
      <el-descriptions-item label="场景">scenario #{{ run.scenario_id }}</el-descriptions-item>
      <el-descriptions-item label="触发方式">{{ run.trigger }}</el-descriptions-item>
      <el-descriptions-item label="Agent">{{ run.agent_ids?.length || 0 }} 台</el-descriptions-item>
      <el-descriptions-item label="开始时间">{{ formatDateTime(run.start_time) }}</el-descriptions-item>
      <el-descriptions-item label="结束时间">{{ formatDateTime(run.end_time) }}</el-descriptions-item>
      <el-descriptions-item label="错误信息" :span="3">{{ run.error_message || '-' }}</el-descriptions-item>
    </el-descriptions>

    <el-tabs v-model="activeMetric" @tab-change="handleMetricChange" class="tabs">
      <el-tab-pane
        v-for="m in metricTabs"
        :key="m.key"
        :label="m.label"
        :name="m.key"
      />
    </el-tabs>

    <div ref="chartRef" class="chart" />
  </el-card>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  &__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  &__title {
    font-size: 16px;
    font-weight: 600;
  }
}
.info {
  margin-bottom: 16px;
}
.tabs {
  margin-bottom: 8px;
}
.chart {
  height: 420px;
}
</style>
