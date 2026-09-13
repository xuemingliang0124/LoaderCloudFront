<script setup lang="ts">
import type { ThreadGroupSetting } from '@/types/api'

// 双向同步线程组编辑结果给父组件（state 单一来源在 ScenarioCreate）
const model = defineModel<ThreadGroupSetting[]>({ required: true })
</script>

<template>
  <el-table :data="model" border size="small" row-key="thread_group_name">
    <el-table-column prop="thread_group_name" label="线程组" min-width="140" />
    <el-table-column prop="testclass" label="类型" width="140" />
    <el-table-column label="线程数" width="110">
      <template #default="{ row }">
        <el-input-number
          v-model="row.num_threads"
          :min="1"
          :max="100000"
          :controls="false"
          class="num-input"
        />
      </template>
    </el-table-column>
    <el-table-column label="RampUp(秒)" width="110">
      <template #default="{ row }">
        <el-input-number
          v-model="row.ramp_time"
          :min="0"
          :max="86400"
          :controls="false"
          class="num-input"
        />
      </template>
    </el-table-column>
    <el-table-column label="循环次数" width="110">
      <template #default="{ row }">
        <el-input-number
          v-model="row.loops"
          :min="-1"
          :max="100000"
          :controls="false"
          class="num-input"
        />
      </template>
    </el-table-column>
    <el-table-column label="调度器" width="80" align="center">
      <template #default="{ row }">
        <el-switch v-model="row.scheduler" />
      </template>
    </el-table-column>
    <el-table-column label="持续(秒)" width="110">
      <template #default="{ row }">
        <el-input-number
          v-model="row.duration"
          :min="0"
          :max="86400"
          :disabled="!row.scheduler"
          :controls="false"
          class="num-input"
        />
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped lang="scss">
.num-input {
  width: 88px;
  :deep(.el-input__inner) {
    text-align: center;
  }
}
</style>
