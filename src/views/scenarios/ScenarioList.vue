<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listScenarios } from '@/api/scenarios'
import type { Scenario } from '@/types/api'
import { scenarioTypeTagType } from '@/utils/status'

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
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
