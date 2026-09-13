<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import {
  createProject,
  deleteProject,
  listProjects,
  precheckProjectDelete,
  updateProject,
} from '@/api/projects'
import { useProjectStore } from '@/stores/project'
import type { Project, ProjectDeletePrecheck } from '@/types/api'

const router = useRouter()
const projectStore = useProjectStore()

const projects = ref<Project[]>([])
const total = ref(0)
const loading = ref(false)

const filters = reactive({ name: '' })
const page = reactive({ page: 1, page_size: 20 })

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listProjects({
      name: filters.name.trim() || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    projects.value = res.items
    total.value = res.total
    // 同步到 project store 的缓存（供项目切换器使用）
    projectStore.projects = res.items
    projectStore.syncCurrentProject()
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

// ===== 进入项目 =====
const handleEnter = (row: Project) => {
  projectStore.setCurrent(row.id)
  router.push(`/projects/${row.id}/scripts`)
}

// ===== 新建项目 =====
const createVisible = ref(false)
const createSubmitting = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive({ name: '', description: '' })

const openCreate = () => {
  createForm.name = ''
  createForm.description = ''
  createVisible.value = true
}

const handleCreate = async () => {
  if (!createForm.name.trim()) {
    ElMessage.warning('项目名称不能为空')
    return
  }
  createSubmitting.value = true
  try {
    const created = await createProject({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
    })
    ElMessage.success('创建成功')
    createVisible.value = false
    page.page = 1
    await fetchData()
    // 创建者自动成为 owner，直接进入新项目
    projectStore.setCurrent(created.id)
    router.push(`/projects/${created.id}/scripts`)
  } catch {
    // 拦截器已弹 ElMessage（名称重复 3020 等）
  } finally {
    createSubmitting.value = false
  }
}

// ===== 编辑项目（owner+）=====
const editVisible = ref(false)
const editSubmitting = ref(false)
const editFormRef = ref<FormInstance>()
const editTarget = ref<Project | null>(null)
const editForm = reactive({ name: '', description: '' })

const openEdit = (row: Project) => {
  editTarget.value = row
  editForm.name = row.name
  editForm.description = row.description
  editVisible.value = true
}

const handleEdit = async () => {
  if (!editTarget.value) return
  const name = editForm.name.trim()
  const description = editForm.description.trim()
  if (!name && !description) {
    ElMessage.warning('名称与描述至少修改一项')
    return
  }
  if (name === editTarget.value.name && description === editTarget.value.description) {
    ElMessage.warning('未做任何修改')
    return
  }
  editSubmitting.value = true
  try {
    await updateProject(editTarget.value.id, {
      name: name || undefined,
      description: description !== editTarget.value.description ? description : undefined,
    })
    ElMessage.success('更新成功')
    editVisible.value = false
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（名称重复 3020 / 角色不足 3031 等）
  } finally {
    editSubmitting.value = false
  }
}

// 是否可编辑/删除：admin 恒为项目管理员，非 admin 需 my_role === 项目管理员
const canManage = (row: Project) => row.my_role === '项目管理员'

// ===== 删除（owner+，预检 + force 级联）=====
const handleDelete = async (row: Project) => {
  let pre: ProjectDeletePrecheck
  try {
    pre = await precheckProjectDelete(row.id)
  } catch {
    // 拦截器已弹 ElMessage
    return
  }

  // 存在未结束执行任务：严格/强制均不允许，需先停止
  if (pre.running_runs > 0) {
    ElMessage.warning(`项目下存在 ${pre.running_runs} 个未结束的执行任务，请先停止后再删除`)
    return
  }

  const needForce = pre.scripts > 0 || pre.scenarios > 0 || pre.schedule_jobs.length > 0
  const message = needForce
    ? h('div', [
        h('p', { style: 'margin: 0 0 8px;' }, `确认强制删除项目「${row.name}」？存在关联资产，将级联清理：`),
        h(
          'ul',
          { style: 'margin: 0; padding-left: 20px;' },
          [
            pre.scripts > 0 ? h('li', `脚本 ${pre.scripts} 个`) : null,
            pre.scenarios > 0 ? h('li', `场景 ${pre.scenarios} 个`) : null,
            pre.schedule_jobs.length
              ? h(
                  'li',
                  `定时任务 ${pre.schedule_jobs.length} 个：${pre.schedule_jobs
                    .slice(0, 5)
                    .map((j) => j.name)
                    .join('、')}${pre.schedule_jobs.length > 5 ? ' 等' : ''}`,
                )
              : null,
          ].filter(Boolean),
        ),
        h('p', { style: 'margin: 8px 0 0; color: var(--el-color-danger);' }, '删除后不可恢复！'),
      ])
    : `确认删除项目「${row.name}」？项目及其成员关系将一并删除，删除后不可恢复。`

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
    const res = await deleteProject(row.id, needForce)
    if (needForce) {
      ElMessage.success(
        `删除成功，已清理 ${res.removed_scripts} 个脚本、${res.removed_scenarios} 个场景` +
          (res.removed_runs ? `、${res.removed_runs} 条执行记录` : '') +
          (res.removed_schedules ? `、${res.removed_schedules} 个定时任务` : '') +
          (res.removed_artifacts ? `、${res.removed_artifacts} 个产物文件` : ''),
      )
    } else {
      ElMessage.success('删除成功')
    }
    // 若删除的是当前项目，清空选择
    if (projectStore.currentProjectId === row.id) {
      projectStore.currentProjectId = null
      localStorage.removeItem('ptp_current_project')
    }
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（运行中 3014 / 有资产 3023 等）
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>项目列表</span>
        <el-button type="primary" @click="openCreate">新建项目</el-button>
      </div>
    </template>

    <div class="filters">
      <el-input
        v-model="filters.name"
        placeholder="项目名称"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="projects" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="150" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="created_by" label="创建人" width="110" />
      <el-table-column label="我的角色" width="100" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.my_role === '项目管理员' ? 'success' : 'info'">
            {{ row.my_role || '观察者' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="handleEnter(row)">进入</el-button>
          <el-button
            v-if="canManage(row)"
            link
            type="primary"
            size="small"
            @click="openEdit(row)"
          >编辑</el-button>
          <el-button
            v-if="canManage(row)"
            link
            type="danger"
            size="small"
            @click="handleDelete(row)"
          >删除</el-button>
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

    <!-- 新建项目 -->
    <el-dialog v-model="createVisible" title="新建项目" width="480px" @close="createFormRef?.resetFields">
      <el-form ref="createFormRef" :model="createForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="createForm.name" maxlength="128" placeholder="1-128 个字符" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="2"
            maxlength="512"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑项目 -->
    <el-dialog v-model="editVisible" title="编辑项目" width="480px" @close="editFormRef?.resetFields">
      <el-form ref="editFormRef" :model="editForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editForm.name" maxlength="128" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="2"
            maxlength="512"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEdit">保存</el-button>
      </template>
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
</style>
