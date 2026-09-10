<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listAgents } from '@/api/agents'
import type { Agent } from '@/types/api'
import { formatDateTime, formatPercent } from '@/utils/format'
import { agentStatusTagType, agentStatusText } from '@/utils/status'

const agents = ref<Agent[]>([])
const loading = ref(false)

const fetchData = async () => {
  loading.value = true
  try {
    agents.value = await listAgents()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>压力机列表</span>
        <el-button @click="fetchData">刷新</el-button>
      </div>
    </template>
    <el-table v-loading="loading" :data="agents" stripe>
      <el-table-column prop="agent_id" label="Agent ID" min-width="160" />
      <el-table-column prop="ip" label="IP" min-width="120" />
      <el-table-column prop="hostname" label="主机名" min-width="140" />
      <el-table-column label="标签" min-width="140">
        <template #default="{ row }">
          <el-tag v-for="t in row.tags || []" :key="t" size="small" class="tag-gap">{{ t }}</el-tag>
          <span v-if="!row.tags?.length">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="jmeter_version" label="JMeter" width="100" />
      <el-table-column label="规格" width="110">
        <template #default="{ row }">
          <span v-if="row.cpu_cores">{{ row.cpu_cores }}C / {{ row.mem_total_gb.toFixed(1) }}G</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="agentStatusTagType(row.status)">{{ agentStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="CPU" width="90">
        <template #default="{ row }">{{ formatPercent(row.cpu_percent) }}</template>
      </el-table-column>
      <el-table-column label="内存" width="90">
        <template #default="{ row }">{{ formatPercent(row.mem_percent) }}</template>
      </el-table-column>
      <el-table-column prop="current_run_no" label="当前运行" min-width="180">
        <template #default="{ row }">{{ row.current_run_no || '-' }}</template>
      </el-table-column>
      <el-table-column label="插件" min-width="140">
        <template #default="{ row }">
          <el-tooltip
            v-if="row.plugins?.length"
            :content="(row.plugins || []).join(', ')"
            placement="top"
          >
            <el-tag size="small">{{ row.plugins.length }} 个 jar</el-tag>
          </el-tooltip>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="最近心跳" width="180">
        <template #default="{ row }">{{ formatDateTime(row.last_heartbeat) }}</template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tag-gap {
  margin-right: 4px;
  margin-bottom: 4px;
}
</style>
