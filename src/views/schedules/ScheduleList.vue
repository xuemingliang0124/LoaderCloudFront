<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listScenarios } from '@/api/scenarios'
import { createSchedule, listSchedules, toggleSchedule } from '@/api/schedules'
import type { Schedule, Scenario } from '@/types/api'

const schedules = ref<Schedule[]>([])
const scenarios = ref<Scenario[]>([])
const loading = ref(false)

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
    const [scs, scen] = await Promise.all([listSchedules(), listScenarios()])
    schedules.value = scs
    scenarios.value = scen
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
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
    await createSchedule({
      name: form.name,
      scenario_id: form.scenario_id,
      cron: form.cron,
    })
    ElMessage.success('创建成功')
    dialogVisible.value = false
    resetForm()
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（cron 非法走 4001）
  } finally {
    submitting.value = false
  }
}

const handleToggle = async (row: Schedule) => {
  try {
    await toggleSchedule(row.id)
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
        <el-button type="primary" @click="dialogVisible = true">新建定时</el-button>
      </div>
    </template>
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
          <el-button link :type="row.enabled ? 'danger' : 'primary'" @click="handleToggle(row)">
            {{ row.enabled ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

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
</style>
