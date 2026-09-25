<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createTestPlan,
  deleteTestPlan,
  executeTestPlan,
  listTestPlans,
  precheckTestPlanDelete,
  updateTestPlan,
} from '@/api/testPlans'
import { listScenarios } from '@/api/scenarios'
import type {
  Scenario,
  TestPlan,
  TestPlanExecuteResult,
  TestPlanScenarioIn,
} from '@/types/api'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

const route = useRoute()
const projectStore = useProjectStore()
const auth = useAuthStore()
const projectId = Number(route.params.projectId)

// 写操作权限：admin 或项目编辑者+
const canWrite = computed(() => {
  if (auth.isAdmin) return true
  const p = projectStore.projects.find((x) => x.id === projectId)
  return projectStore.hasRole(p, '编辑者')
})

// 删除权限：后端要求 owner+（项目管理员）
const canDelete = computed(() => {
  if (auth.isAdmin) return true
  const p = projectStore.projects.find((x) => x.id === projectId)
  return projectStore.hasRole(p, '项目管理员')
})

const plans = ref<TestPlan[]>([])
const total = ref(0)
const loading = ref(false)

// 查询条件：name 模糊
const filters = reactive({ name: '' })
const page = reactive({ page: 1, page_size: 20 })

// 场景下拉（用于挂载场景）
const scenarios = ref<Scenario[]>([])
const scenarioNameMap = computed(() => {
  const m = new Map<number, string>()
  scenarios.value.forEach((s) => m.set(s.id, s.name))
  return m
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listTestPlans(projectId, {
      name: filters.name.trim() || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    plans.value = res.items
    total.value = res.total
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
}

const fetchScenarios = async () => {
  if (scenarios.value.length) return
  try {
    const res = await listScenarios(projectId, { page: 1, page_size: 100 })
    scenarios.value = res.items
  } catch {
    // 拦截器已弹 ElMessage
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

// ===== 表单：场景挂载行 =====
interface ScenarioRow {
  scenario_id: number | null
  seq: number
  weight: number
}

const buildScenarioRows = (
  list: { scenario_id: number; seq: number; weight: number }[],
): ScenarioRow[] =>
  list.map((s) => ({
    scenario_id: s.scenario_id,
    seq: s.seq,
    weight: s.weight,
  }))

const addScenarioRow = (rows: ScenarioRow[]) => {
  rows.push({ scenario_id: null, seq: rows.length + 1, weight: 1 })
}

const removeScenarioRow = (rows: ScenarioRow[], idx: number) => {
  rows.splice(idx, 1)
}

// 校验场景挂载行：scenario_id 必填、不可重复
const validateScenarioRows = (rows: ScenarioRow[]): TestPlanScenarioIn[] | null => {
  const ids = new Set<number>()
  for (const r of rows) {
    if (r.scenario_id === null) {
      ElMessage.warning('请选择挂载的场景')
      return null
    }
    if (ids.has(r.scenario_id)) {
      ElMessage.warning('方案内场景不可重复挂载')
      return null
    }
    ids.add(r.scenario_id)
  }
  return rows.map((r) => ({
    scenario_id: r.scenario_id as number,
    seq: r.seq,
    weight: r.weight,
  }))
}

// 解析 pass_criteria JSON 文本
const parsePassCriteria = (
  text: string,
): Record<string, unknown> | null => {
  const trimmed = text.trim()
  if (!trimmed) return {}
  try {
    const obj = JSON.parse(trimmed)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      ElMessage.warning('通过判据须为 JSON 对象')
      return null
    }
    return obj
  } catch {
    ElMessage.warning('通过判据 JSON 格式错误')
    return null
  }
}

const stringifyPassCriteria = (
  val: Record<string, unknown> | null,
): string => {
  if (!val || !Object.keys(val).length) return ''
  return JSON.stringify(val, null, 2)
}

// ===== 新建 =====
const createVisible = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({
  name: '',
  pass_criteria: '',
  report_template: 'default',
  description: '',
  scenarioRows: [] as ScenarioRow[],
})

const resetCreateForm = () => {
  createForm.name = ''
  createForm.pass_criteria = ''
  createForm.report_template = 'default'
  createForm.description = ''
  createForm.scenarioRows = []
}

const handleCreate = async () => {
  if (!createForm.name.trim()) {
    ElMessage.warning('方案名称不能为空')
    return
  }
  const passCriteria = parsePassCriteria(createForm.pass_criteria)
  if (passCriteria === null) return
  const scenarioItems = validateScenarioRows(createForm.scenarioRows)
  if (scenarioItems === null) return

  createSubmitting.value = true
  try {
    await createTestPlan(projectId, {
      name: createForm.name.trim(),
      pass_criteria: passCriteria,
      report_template: createForm.report_template.trim() || 'default',
      description: createForm.description,
      scenarios: scenarioItems,
    })
    ElMessage.success('创建成功')
    createVisible.value = false
    resetCreateForm()
    page.page = 1
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3070 名称重复、3073/3074 场景校验等）
  } finally {
    createSubmitting.value = false
  }
}

// ===== 编辑 =====
const editVisible = ref(false)
const editSubmitting = ref(false)
const editTarget = ref<TestPlan | null>(null)
const editForm = reactive({
  name: '',
  pass_criteria: '',
  report_template: 'default',
  description: '',
  scenarioRows: [] as ScenarioRow[],
})

const openEdit = (row: TestPlan) => {
  editTarget.value = row
  editForm.name = row.name
  editForm.pass_criteria = stringifyPassCriteria(row.pass_criteria)
  editForm.report_template = row.report_template
  editForm.description = row.description
  editForm.scenarioRows = buildScenarioRows(row.scenarios)
  editVisible.value = true
}

const handleEditSubmit = async () => {
  if (!editTarget.value) return
  if (!editForm.name.trim()) {
    ElMessage.warning('方案名称不能为空')
    return
  }
  const t = editTarget.value
  const passCriteria = parsePassCriteria(editForm.pass_criteria)
  if (passCriteria === null) return
  const scenarioItems = validateScenarioRows(editForm.scenarioRows)
  if (scenarioItems === null) return

  const payload: {
    name?: string
    pass_criteria?: Record<string, unknown>
    report_template?: string
    description?: string
    scenarios?: TestPlanScenarioIn[]
  } = {}
  if (editForm.name.trim() !== t.name) payload.name = editForm.name.trim()
  // pass_criteria：空文本 -> {}，与后端 dict 语义一致
  const normalizedPass = passCriteria
  const originalPass = t.pass_criteria || {}
  if (JSON.stringify(normalizedPass) !== JSON.stringify(originalPass)) {
    payload.pass_criteria = normalizedPass
  }
  const rt = editForm.report_template.trim() || 'default'
  if (rt !== t.report_template) payload.report_template = rt
  if (editForm.description !== t.description) payload.description = editForm.description
  // scenarios 全量替换：比较序列化结果
  const originalScenarios = (t.scenarios || []).map((s) => ({
    scenario_id: s.scenario_id,
    seq: s.seq,
    weight: s.weight,
  }))
  if (JSON.stringify(scenarioItems) !== JSON.stringify(originalScenarios)) {
    payload.scenarios = scenarioItems
  }

  if (!Object.keys(payload).length) {
    ElMessage.info('未修改任何字段')
    editVisible.value = false
    return
  }

  editSubmitting.value = true
  try {
    await updateTestPlan(projectId, t.id, payload)
    ElMessage.success('更新成功')
    editVisible.value = false
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    editSubmitting.value = false
  }
}

// ===== 删除：预检 + force =====
const handleDelete = async (row: TestPlan) => {
  let pre: Awaited<ReturnType<typeof precheckTestPlanDelete>>
  try {
    pre = await precheckTestPlanDelete(projectId, row.id)
  } catch {
    // 拦截器已弹 ElMessage（3071 不存在等）
    return
  }

  const needForce = pre.references > 0
  const message = needForce
    ? `确认强制删除方案「${row.name}」？该方案被 ${pre.references} 处引用，将先解绑引用再删除，删除后不可恢复。`
    : `确认删除方案「${row.name}」？将同时清理 ${pre.scenarios} 个场景挂载关系，删除后不可恢复。`

  const confirmed = await ElMessageBox.confirm(
    message,
    needForce ? '强制删除确认' : '删除确认',
    {
      type: needForce ? 'error' : 'warning',
      confirmButtonText: needForce ? '强制删除' : '删除',
      cancelButtonText: '取消',
    },
  )
    .then(() => true)
    .catch(() => false)
  if (!confirmed) return

  try {
    await deleteTestPlan(projectId, row.id, needForce)
    ElMessage.success('删除成功')
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3075 被引用等）
  }
}

// ===== 详情 =====
const detailVisible = ref(false)
const detailPlan = ref<TestPlan | null>(null)

const openDetail = (row: TestPlan) => {
  detailPlan.value = row
  detailVisible.value = true
}

// ===== 执行 =====
const executing = ref(false)
const executeVisible = ref(false)
const executeResult = ref<TestPlanExecuteResult | null>(null)

const handleExecute = async (row: TestPlan) => {
  if (!row.scenarios || row.scenarios.length === 0) {
    ElMessage.warning('方案未挂载任何场景，无法执行')
    return
  }
  executing.value = true
  try {
    const res = await executeTestPlan(projectId, row.id)
    executeResult.value = res
    executeVisible.value = true
    if (res.failed > 0) {
      ElMessage.warning(`执行完成：成功 ${res.succeeded}，失败 ${res.failed}`)
    } else {
      ElMessage.success(`执行成功，共触发 ${res.succeeded} 个场景`)
    }
  } catch {
    // 拦截器已弹 ElMessage（3076 无挂载场景等）
  } finally {
    executing.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>测试方案管理</span>
        <el-button v-if="canWrite" type="primary" @click="createVisible = true; fetchScenarios()">
          新建方案
        </el-button>
      </div>
    </template>

    <div class="filters">
      <el-input
        v-model="filters.name"
        placeholder="方案名称"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="plans" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="方案名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="report_template" label="报告模板" width="120" />
      <el-table-column label="挂载场景" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag v-for="s in row.scenarios" :key="s.scenario_id" size="small" class="scenario-tag">
            {{ s.scenario_name || `#${s.scenario_id}` }}<span class="seq">#{{ s.seq }}</span>
          </el-tag>
          <span v-if="!row.scenarios?.length" class="empty-text">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
          <el-button v-if="canWrite" link type="primary" size="small" @click="openEdit(row); fetchScenarios()">编辑</el-button>
          <el-button
            v-if="canWrite"
            link
            type="success"
            size="small"
            :loading="executing"
            @click="handleExecute(row)"
          >执行</el-button>
          <el-button v-if="canDelete" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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

    <!-- 新建对话框 -->
    <el-dialog v-model="createVisible" title="新建测试方案" width="680px" @close="resetCreateForm">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="方案名称" required>
          <el-input v-model="createForm.name" maxlength="128" show-word-limit placeholder="如：核心交易回归方案" />
        </el-form-item>
        <el-form-item label="报告模板">
          <el-input v-model="createForm.report_template" maxlength="64" placeholder="default" />
        </el-form-item>
        <el-form-item label="通过判据">
          <el-input
            v-model="createForm.pass_criteria"
            type="textarea"
            :rows="4"
            placeholder='JSON 对象，如 {"max_p95_ms": 500, "max_error_rate": 1.0}'
          />
          <div class="tip">自由 JSON，留空表示无判据</div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="2" maxlength="512" show-word-limit />
        </el-form-item>
        <el-form-item label="挂载场景">
          <div class="scenario-editor">
            <el-table :data="createForm.scenarioRows" size="small" border>
              <el-table-column label="场景" min-width="180">
                <template #default="{ row }">
                  <el-select v-model="row.scenario_id" placeholder="选择场景" style="width: 100%">
                    <el-option
                      v-for="s in scenarios"
                      :key="s.id"
                      :label="s.name"
                      :value="s.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="执行顺序" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.seq" :min="0" controls-position="right" style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="权重" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.weight" :min="1" controls-position="right" style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{ $index }">
                  <el-button link type="danger" size="small" @click="removeScenarioRow(createForm.scenarioRows, $index)">移除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-button size="small" @click="addScenarioRow(createForm.scenarioRows)">+ 添加场景</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" title="编辑测试方案" width="680px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="方案名称" required>
          <el-input v-model="editForm.name" maxlength="128" show-word-limit />
        </el-form-item>
        <el-form-item label="报告模板">
          <el-input v-model="editForm.report_template" maxlength="64" />
        </el-form-item>
        <el-form-item label="通过判据">
          <el-input
            v-model="editForm.pass_criteria"
            type="textarea"
            :rows="4"
            placeholder='JSON 对象，如 {"max_p95_ms": 500}'
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="2" maxlength="512" show-word-limit />
        </el-form-item>
        <el-form-item label="挂载场景">
          <div class="scenario-editor">
            <el-table :data="editForm.scenarioRows" size="small" border>
              <el-table-column label="场景" min-width="180">
                <template #default="{ row }">
                  <el-select v-model="row.scenario_id" placeholder="选择场景" style="width: 100%">
                    <el-option
                      v-for="s in scenarios"
                      :key="s.id"
                      :label="s.name"
                      :value="s.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="执行顺序" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.seq" :min="0" controls-position="right" style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="权重" width="120">
                <template #default="{ row }">
                  <el-input-number v-model="row.weight" :min="1" controls-position="right" style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{ $index }">
                  <el-button link type="danger" size="small" @click="removeScenarioRow(editForm.scenarioRows, $index)">移除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-button size="small" @click="addScenarioRow(editForm.scenarioRows)">+ 添加场景</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEditSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="方案详情" width="720px">
      <el-descriptions v-if="detailPlan" :column="2" border>
        <el-descriptions-item label="ID">{{ detailPlan.id }}</el-descriptions-item>
        <el-descriptions-item label="所属项目">{{ detailPlan.project_id }}</el-descriptions-item>
        <el-descriptions-item label="方案名称">{{ detailPlan.name }}</el-descriptions-item>
        <el-descriptions-item label="报告模板">{{ detailPlan.report_template }}</el-descriptions-item>
        <el-descriptions-item label="通过判据" :span="2">
          <pre class="meta">{{ detailPlan.pass_criteria && Object.keys(detailPlan.pass_criteria).length ? JSON.stringify(detailPlan.pass_criteria, null, 2) : '-' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ detailPlan.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detailPlan.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDateTime(detailPlan.updated_at) }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="detailPlan" class="scenario-list">
        <div class="scenario-list-title">挂载场景（{{ detailPlan.scenarios.length }}）</div>
        <el-table v-if="detailPlan.scenarios.length" :data="detailPlan.scenarios" size="small" border>
          <el-table-column label="序号" width="80">
            <template #default="{ row }">{{ row.seq }}</template>
          </el-table-column>
          <el-table-column label="场景" min-width="180">
            <template #default="{ row }">{{ row.scenario_name || `#${row.scenario_id}` }}</template>
          </el-table-column>
          <el-table-column label="权重" width="120">
            <template #default="{ row }">{{ row.weight }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无挂载场景" :image-size="60" />
      </div>
    </el-dialog>

    <!-- 执行结果对话框 -->
    <el-dialog v-model="executeVisible" title="执行结果" width="640px">
      <el-descriptions v-if="executeResult" :column="3" border>
        <el-descriptions-item label="场景总数">{{ executeResult.total }}</el-descriptions-item>
        <el-descriptions-item label="成功">
          <el-tag type="success">{{ executeResult.succeeded }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="失败">
          <el-tag :type="executeResult.failed ? 'danger' : 'info'">{{ executeResult.failed }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <el-table v-if="executeResult" :data="executeResult.runs" size="small" border style="margin-top: 12px">
        <el-table-column prop="scenario_name" label="场景" min-width="160" show-overflow-tooltip />
        <el-table-column label="结果" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.ok ? 'success' : 'danger'" size="small">{{ row.ok ? '成功' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="执行编号" min-width="140">
          <template #default="{ row }">{{ row.run_no || '-' }}</template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.error || '-' }}</template>
        </el-table-column>
      </el-table>
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
  flex-wrap: wrap;
}
.filter-input {
  width: 220px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
.scenario-editor {
  width: 100%;
  .el-button {
    margin-top: 8px;
  }
}
.scenario-tag {
  margin-right: 4px;
  margin-bottom: 2px;
  .seq {
    margin-left: 2px;
    opacity: 0.7;
  }
}
.empty-text {
  color: var(--el-text-color-secondary);
}
.scenario-list {
  margin-top: 16px;
  &-title {
    font-weight: 600;
    margin-bottom: 8px;
  }
}
.meta {
  margin: 0;
  max-height: 160px;
  overflow: auto;
  font-size: 12px;
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  white-space: pre-wrap;
}
</style>
