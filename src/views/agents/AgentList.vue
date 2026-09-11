<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { listAgents } from '@/api/agents'
import type { Agent } from '@/types/api'
import { formatDateTime, formatPercent } from '@/utils/format'
import { agentStatusTagType, agentStatusText } from '@/utils/status'

const agents = ref<Agent[]>([])
const total = ref(0)
const loading = ref(false)

// 查询条件（输入中的值，点查询后才同步到请求参数）
const filters = reactive({ keyword: '', status: '' })
const page = reactive({ page: 1, page_size: 20 })

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listAgents({
      keyword: filters.keyword.trim() || undefined,
      status: filters.status || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    agents.value = res.items
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
  filters.keyword = ''
  filters.status = ''
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
    <div class="filters">
      <el-input
        v-model="filters.keyword"
        placeholder="Agent ID / IP / 主机名"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select v-model="filters.status" placeholder="状态" clearable class="filter-select" @change="handleSearch">
        <el-option label="在线" value="online" />
        <el-option label="繁忙" value="busy" />
        <el-option label="离线" value="offline" />
      </el-select>
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>
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
.tag-gap {
  margin-right: 4px;
  margin-bottom: 4px;
}
</style>
