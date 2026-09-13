<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listScenarios } from '@/api/scenarios'
import { createSchedule, listSchedules, toggleSchedule } from '@/api/schedules'
import type { Schedule, Scenario } from '@/types/api'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'

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

const schedules = ref<Schedule[]>([])
const scenarios = ref<Scenario[]>([])
const total = ref(0)
const loading = ref(false)

// 查询条件（输入中的值，点查询后才同步到请求参数）
const filters = reactive({ name: '', enabled: '' as '' | 'true' | 'false' })
const page = reactive({ page: 1, page_size: 20 })

const dialogVisible = ref(false)
const submitting = ref(false)
const form = reactive({
  name: '',
  scenario_id: undefined as number | undefined,
  cron: '',
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listSchedules(projectId, {
      name: filters.name.trim() || undefined,
      enabled: filters.enabled === '' ? undefined : filters.enabled === 'true',
      page: page.page,
      page_size: page.page_size,
    })
    schedules.value = res.items
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
  filters.enabled = ''
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

// 场景下拉数据：打开新建弹窗时再拉取（主数据量小，取首页 100 条上限）
const openCreate = async () => {
  dialogVisible.value = true
  try {
    const res = await listScenarios(projectId, { page: 1, page_size: 100 })
    scenarios.value = res.items
  } catch {
    // 拦截器已弹 ElMessage
  }
}

const resetForm = () => {
  form.name = ''
  form.scenario_id = undefined
  form.cron = ''
}

const handleCreate = async () => {
  if (!form.name || !form.scenario_id || !form.cron) {
    ElMessage.warning('请填写完整')
    return
  }
  submitting.value = true
  try {
    await createSchedule(projectId, {
      name: form.name,
      scenario_id: form.scenario_id,
      cron: form.cron,
    })
    ElMessage.success('创建成功')
    dialogVisible.value = false
    resetForm()
    page.page = 1
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（cron 非法走 4001）
  } finally {
    submitting.value = false
  }
}

const handleToggle = async (row: Schedule) => {
  try {
    await toggleSchedule(projectId, row.id)
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>定时任务</span>
        <el-button v-if="canWrite" type="primary" @click="openCreate">新建定时</el-button>
      </div>
    </template>
    <div class="filters">
      <el-input
        v-model="filters.name"
        placeholder="任务名称"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select
        v-model="filters.enabled"
        placeholder="状态"
        clearable
        class="filter-select"
        @change="handleSearch"
      >
        <el-option label="启用" value="true" />
        <el-option label="停用" value="false" />
      </el-select>
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>
    <el-table v-loading="loading" :data="schedules" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column label="关联场景" width="120">
        <template #default="{ row }">scenario #{{ row.scenario_id }}</template>
      </el-table-column>
      <el-table-column prop="cron" label="Cron 表达式" min-width="160" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="last_run_no" label="最近运行" min-width="200">
        <template #default="{ row }">{{ row.last_run_no || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canWrite"
            link
            :type="row.enabled ? 'danger' : 'primary'"
            @click="handleToggle(row)"
          >
            {{ row.enabled ? '停用' : '启用' }}
          </el-button>
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

    <el-dialog v-model="dialogVisible" title="新建定时任务" width="480px" @close="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="关联场景" required>
          <el-select v-model="form.scenario_id" placeholder="选择场景" style="width: 100%">
            <el-option
              v-for="s in scenarios"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Cron 表达式" required>
          <el-input v-model="form.cron" placeholder="分 时 日 月 周，如 */5 * * * *" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">创建</el-button>
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
.filter-select {
  width: 140px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
