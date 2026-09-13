<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getTimeseries } from '@/api/metrics'
import { getRun, stopRun } from '@/api/runs'
import type { Run, TimeseriesPoint } from '@/types/api'
import { echarts, type EChartsType } from '@/utils/echarts'
import { formatDateTime } from '@/utils/format'
import { isRunActive, isRunStoppable, runStatusTagType, runStatusText } from '@/utils/status'

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

// ---- 查询条件区：统计类型 + 时间范围 ----
// '' = 全部（不传 sample_type，后端返回含 request/transaction 两类点）
const statType = ref<'' | 'transaction' | 'request'>('')
const timeRange = ref<[Date, Date] | null>(null)

const canStop = computed(() => !!run.value && isRunStoppable(run.value.status))
const stopping = ref(false)
const querying = ref(false)

const fetchRun = async () => {
  // 调用执行记录详情接口，直接按 run_no 取单条（2003/3022 由拦截器处理）
  try {
    run.value = await getRun(projectId, runNo)
  } catch {
    // 拦截器已弹 ElMessage
  }
}

const SAMPLE_TYPE_TEXT: Record<string, string> = { request: '请求', transaction: '事务' }

const render = (rows: TimeseriesPoint[]) => {
  if (!chart) return
  // 全部模式下同 label 会有 request/transaction 两类点，序列名带类型后缀区分；
  // 指定统计类型时后端只返回单类点，直接用 label
  const seriesKeyOf = (r: TimeseriesPoint) =>
    statType.value === ''
      ? `${r.label}（${SAMPLE_TYPE_TEXT[r.sample_type ?? ''] ?? r.sample_type ?? '全部'}）`
      : r.label
  const keys = [...new Set(rows.map(seriesKeyOf))]
  const valueOf = (r: TimeseriesPoint) => {
    if (activeMetric.value === 'tps') return r.tps
    if (activeMetric.value === 'avg_rt') return r.avg_rt
    return r.error_rate
  }
  const series = keys.map((key) => ({
    name: key,
    type: 'line',
    smooth: true,
    showSymbol: false,
    data: rows
      .filter((r) => seriesKeyOf(r) === key)
      .map((r) => [r.ts * 1000, valueOf(r)]),
  }))
  chart.setOption(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: keys, type: 'scroll', bottom: 0 },
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
  // 已选时间范围优先（查询条件区）；未选时按 run 状态自动推窗
  if (timeRange.value) {
    const [s, e] = timeRange.value
    const start = Math.floor(new Date(s).getTime() / 1000)
    const end = Math.floor(new Date(e).getTime() / 1000)
    if (!Number.isNaN(start) && !Number.isNaN(end)) return { start, end }
  }
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
    const rows = await getTimeseries(
      runNo,
      start,
      end,
      15,
      statType.value || undefined, // '' = 全部，不传 sample_type
    )
    render(rows)
  } catch {
    // 拦截器已弹 ElMessage
  }
}

const handleQuery = async () => {
  querying.value = true
  try {
    await poll()
  } finally {
    querying.value = false
  }
}

const handleStop = async () => {
  stopping.value = true
  try {
    await stopRun(projectId, runNo)
    ElMessage.success('停止指令已下发')
    await fetchRun()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    stopping.value = false
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

    <div class="toolbar">
      <div class="toolbar__item">
        <span class="toolbar__label">统计类型</span>
        <el-radio-group v-model="statType" @change="poll">
          <el-radio value="">全部</el-radio>
          <el-radio value="transaction">事务</el-radio>
          <el-radio value="request">请求</el-radio>
        </el-radio-group>
      </div>
      <div class="toolbar__item">
        <span class="toolbar__label">时间范围</span>
        <el-date-picker
          v-model="timeRange"
          type="datetimerange"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          :clearable="true"
        />
      </div>
      <div class="toolbar__actions">
        <el-button
          type="danger"
          :disabled="!canStop"
          :loading="stopping"
          @click="handleStop"
        >
          停止场景
        </el-button>
        <el-button type="primary" :loading="querying" @click="handleQuery">查询</el-button>
      </div>
    </div>

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
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__label {
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
  &__actions {
    margin-left: auto;
    display: flex;
    gap: 12px;
  }
}
.tabs {
  margin-bottom: 8px;
}
.chart {
  height: 420px;
}
</style>
