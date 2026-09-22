<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  precheckTransactionDelete,
  updateTransaction,
} from '@/api/transactions'
import { listScripts } from '@/api/scripts'
import type { Script, Transaction } from '@/types/api'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, formatNumber, formatPercent } from '@/utils/format'

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

const transactions = ref<Transaction[]>([])
const total = ref(0)
const loading = ref(false)

// 查询条件：name 模糊、txn_code 精确
const filters = reactive({ name: '', txn_code: '' })
const page = reactive({ page: 1, page_size: 20 })

// 脚本下拉（用于 default_script_id）
const scripts = ref<Script[]>([])
const scriptNameMap = computed(() => {
  const m = new Map<number, string>()
  scripts.value.forEach((s) => m.set(s.id, `${s.name} (v${s.version})`))
  return m
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listTransactions(projectId, {
      name: filters.name.trim() || undefined,
      txn_code: filters.txn_code.trim() || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    transactions.value = res.items
    total.value = res.total
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
}

const fetchScripts = async () => {
  if (scripts.value.length) return
  try {
    const res = await listScripts(projectId, { page: 1, page_size: 100 })
    scripts.value = res.items
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
  filters.txn_code = ''
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

// ===== 新建 =====
const createVisible = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({
  name: '',
  txn_code: '',
  default_script_id: null as number | null,
  sla_tps: null as number | null,
  sla_p95_ms: null as number | null,
  sla_error_rate: null as number | null,
  description: '',
})

const resetCreateForm = () => {
  createForm.name = ''
  createForm.txn_code = ''
  createForm.default_script_id = null
  createForm.sla_tps = null
  createForm.sla_p95_ms = null
  createForm.sla_error_rate = null
  createForm.description = ''
}

const handleCreate = async () => {
  if (!createForm.name.trim()) {
    ElMessage.warning('交易名称不能为空')
    return
  }
  if (!createForm.txn_code.trim()) {
    ElMessage.warning('交易编码不能为空')
    return
  }
  createSubmitting.value = true
  try {
    await createTransaction(projectId, {
      name: createForm.name.trim(),
      txn_code: createForm.txn_code.trim(),
      default_script_id: createForm.default_script_id ?? null,
      sla_tps: createForm.sla_tps ?? null,
      sla_p95_ms: createForm.sla_p95_ms ?? null,
      sla_error_rate: createForm.sla_error_rate ?? null,
      description: createForm.description,
    })
    ElMessage.success('创建成功')
    createVisible.value = false
    resetCreateForm()
    page.page = 1
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3050 编码重复等）
  } finally {
    createSubmitting.value = false
  }
}

// ===== 编辑 =====
const editVisible = ref(false)
const editSubmitting = ref(false)
const editTarget = ref<Transaction | null>(null)
const editForm = reactive({
  name: '',
  txn_code: '',
  default_script_id: null as number | null,
  sla_tps: null as number | null,
  sla_p95_ms: null as number | null,
  sla_error_rate: null as number | null,
  description: '',
})

const openEdit = (row: Transaction) => {
  editTarget.value = row
  editForm.name = row.name
  editForm.txn_code = row.txn_code
  editForm.default_script_id = row.default_script_id
  editForm.sla_tps = row.sla_tps
  editForm.sla_p95_ms = row.sla_p95_ms
  editForm.sla_error_rate = row.sla_error_rate
  editForm.description = row.description
  editVisible.value = true
}

const handleEditSubmit = async () => {
  if (!editTarget.value) return
  if (!editForm.name.trim()) {
    ElMessage.warning('交易名称不能为空')
    return
  }
  if (!editForm.txn_code.trim()) {
    ElMessage.warning('交易编码不能为空')
    return
  }
  const t = editTarget.value
  const payload: {
    name?: string
    txn_code?: string
    default_script_id?: number | null
    sla_tps?: number | null
    sla_p95_ms?: number | null
    sla_error_rate?: number | null
    description?: string
  } = {}
  if (editForm.name.trim() !== t.name) payload.name = editForm.name.trim()
  if (editForm.txn_code.trim() !== t.txn_code) payload.txn_code = editForm.txn_code.trim()
  if (editForm.default_script_id !== t.default_script_id) {
    payload.default_script_id = editForm.default_script_id ?? null
  }
  if (editForm.sla_tps !== t.sla_tps) payload.sla_tps = editForm.sla_tps ?? null
  if (editForm.sla_p95_ms !== t.sla_p95_ms) payload.sla_p95_ms = editForm.sla_p95_ms ?? null
  if (editForm.sla_error_rate !== t.sla_error_rate) {
    payload.sla_error_rate = editForm.sla_error_rate ?? null
  }
  if (editForm.description !== t.description) payload.description = editForm.description

  if (!Object.keys(payload).length) {
    ElMessage.info('未修改任何字段')
    editVisible.value = false
    return
  }

  editSubmitting.value = true
  try {
    await updateTransaction(projectId, t.id, payload)
    ElMessage.success('更新成功')
    editVisible.value = false
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3050 编码重复等）
  } finally {
    editSubmitting.value = false
  }
}

// ===== 删除：预检 + force =====
const handleDelete = async (row: Transaction) => {
  let pre: Awaited<ReturnType<typeof precheckTransactionDelete>>
  try {
    pre = await precheckTransactionDelete(projectId, row.id)
  } catch {
    // 拦截器已弹 ElMessage（3051 不存在等）
    return
  }

  const needForce = pre.scenarios > 0 || pre.test_plans > 0
  const message = needForce
    ? `确认强制删除交易「${row.name}」？该交易被 ${pre.scenarios} 个场景、${pre.test_plans} 个测试方案引用，将级联解绑后删除，删除后不可恢复。`
    : `确认删除交易「${row.name}」？删除后不可恢复。`

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
    await deleteTransaction(projectId, row.id, needForce)
    ElMessage.success('删除成功')
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3053 被引用等）
  }
}

// ===== 详情 =====
const detailVisible = ref(false)
const detailTxn = ref<Transaction | null>(null)

const openDetail = (row: Transaction) => {
  detailTxn.value = row
  detailVisible.value = true
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>交易清单管理</span>
        <el-button v-if="canWrite" type="primary" @click="createVisible = true; fetchScripts()">
          新建交易
        </el-button>
      </div>
    </template>

    <div class="filters">
      <el-input
        v-model="filters.name"
        placeholder="交易名称"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-input
        v-model="filters.txn_code"
        placeholder="交易编码"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="transactions" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="交易名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="txn_code" label="交易编码" width="140" show-overflow-tooltip />
      <el-table-column label="默认脚本" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.default_script_id ? scriptNameMap.get(row.default_script_id) || `#${row.default_script_id}` : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="SLA 目标 TPS" width="120">
        <template #default="{ row }">{{ formatNumber(row.sla_tps) }}</template>
      </el-table-column>
      <el-table-column label="SLA P95(ms)" width="110">
        <template #default="{ row }">{{ row.sla_p95_ms ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="SLA 错误率上限" width="130">
        <template #default="{ row }">{{ formatPercent(row.sla_error_rate) }}</template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
          <el-button v-if="canWrite" link type="primary" size="small" @click="openEdit(row); fetchScripts()">编辑</el-button>
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
    <el-dialog v-model="createVisible" title="新建交易" width="560px" @close="resetCreateForm">
      <el-form :model="createForm" label-width="110px">
        <el-form-item label="交易名称" required>
          <el-input v-model="createForm.name" maxlength="128" show-word-limit placeholder="如：登录交易" />
        </el-form-item>
        <el-form-item label="交易编码" required>
          <el-input v-model="createForm.txn_code" maxlength="64" show-word-limit placeholder="如：login（项目内唯一）" />
        </el-form-item>
        <el-form-item label="默认脚本">
          <el-select
            v-model="createForm.default_script_id"
            clearable
            placeholder="不指定"
            style="width: 100%"
          >
            <el-option
              v-for="s in scripts"
              :key="s.id"
              :label="`${s.name} (v${s.version})`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="SLA 目标 TPS">
          <el-input-number v-model="createForm.sla_tps" :min="0" :precision="2" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="SLA P95(ms)">
          <el-input-number v-model="createForm.sla_p95_ms" :min="0" :step="50" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="SLA 错误率(%)">
          <el-input-number v-model="createForm.sla_error_rate" :min="0" :max="100" :precision="2" :step="0.1" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="2" maxlength="512" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" title="编辑交易" width="560px">
      <el-form :model="editForm" label-width="110px">
        <el-form-item label="交易名称" required>
          <el-input v-model="editForm.name" maxlength="128" show-word-limit />
        </el-form-item>
        <el-form-item label="交易编码" required>
          <el-input v-model="editForm.txn_code" maxlength="64" show-word-limit />
        </el-form-item>
        <el-form-item label="默认脚本">
          <el-select
            v-model="editForm.default_script_id"
            clearable
            placeholder="不指定"
            style="width: 100%"
          >
            <el-option
              v-for="s in scripts"
              :key="s.id"
              :label="`${s.name} (v${s.version})`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="SLA 目标 TPS">
          <el-input-number v-model="editForm.sla_tps" :min="0" :precision="2" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="SLA P95(ms)">
          <el-input-number v-model="editForm.sla_p95_ms" :min="0" :step="50" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="SLA 错误率(%)">
          <el-input-number v-model="editForm.sla_error_rate" :min="0" :max="100" :precision="2" :step="0.1" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="2" maxlength="512" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEditSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="交易详情" width="640px">
      <el-descriptions v-if="detailTxn" :column="2" border>
        <el-descriptions-item label="ID">{{ detailTxn.id }}</el-descriptions-item>
        <el-descriptions-item label="所属项目">{{ detailTxn.project_id }}</el-descriptions-item>
        <el-descriptions-item label="交易名称">{{ detailTxn.name }}</el-descriptions-item>
        <el-descriptions-item label="交易编码">{{ detailTxn.txn_code }}</el-descriptions-item>
        <el-descriptions-item label="默认脚本">
          {{ detailTxn.default_script_id ? scriptNameMap.get(detailTxn.default_script_id) || `#${detailTxn.default_script_id}` : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="SLA 目标 TPS">{{ formatNumber(detailTxn.sla_tps) }}</el-descriptions-item>
        <el-descriptions-item label="SLA P95(ms)">{{ detailTxn.sla_p95_ms ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="SLA 错误率上限">{{ formatPercent(detailTxn.sla_error_rate) }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ detailTxn.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detailTxn.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDateTime(detailTxn.updated_at) }}</el-descriptions-item>
      </el-descriptions>
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
  width: 180px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
