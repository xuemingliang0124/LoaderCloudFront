<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listScenarios } from '@/api/scenarios'
import { listAgents } from '@/api/agents'
import { createRun, listRuns, stopRun } from '@/api/runs'
import type { Agent, PageResult, Run, Scenario } from '@/types/api'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'
import {
  RUN_TRIGGER_TEXT,
  isAgentSelectable,
  isRunStoppable,
  runStatusTagType,
  runStatusText,
} from '@/utils/status'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const auth = useAuthStore()
const projectId = Number(route.params.projectId)

// 写操作权限：admin 或项目编辑者+
const canWrite = computed(() => {
  if (auth.isAdmin) return true
  const p = projectStore.projects.find((x) => x.id === projectId)
  return projectStore.hasRole(p, '编辑者')
})

const runs = ref<Run[]>([])
const total = ref(0)
const loading = ref(false)
const page = reactive({ page: 1, page_size: 20 })

const scenarios = ref<Scenario[]>([])
const agents = ref<Agent[]>([])

const dialogVisible = ref(false)
const submitting = ref(false)
const form = reactive({
  scenario_id: undefined as number | undefined,
  agent_ids: [] as string[],
})

const fetchData = async () => {
  loading.value = true
  try {
    const res: PageResult<Run> = await listRuns(projectId, page.page, page.page_size)
    runs.value = res.items
    total.value = res.total
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
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

const openCreate = async () => {
  dialogVisible.value = true
  try {
    // 下拉用主数据，量小，取首页 100 条上限
    const [scs, ags] = await Promise.all([
      listScenarios(projectId, { page: 1, page_size: 100 }),
      listAgents({ page: 1, page_size: 100 }),
    ])
    scenarios.value = scs.items
    agents.value = ags.items
  } catch {
    // 拦截器已弹 ElMessage
  }
}

const handleCreate = async () => {
  if (!form.scenario_id) {
    ElMessage.warning('请选择场景')
    return
  }
  submitting.value = true
  try {
    const result = await createRun(
      projectId,
      form.scenario_id,
      form.agent_ids.length ? form.agent_ids : undefined,
    )
    ElMessage.success(`已下发，run_no=${result.run_no}，选中 ${result.agent_ids.length} 台 Agent`)
    dialogVisible.value = false
    form.scenario_id = undefined
    form.agent_ids = []
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    submitting.value = false
  }
}

const handleStop = async (row: Run) => {
  try {
    await stopRun(projectId, row.run_no)
    ElMessage.success('停止指令已下发')
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
        <span>运行记录</span>
        <el-button v-if="canWrite" type="primary" @click="openCreate">新建运行</el-button>
      </div>
    </template>
    <el-table v-loading="loading" :data="runs" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="run_no" label="Run No" min-width="200" />
      <el-table-column label="场景" width="100">
        <template #default="{ row }">scenario #{{ row.scenario_id }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="runStatusTagType(row.status)">{{ runStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="触发方式" width="90">
        <template #default="{ row }">{{ RUN_TRIGGER_TEXT[row.trigger] || row.trigger }}</template>
      </el-table-column>
      <el-table-column label="Agent" min-width="100">
        <template #default="{ row }">
          <span v-if="row.agent_ids?.length">{{ row.agent_ids.length }} 台</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="开始时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.start_time) }}</template>
      </el-table-column>
      <el-table-column label="结束时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.end_time) }}</template>
      </el-table-column>
      <el-table-column prop="error_message" label="错误信息" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/projects/${projectId}/runs/${row.run_no}`)">详情</el-button>
          <el-button
            v-if="canWrite"
            link
            type="danger"
            :disabled="!isRunStoppable(row.status)"
            @click="handleStop(row)"
          >
            停止
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

    <el-dialog v-model="dialogVisible" title="新建运行" width="480px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="场景" required>
          <el-select v-model="form.scenario_id" placeholder="选择场景" style="width: 100%">
            <el-option
              v-for="s in scenarios"
              :key="s.id"
              :label="`${s.name} (${s.scripts?.length || 0} 脚本)`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="指定 Agent">
          <el-select
            v-model="form.agent_ids"
            multiple
            placeholder="留空则按场景配置自动选机"
            style="width: 100%"
          >
            <el-option
              v-for="a in agents"
              :key="a.agent_id"
              :label="`${a.agent_id} (${a.ip})`"
              :value="a.agent_id"
              :disabled="!isAgentSelectable(a.status)"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">下发</el-button>
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
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
