<script setup lang="ts">
import { computed } from 'vue'
import { SCENARIO_TYPE_OPTIONS, type ScenarioType } from '@/utils/status'

// 各字段独立 v-model，便于父组件按需绑定
const name = defineModel<string>('name', { required: true })
const scenarioType = defineModel<ScenarioType>('scenarioType', { required: true })
const duration = defineModel<number>('duration', { required: true })
const description = defineModel<string>('description', { required: true })
const paramOverridesStr = defineModel<string>('paramOverridesStr', {
  required: true,
})

// param_overrides 是对象，输入框需要 JSON 字符串 ↔ 对象互转
// 父组件持有 string 形式（便于校验），提交时再 JSON.parse
const paramOverridesError = computed(() => {
  if (!paramOverridesStr.value.trim()) return ''
  try {
    const parsed = JSON.parse(paramOverridesStr.value)
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      return '必须是 JSON 对象'
    }
    return ''
  } catch {
    return 'JSON 格式错误'
  }
})
</script>

<template>
  <el-form label-width="120px" class="basic-form">
    <el-form-item label="场景名称" required>
      <el-input
        v-model="name"
        placeholder="如：登录接口全链路压测"
        maxlength="128"
        show-word-limit
      />
    </el-form-item>
    <el-form-item label="场景类型" required>
      <el-select v-model="scenarioType" placeholder="选择场景类型" class="type-select">
        <el-option
          v-for="opt in SCENARIO_TYPE_OPTIONS"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="运行时长(秒)">
      <el-input-number v-model="duration" :min="0" :max="86400" />
      <span class="hint">0 表示由各线程组 duration 决定</span>
    </el-form-item>
    <el-form-item label="参数覆盖">
      <el-input
        v-model="paramOverridesStr"
        type="textarea"
        :rows="3"
        placeholder='{"host":"api.demo.com"}'
      />
      <span v-if="paramOverridesError" class="error-text">
        {{ paramOverridesError }}
      </span>
    </el-form-item>
    <el-form-item label="描述">
      <el-input
        v-model="description"
        type="textarea"
        :rows="2"
        maxlength="512"
        show-word-limit
      />
    </el-form-item>
  </el-form>
</template>

<style scoped lang="scss">
.basic-form {
  max-width: 720px;
}
.type-select {
  width: 200px;
}
.hint {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.error-text {
  color: var(--el-color-danger);
  font-size: 12px;
}
</style>
