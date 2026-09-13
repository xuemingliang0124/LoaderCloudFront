<script setup lang="ts">
import type { ThreadGroupSettingIn } from '@/types/api'

// 双向同步线程组编辑结果给父组件（state 单一来源在 ScenarioCreate）
// tps/enabled 为后端正式字段；pacing 仅前端计算展示
const model = defineModel<ThreadGroupSettingIn[]>({ required: true })

// pacing = 线程数 / TPS（秒）；TPS 非法或为 0 时无法计算
const pacingOf = (row: ThreadGroupSettingIn): string => {
  if (!row.enabled || !(row.tps > 0)) return '-'
  return (row.num_threads / row.tps).toFixed(2)
}

const toggleEnabled = (row: ThreadGroupSettingIn) => {
  row.enabled = !row.enabled
}
</script>

<template>
  <el-table :data="model" border size="small" row-key="thread_group_name">
    <el-table-column prop="thread_group_name" label="线程组" min-width="140" />
    <el-table-column prop="testclass" label="类型" width="130" />
    <el-table-column label="线程数" width="100">
      <template #default="{ row }">
        <el-input-number
          v-model="row.num_threads"
          :min="1"
          :max="100000"
          :controls="false"
          :disabled="!row.enabled"
          class="num-input"
        />
      </template>
    </el-table-column>
    <el-table-column label="TPS" width="100">
      <template #default="{ row }">
        <el-input-number
          v-model="row.tps"
          :min="0"
          :max="1000000"
          :controls="false"
          :disabled="!row.enabled"
          class="num-input"
        />
      </template>
    </el-table-column>
    <el-table-column label="RampUp(秒)" width="100">
      <template #default="{ row }">
        <el-input-number
          v-model="row.ramp_time"
          :min="0"
          :max="86400"
          :controls="false"
          :disabled="!row.enabled"
          class="num-input"
        />
      </template>
    </el-table-column>
    <el-table-column label="Pacing(秒)" width="100" align="center">
      <template #default="{ row }">
        <span class="pacing-text" :class="{ 'is-disabled': !row.enabled }">
          {{ pacingOf(row) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="80" align="center">
      <template #default="{ row }">
        <el-button
          link
          size="small"
          :type="row.enabled ? 'danger' : 'primary'"
          @click="toggleEnabled(row)"
        >
          {{ row.enabled ? '禁用' : '启用' }}
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped lang="scss">
.num-input {
  width: 80px;
  :deep(.el-input__inner) {
    text-align: center;
  }
}
.pacing-text {
  color: var(--el-text-color-regular);
  &.is-disabled {
    color: var(--el-text-color-disabled);
  }
}
</style>
