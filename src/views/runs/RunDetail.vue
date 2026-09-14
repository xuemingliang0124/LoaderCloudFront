<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getTimeseries } from '@/api/metrics'
import { getRun, getRunRealtimeSummary, getRunSummary, stopRun } from '@/api/runs'
import type { Run, RunSummary, RunSummaryByLabel, RunSummaryResponse, TimeseriesPoint } from '@/types/api'
import { echarts, type EChartsType } from '@/utils/echarts'
import { formatDateTime, formatNumber, formatPercent } from '@/utils/format'
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

// 汇总结果与三个指标曲线平级；默认进入页面展示汇总结果
const tabs = [
  { key: 'summary', label: '汇总结果' },
  { key: 'tps', label: 'TPS' },
  { key: 'avg_rt', label: '平均响应时间(ms)' },
  { key: 'error_rate', label: '错误率(%)' },
]
const activeTab = ref<'summary' | 'tps' | 'avg_rt' | 'error_rate'>('summary')
const isSummaryTab = computed(() => activeTab.value === 'summary')

// ---- 查询条件区：统计类型 + 时间范围 ----
// '' = 全部（不传 sample_type，后端返回含 request/transaction 两类点）
const statType = ref<'' | 'transaction' | 'request'>('')
const timeRange = ref<[Date, Date] | null>(null)

const canStop = computed(() => !!run.value && isRunStoppable(run.value.status))
const stopping = ref(false)
const querying = ref(false)

// ---- 测试结果汇总 ----
// 终态：summaryData（含 agents/artifacts 等外层包装）；运行中：realtimeSummary（仅全程聚合 + by_label）
// 运行中实时刷新 realtime-summary（5s 粒度，p95 为近似值），翻终态后切换为 summary（精确值）
const summaryData = ref<RunSummaryResponse | null>(null)
const realtimeSummary = ref<RunSummary | null>(null)
const summaryLoading = ref(false)
const fetchSummary = async () => {
  summaryLoading.value = true
  try {
    if (isRunActive(run.value?.status)) {
      // 运行中：调 realtime-summary（不抛 2004，p95 近似、avg_tps 窗口口径）
      realtimeSummary.value = await getRunRealtimeSummary(runNo)
      summaryData.value = null
    } else {
      // 终态：调 summary（精确值，含 agents/artifacts 外层包装）
      summaryData.value = await getRunSummary(runNo)
      realtimeSummary.value = null
    }
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    summaryLoading.value = false
  }
}

// 展示用统一入口：运行中取 realtimeSummary，终态取 summaryData.summary
const displaySummary = computed<RunSummary | null>(() => {
  if (realtimeSummary.value) return realtimeSummary.value
  return summaryData.value?.summary ?? null
})
const isRealtime = computed(() => realtimeSummary.value !== null)

// 按统计类型过滤 by_label 明细（后端默认返回 request/transaction 两类，前端按 statType 区分）
// 同时过滤掉 label 含 _total 的合计行，避免在明细表中重复展示
const byLabelRows = computed<RunSummaryByLabel[]>(() => {
  const rows = (displaySummary.value?.by_label ?? []).filter(
    (r) => !r.label.toLowerCase().includes('_total'),
  )
  if (!statType.value) return rows
  return rows.filter((r) => r.sample_type === statType.value)
})

// 成功率前端计算：success / samples * 100
const successRateOf = (samples: number, success: number): number =>
  samples > 0 ? (success / samples) * 100 : 0

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
  // 过滤掉 label 含 _total 的合计行，避免在曲线中重复展示
  const filtered = rows.filter((r) => !r.label.toLowerCase().includes('_total'))
  // 全部模式下同 label 会有 request/transaction 两类点，序列名带类型后缀区分；
  // 指定统计类型时后端只返回单类点，直接用 label
  const seriesKeyOf = (r: TimeseriesPoint) =>
    statType.value === ''
      ? `${r.label}（${SAMPLE_TYPE_TEXT[r.sample_type ?? ''] ?? r.sample_type ?? '全部'}）`
      : r.label
  const keys = [...new Set(filtered.map(seriesKeyOf))]
  const valueOf = (r: TimeseriesPoint) => {
    if (activeTab.value === 'tps') return r.tps
    if (activeTab.value === 'avg_rt') return r.avg_rt
    return r.error_rate
  }
  const series = keys.map((key) => ({
    name: key,
    type: 'line',
    smooth: true,
    showSymbol: false,
    data: filtered
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
        name: tabs.find((m) => m.key === activeTab.value)?.label,
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
    await Promise.all([poll(), fetchSummary()])
  } finally {
    querying.value = false
  }
}

// 统计类型切换同时刷新曲线与汇总
const handleStatTypeChange = () => {
  poll()
  fetchSummary()
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
    // 运行中每 5s 同时刷新曲线与实时汇总；fetchSummary 内部按 run 状态分支
    await Promise.all([poll(), fetchSummary()])
    // 每 60s 刷新一次 run 状态；翻终态后停止轮询并按全程窗口补查一次
    tickCount += 1
    if (tickCount % 12 === 0) {
      await fetchRun()
      await fetchSummary()
      if (!isRunActive(run.value?.status) && timer) {
        clearInterval(timer)
        timer = null
        await poll()
        await fetchSummary()
      }
    }
  }, 5000)
}

const handleTabChange = async (name: string) => {
  if (name === 'summary') {
    await fetchSummary()
  } else {
    await poll()
    // 切到指标标签时容器由隐藏变可见，需触发 resize 让 ECharts 重算尺寸
    chart?.resize()
  }
}

onMounted(async () => {
  loading.value = true
  await fetchRun()
  loading.value = false
  // 时间范围默认带上场景起止时间；end_time 缺失（运行中）时取当前时间
  if (run.value?.start_time) {
    const start = new Date(run.value.start_time)
    const end = run.value.end_time ? new Date(run.value.end_time) : new Date()
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      timeRange.value = [start, end]
    }
  }
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
  }
  await Promise.all([poll(), fetchSummary()])
  // 仅运行中轮询；终态 run 查一次全程即可
  if (isRunActive(run.value?.status)) startPolling()
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
        <el-radio-group v-model="statType" @change="handleStatTypeChange">
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

    <el-tabs v-model="activeTab" @tab-change="handleTabChange" class="tabs">
      <el-tab-pane
        v-for="t in tabs"
        :key="t.key"
        :label="t.label"
        :name="t.key"
      />
    </el-tabs>

    <div ref="chartRef" v-show="!isSummaryTab" class="chart" />

    <div v-show="isSummaryTab" v-loading="summaryLoading" class="summary">
      <div v-if="displaySummary" class="summary__header">
        <el-tag v-if="isRealtime" type="warning" size="small">实时（p95 近似、avg_tps 窗口径）</el-tag>
      </div>
      <el-descriptions
        v-if="displaySummary"
        :column="4"
        border
        size="small"
        class="summary__overall"
      >
        <el-descriptions-item label="平均响应时间(ms)">{{ formatNumber(displaySummary.avg_rt, 0) }}</el-descriptions-item>
        <el-descriptions-item label="最小(ms)">{{ formatNumber(displaySummary.min_rt, 0) }}</el-descriptions-item>
        <el-descriptions-item label="最大(ms)">{{ formatNumber(displaySummary.max_rt, 0) }}</el-descriptions-item>
        <el-descriptions-item label="P95(ms)">{{ formatNumber(displaySummary.p95_rt, 0) }}</el-descriptions-item>
        <el-descriptions-item label="平均TPS">{{ formatNumber(displaySummary.avg_tps, 2) }}</el-descriptions-item>
        <el-descriptions-item label="成功">{{ displaySummary.success }}</el-descriptions-item>
        <el-descriptions-item label="错误">{{ displaySummary.errors }}</el-descriptions-item>
        <el-descriptions-item label="样本总数">{{ displaySummary.samples }}</el-descriptions-item>
        <el-descriptions-item label="成功率">
          {{ formatPercent(successRateOf(displaySummary.samples, displaySummary.success)) }}
        </el-descriptions-item>
      </el-descriptions>

      <el-table
        :data="byLabelRows"
        stripe
        border
        size="small"
        class="summary__table"
      >
        <el-table-column prop="label" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column v-if="statType === ''" label="统计类型" width="90">
          <template #default="{ row }">
            {{ SAMPLE_TYPE_TEXT[row.sample_type] ?? row.sample_type }}
          </template>
        </el-table-column>
        <el-table-column label="平均响应时间(ms)" width="130" align="right">
          <template #default="{ row }">{{ formatNumber(row.avg_rt, 0) }}</template>
        </el-table-column>
        <el-table-column label="最小(ms)" width="90" align="right">
          <template #default="{ row }">{{ formatNumber(row.min_rt, 0) }}</template>
        </el-table-column>
        <el-table-column label="最大(ms)" width="90" align="right">
          <template #default="{ row }">{{ formatNumber(row.max_rt, 0) }}</template>
        </el-table-column>
        <el-table-column label="P95(ms)" width="90" align="right">
          <template #default="{ row }">{{ formatNumber(row.p95_rt, 0) }}</template>
        </el-table-column>
        <el-table-column label="平均TPS" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.avg_tps, 2) }}</template>
        </el-table-column>
        <el-table-column prop="success" label="成功" width="80" align="right" />
        <el-table-column prop="errors" label="错误" width="80" align="right" />
        <el-table-column prop="samples" label="样本总数" width="90" align="right" />
        <el-table-column label="成功率" width="90" align="right">
          <template #default="{ row }">{{ formatPercent(successRateOf(row.samples, row.success)) }}</template>
        </el-table-column>
      </el-table>
    </div>
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
.summary {
  &__header {
    margin-bottom: 8px;
  }
  &__overall {
    margin-bottom: 16px;
  }
}
</style>
