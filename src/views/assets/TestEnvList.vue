<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createEnvironment,
  deleteEnvironment,
  listEnvironments,
  precheckEnvironmentDelete,
  updateEnvironment,
} from '@/api/environments'
import type { Environment } from '@/types/api'
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

const environments = ref<Environment[]>([])
const total = ref(0)
const loading = ref(false)

// 查询条件：name 模糊、env_code 精确
const filters = reactive({ name: '', env_code: '' })
const page = reactive({ page: 1, page_size: 20 })

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listEnvironments(projectId, {
      name: filters.name.trim() || undefined,
      env_code: filters.env_code.trim() || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    environments.value = res.items
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
  filters.env_code = ''
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

// ===== JSON 文本 <-> 对象 转换工具（hosts/db_connections/middleware_info/variables 用）=====
const toJsonText = (val: unknown): string => {
  if (val === null || val === undefined) return ''
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return ''
  }
}

const fromJsonText = (text: string, fallback: unknown): { ok: boolean; value: unknown } => {
  const trimmed = text.trim()
  if (!trimmed) return { ok: true, value: fallback }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    return { ok: false, value: fallback }
  }
}

// ===== 新建 =====
const createVisible = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({
  name: '',
  env_code: '',
  base_url: '',
  hosts: '',
  db_connections: '',
  middleware_info: '',
  variables: '',
  description: '',
})

const resetCreateForm = () => {
  createForm.name = ''
  createForm.env_code = ''
  createForm.base_url = ''
  createForm.hosts = ''
  createForm.db_connections = ''
  createForm.middleware_info = ''
  createForm.variables = ''
  createForm.description = ''
}

const handleCreate = async () => {
  if (!createForm.name.trim()) {
    ElMessage.warning('环境名称不能为空')
    return
  }
  if (!createForm.env_code.trim()) {
    ElMessage.warning('环境编码不能为空')
    return
  }
  // 解析 JSON 字段
  const hosts = fromJsonText(createForm.hosts, [])
  if (!hosts.ok) return ElMessage.warning('主机清单 JSON 格式错误')
  const db = fromJsonText(createForm.db_connections, [])
  if (!db.ok) return ElMessage.warning('数据库连接 JSON 格式错误')
  const mw = fromJsonText(createForm.middleware_info, [])
  if (!mw.ok) return ElMessage.warning('中间件清单 JSON 格式错误')
  const vars = fromJsonText(createForm.variables, {})
  if (!vars.ok) return ElMessage.warning('环境变量 JSON 格式错误')

  createSubmitting.value = true
  try {
    await createEnvironment(projectId, {
      name: createForm.name.trim(),
      env_code: createForm.env_code.trim(),
      base_url: createForm.base_url.trim(),
      hosts: hosts.value as Record<string, unknown>[],
      db_connections: db.value as Record<string, unknown>[],
      middleware_info: mw.value as Record<string, unknown>[],
      variables: vars.value as Record<string, unknown>,
      description: createForm.description,
    })
    ElMessage.success('创建成功')
    createVisible.value = false
    resetCreateForm()
    page.page = 1
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3040 编码重复等）
  } finally {
    createSubmitting.value = false
  }
}

// ===== 编辑 =====
const editVisible = ref(false)
const editSubmitting = ref(false)
const editTarget = ref<Environment | null>(null)
const editForm = reactive({
  name: '',
  env_code: '',
  base_url: '',
  hosts: '',
  db_connections: '',
  middleware_info: '',
  variables: '',
  description: '',
})

const openEdit = (row: Environment) => {
  editTarget.value = row
  editForm.name = row.name
  editForm.env_code = row.env_code
  editForm.base_url = row.base_url
  editForm.hosts = toJsonText(row.hosts)
  editForm.db_connections = toJsonText(row.db_connections)
  editForm.middleware_info = toJsonText(row.middleware_info)
  editForm.variables = toJsonText(row.variables)
  editForm.description = row.description
  editVisible.value = true
}

const handleEditSubmit = async () => {
  if (!editTarget.value) return
  if (!editForm.name.trim()) {
    ElMessage.warning('环境名称不能为空')
    return
  }
  if (!editForm.env_code.trim()) {
    ElMessage.warning('环境编码不能为空')
    return
  }
  const t = editTarget.value
  const payload: {
    name?: string
    env_code?: string
    base_url?: string
    hosts?: Record<string, unknown>[] | null
    db_connections?: Record<string, unknown>[] | null
    middleware_info?: Record<string, unknown>[] | null
    variables?: Record<string, unknown> | null
    description?: string
  } = {}

  if (editForm.name.trim() !== t.name) payload.name = editForm.name.trim()
  if (editForm.env_code.trim() !== t.env_code) payload.env_code = editForm.env_code.trim()
  if (editForm.base_url !== t.base_url) payload.base_url = editForm.base_url

  const hosts = fromJsonText(editForm.hosts, [])
  if (!hosts.ok) return ElMessage.warning('主机清单 JSON 格式错误')
  if (JSON.stringify(hosts.value) !== JSON.stringify(t.hosts ?? [])) {
    payload.hosts = hosts.value as Record<string, unknown>[]
  }

  const db = fromJsonText(editForm.db_connections, [])
  if (!db.ok) return ElMessage.warning('数据库连接 JSON 格式错误')
  if (JSON.stringify(db.value) !== JSON.stringify(t.db_connections ?? [])) {
    payload.db_connections = db.value as Record<string, unknown>[]
  }

  const mw = fromJsonText(editForm.middleware_info, [])
  if (!mw.ok) return ElMessage.warning('中间件清单 JSON 格式错误')
  if (JSON.stringify(mw.value) !== JSON.stringify(t.middleware_info ?? [])) {
    payload.middleware_info = mw.value as Record<string, unknown>[]
  }

  const vars = fromJsonText(editForm.variables, {})
  if (!vars.ok) return ElMessage.warning('环境变量 JSON 格式错误')
  if (JSON.stringify(vars.value) !== JSON.stringify(t.variables ?? {})) {
    payload.variables = vars.value as Record<string, unknown>
  }

  if (editForm.description !== t.description) payload.description = editForm.description

  if (!Object.keys(payload).length) {
    ElMessage.info('未修改任何字段')
    editVisible.value = false
    return
  }

  editSubmitting.value = true
  try {
    await updateEnvironment(projectId, t.id, payload)
    ElMessage.success('更新成功')
    editVisible.value = false
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3040 编码重复等）
  } finally {
    editSubmitting.value = false
  }
}

// ===== 删除：预检 + force =====
const handleDelete = async (row: Environment) => {
  let pre: Awaited<ReturnType<typeof precheckEnvironmentDelete>>
  try {
    pre = await precheckEnvironmentDelete(projectId, row.id)
  } catch {
    // 拦截器已弹 ElMessage（3041 不存在等）
    return
  }

  const needForce = pre.scenarios > 0
  const message = needForce
    ? `确认强制删除环境「${row.name}」？该环境被 ${pre.scenarios} 个场景引用，将级联解绑后删除，删除后不可恢复。`
    : `确认删除环境「${row.name}」？删除后不可恢复。`

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
    await deleteEnvironment(projectId, row.id, needForce)
    ElMessage.success('删除成功')
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3043 被引用等）
  }
}

// ===== 详情 =====
const detailVisible = ref(false)
const detailEnv = ref<Environment | null>(null)

const openDetail = (row: Environment) => {
  detailEnv.value = row
  detailVisible.value = true
}

const jsonPretty = (val: unknown): string => {
  if (val === null || val === undefined) return '-'
  if (Array.isArray(val) && val.length === 0) return '-'
  if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val as Record<string, unknown>).length === 0) return '-'
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return '-'
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>测试环境管理</span>
        <el-button v-if="canWrite" type="primary" @click="createVisible = true">
          新建环境
        </el-button>
      </div>
    </template>

    <div class="filters">
      <el-input
        v-model="filters.name"
        placeholder="环境名称"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-input
        v-model="filters.env_code"
        placeholder="环境编码"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="environments" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="环境名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="env_code" label="环境编码" width="110" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row.env_code }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="base_url" label="Base URL" min-width="180" show-overflow-tooltip />
      <el-table-column label="主机" width="70" align="center">
        <template #default="{ row }">{{ Array.isArray(row.hosts) ? row.hosts.length : 0 }}</template>
      </el-table-column>
      <el-table-column label="DB" width="60" align="center">
        <template #default="{ row }">{{ Array.isArray(row.db_connections) ? row.db_connections.length : 0 }}</template>
      </el-table-column>
      <el-table-column label="中间件" width="80" align="center">
        <template #default="{ row }">{{ Array.isArray(row.middleware_info) ? row.middleware_info.length : 0 }}</template>
      </el-table-column>
      <el-table-column label="变量" width="60" align="center">
        <template #default="{ row }">{{ row.variables ? Object.keys(row.variables).length : 0 }}</template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
          <el-button v-if="canWrite" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
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
    <el-dialog v-model="createVisible" title="新建环境" width="640px" @close="resetCreateForm">
      <el-form :model="createForm" label-width="110px">
        <el-form-item label="环境名称" required>
          <el-input v-model="createForm.name" maxlength="128" show-word-limit placeholder="如：生产环境" />
        </el-form-item>
        <el-form-item label="环境编码" required>
          <el-input v-model="createForm.env_code" maxlength="64" show-word-limit placeholder="如：prod（项目内唯一）" />
        </el-form-item>
        <el-form-item label="Base URL">
          <el-input v-model="createForm.base_url" maxlength="512" placeholder="如：https://api.demo.com" />
        </el-form-item>
        <el-form-item label="主机清单">
          <el-input
            v-model="createForm.hosts"
            type="textarea"
            :rows="3"
            placeholder='[{"name":"app-01","host":"10.0.0.1","port":8080,"role":"应用"}]'
          />
        </el-form-item>
        <el-form-item label="数据库连接">
          <el-input
            v-model="createForm.db_connections"
            type="textarea"
            :rows="3"
            placeholder='[{"name":"订单库","type":"mysql","dsn":"mysql://10.0.0.3:3306/orders"}]'
          />
        </el-form-item>
        <el-form-item label="中间件清单">
          <el-input
            v-model="createForm.middleware_info"
            type="textarea"
            :rows="3"
            placeholder='[{"type":"redis","address":"10.0.0.2:6379","remark":"缓存"}]'
          />
        </el-form-item>
        <el-form-item label="环境变量">
          <el-input
            v-model="createForm.variables"
            type="textarea"
            :rows="3"
            placeholder='{"base_url":"https://api.demo.com"}'
          />
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
    <el-dialog v-model="editVisible" title="编辑环境" width="640px">
      <el-form :model="editForm" label-width="110px">
        <el-form-item label="环境名称" required>
          <el-input v-model="editForm.name" maxlength="128" show-word-limit />
        </el-form-item>
        <el-form-item label="环境编码" required>
          <el-input v-model="editForm.env_code" maxlength="64" show-word-limit />
        </el-form-item>
        <el-form-item label="Base URL">
          <el-input v-model="editForm.base_url" maxlength="512" />
        </el-form-item>
        <el-form-item label="主机清单">
          <el-input v-model="editForm.hosts" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="数据库连接">
          <el-input v-model="editForm.db_connections" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="中间件清单">
          <el-input v-model="editForm.middleware_info" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="环境变量">
          <el-input v-model="editForm.variables" type="textarea" :rows="3" />
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
    <el-dialog v-model="detailVisible" title="环境详情" width="720px">
      <el-descriptions v-if="detailEnv" :column="2" border>
        <el-descriptions-item label="ID">{{ detailEnv.id }}</el-descriptions-item>
        <el-descriptions-item label="所属项目">{{ detailEnv.project_id }}</el-descriptions-item>
        <el-descriptions-item label="环境名称">{{ detailEnv.name }}</el-descriptions-item>
        <el-descriptions-item label="环境编码">
          <el-tag size="small" type="info">{{ detailEnv.env_code }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Base URL" :span="2">{{ detailEnv.base_url || '-' }}</el-descriptions-item>
        <el-descriptions-item label="主机清单" :span="2">
          <pre class="json-block">{{ jsonPretty(detailEnv.hosts) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="数据库连接" :span="2">
          <pre class="json-block">{{ jsonPretty(detailEnv.db_connections) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="中间件清单" :span="2">
          <pre class="json-block">{{ jsonPretty(detailEnv.middleware_info) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="环境变量" :span="2">
          <pre class="json-block">{{ jsonPretty(detailEnv.variables) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ detailEnv.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detailEnv.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDateTime(detailEnv.updated_at) }}</el-descriptions-item>
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
.json-block {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
