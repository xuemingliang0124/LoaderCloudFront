<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteScenario, listScenarios, precheckScenarioDelete } from '@/api/scenarios'
import { listAgents } from '@/api/agents'
import { createRun } from '@/api/runs'
import type { Agent, Scenario, ScenarioDeletePrecheck } from '@/types/api'
import { isAgentSelectable, scenarioTypeTagType } from '@/utils/status'

const router = useRouter()

const scenarios = ref<Scenario[]>([])
const total = ref(0)
const loading = ref(false)

// 查询条件（输入中的值，点查询后才同步到请求参数）
const filters = reactive({ name: '' })
const page = reactive({ page: 1, page_size: 20 })

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listScenarios({
      name: filters.name.trim() || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    scenarios.value = res.items
    total.value = res.total
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.page = 1
  fetchData()
}

const handleReset = () => {
  filters.name = ''
  page.page = 1
  fetchData()
}

const handlePageChange = (p: number) => {
  page.page = p
  fetchData()
}

const handlePageSizeChange = (s: number) => {
  page.page_size = s
  page.page = 1
  fetchData()
}

const handleCreate = () => {
  router.push('/scenarios/create')
}

// ===== 执行 =====
const runDialogVisible = ref(false)
const runSubmitting = ref(false)
const runAgents = ref<Agent[]>([])
const runForm = reactive({
  scenario: null as Scenario | null,
  agent_ids: [] as string[],
})

const handleRun = async (row: Scenario) => {
  runForm.scenario = row
  runForm.agent_ids = []
  runDialogVisible.value = true
  try {
    // 下拉用主数据，量小，取首页 100 条上限
    const res = await listAgents({ page: 1, page_size: 100 })
    runAgents.value = res.items
  } catch {
    // 拦截器已弹 ElMessage
  }
}

const handleRunSubmit = async () => {
  if (!runForm.scenario) return
  runSubmitting.value = true
  try {
    const result = await createRun(
      runForm.scenario.id,
      runForm.agent_ids.length ? runForm.agent_ids : undefined,
    )
    ElMessage.success(`已下发，run_no=${result.run_no}，选中 ${result.agent_ids.length} 台 Agent`)
    runDialogVisible.value = false
    runForm.scenario = null
    runForm.agent_ids = []
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    runSubmitting.value = false
  }
}

// ===== 详情 =====
const detailVisible = ref(false)
const detailRow = ref<Scenario | null>(null)

const handleDetail = (row: Scenario) => {
  detailRow.value = row
  detailVisible.value = true
}

// ===== 删除：先调预检，运行中任务直接拦截；有关联记录则二次确认后 force 级联删除 =====
const handleDelete = async (row: Scenario) => {
  let pre: ScenarioDeletePrecheck
  try {
    pre = await precheckScenarioDelete(row.id)
  } catch {
    // 拦截器已弹 ElMessage（如场景不存在 code 3013）
    return
  }

  // 存在未结束执行任务：严格/强制均不允许，需先停止
  if (pre.running_runs > 0) {
    ElMessage.warning(`存在 ${pre.running_runs} 个未结束的执行任务，请先停止后再删除`)
    return
  }

  const needForce = pre.history_runs > 0 || pre.schedule_jobs.length > 0
  const message = needForce
    ? h('div', [
        h('p', { style: 'margin: 0 0 8px;' }, `确认强制删除场景「${row.name}」？存在关联数据，将级联清理：`),
        h(
          'ul',
          { style: 'margin: 0; padding-left: 20px;' },
          [
            pre.history_runs > 0
              ? h('li', `历史执行记录 ${pre.history_runs} 条（含执行结果与产物文件）`)
              : null,
            pre.schedule_jobs.length
              ? h(
                  'li',
                  `定时任务 ${pre.schedule_jobs.length} 个：${pre.schedule_jobs
                    .slice(0, 5)
                    .map((j) => j.name)
                    .join('、')}${pre.schedule_jobs.length > 5 ? ' 等' : ''}`,
                )
              : null,
          ],
        ),
        h('p', { style: 'margin: 8px 0 0; color: var(--el-color-danger);' }, '删除后不可恢复！'),
      ])
    : `确认删除场景「${row.name}」？场景及其脚本加压配置将一并删除，删除后不可恢复。`

  const confirmed = await ElMessageBox.confirm(message, needForce ? '强制删除确认' : '删除确认', {
    type: needForce ? 'error' : 'warning',
    confirmButtonText: needForce ? '强制删除' : '删除',
    cancelButtonText: '取消',
  })
    .then(() => true)
    .catch(() => false)
  if (!confirmed) return

  try {
    const res = await deleteScenario(row.id, needForce)
    if (needForce) {
      ElMessage.success(
        `删除成功，已清理 ${res.removed_runs} 条执行记录、${res.removed_schedules} 个定时任务` +
          (res.removed_artifacts ? `、${res.removed_artifacts} 个产物文件` : ''),
      )
    } else {
      ElMessage.success('删除成功')
    }
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（如运行中 3014 / 历史记录 3016 / 定时任务 3015）
  }
}

// 拼接关联脚本名称列表（避免模板内 map 的类型推断问题）
const formatScripts = (row: Scenario): string => {
  if (!row.scripts?.length) return ''
  return row.scripts.map((s) => s.script_name).filter(Boolean).join('、')
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>场景列表</span>
        <el-button type="primary" @click="handleCreate">新建场景</el-button>
      </div>
    </template>
    <div class="filters">
      <el-input
        v-model="filters.name"
        placeholder="场景名称"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>
    <el-table v-loading="loading" :data="scenarios" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column label="类型" width="120">
        <template #default="{ row }">
          <el-tag :type="scenarioTypeTagType(row.scenario_type)" size="small">
            {{ row.scenario_type }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="关联脚本" min-width="200">
        <template #default="{ row }">
          <span v-if="row.scripts?.length">
            共 {{ row.scripts.length }} 个：{{ formatScripts(row) }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="时长(秒)" width="100" prop="duration" />
      <el-table-column label="参数覆盖" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          {{ JSON.stringify(row.param_overrides || {}) }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="handleRun(row)">执行</el-button>
          <el-button link type="primary" size="small" @click="handleDetail(row)">详情</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="page.page"
        v-model:page-size="page.page_size"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </div>

    <!-- 执行弹窗：场景固定，可选指定 Agent，留空自动选机 -->
    <el-dialog v-model="runDialogVisible" title="执行场景" width="480px">
      <el-form label-width="100px">
        <el-form-item label="场景">
          <span>{{ runForm.scenario?.name }}</span>
        </el-form-item>
        <el-form-item label="指定 Agent">
          <el-select
            v-model="runForm.agent_ids"
            multiple
            placeholder="留空则按场景配置自动选机"
            style="width: 100%"
          >
            <el-option
              v-for="a in runAgents"
              :key="a.agent_id"
              :label="`${a.agent_id} (${a.ip})`"
              :value="a.agent_id"
              :disabled="!isAgentSelectable(a.status)"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="runDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="runSubmitting" @click="handleRunSubmit">下发</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗：基础信息 + 各脚本的线程组加压配置 -->
    <el-dialog v-model="detailVisible" title="场景详情" width="760px">
      <el-descriptions v-if="detailRow" :column="2" border>
        <el-descriptions-item label="名称">{{ detailRow.name }}</el-descriptions-item>
        <el-descriptions-item label="类型">
          <el-tag :type="scenarioTypeTagType(detailRow.scenario_type)" size="small">
            {{ detailRow.scenario_type }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="时长(秒)">{{ detailRow.duration ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ detailRow.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="参数覆盖" :span="2">
          {{ JSON.stringify(detailRow.param_overrides || {}) }}
        </el-descriptions-item>
      </el-descriptions>
      <div v-if="detailRow" class="detail-scripts">
        <div v-for="s in detailRow.scripts" :key="s.script_id" class="detail-script">
          <div class="detail-script-header">
            <span class="detail-script-name">{{ s.script_name || `脚本 #${s.script_id}` }}</span>
            <el-tag size="small" type="info">顺序 {{ s.order_index }}</el-tag>
            <el-tag size="small" type="info">
              {{ s.agent_tags?.length ? `标签 ${s.agent_tags.join(',')}` : '不按标签选机' }}
            </el-tag>
            <el-tag size="small" type="info">{{ s.agent_count ? `${s.agent_count} 台` : '全量加压' }}</el-tag>
          </div>
          <el-table :data="s.thread_groups" size="small" border>
            <el-table-column prop="thread_group_name" label="线程组" min-width="140" />
            <el-table-column prop="num_threads" label="并发数" width="80" />
            <el-table-column prop="ramp_time" label="Ramp-up(s)" width="100" />
            <el-table-column label="循环次数" width="90">
              <template #default="{ row }">{{ row.loops === -1 ? '无限' : row.loops }}</template>
            </el-table-column>
            <el-table-column label="持续时间" width="120">
              <template #default="{ row }">
                {{ row.scheduler ? `${row.duration} 秒后停止` : '按循环次数' }}
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-if="!detailRow.scripts?.length" description="未关联脚本" :image-size="60" />
      </div>
    </el-dialog>
  </el-card>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filters {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}
.filter-input {
  width: 240px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.detail-scripts {
  margin-top: 16px;
}
.detail-script {
  & + & {
    margin-top: 16px;
  }
}
.detail-script-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.detail-script-name {
  font-weight: 600;
}
</style>
