<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { getThreadGroups } from '@/api/scripts'
import type { ScenarioScriptIn } from '@/types/api'
import ThreadGroupTable from './ThreadGroupTable.vue'

const props = defineProps<{ index: number; projectId: number }>()
const emit = defineEmits<{ remove: [] }>()

// 编辑态脚本关联：In 字段 + 仅展示用 script_name
type ScenarioScriptForm = ScenarioScriptIn & { script_name?: string }

// 双向同步整个脚本关联给父组件
const script = defineModel<ScenarioScriptForm>({ required: true })

// 当前脚本下【启用】线程组的线程数 / TPS 总和（纯展示，不提交后端）
const enabledGroups = computed(() => script.value.thread_groups.filter((g) => g.enabled))
const totalThreads = computed(() =>
  enabledGroups.value.reduce((sum, g) => sum + (g.num_threads || 0), 0),
)
const totalTps = computed(() =>
  enabledGroups.value.reduce((sum, g) => sum + (g.tps || 0), 0),
)

// agent_tags 是 string[]，输入框需要逗号字符串 ↔ 数组互转
const agentTagsStr = computed({
  get: () => (script.value.agent_tags || []).join(', '),
  set: (val: string) => {
    script.value.agent_tags = val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  },
})

// 挂载时按需拉取 JMX 线程组（已有则不重复拉，避免编辑场景重复请求）
onMounted(async () => {
  if (script.value.thread_groups.length) return
  try {
    const res = await getThreadGroups(props.projectId, script.value.script_id)
    script.value.thread_groups = res.thread_groups.map((tg) => ({
      thread_group_name: tg.name,
      testclass: tg.testclass,
      enabled: tg.enabled,
      num_threads: tg.num_threads,
      ramp_time: tg.ramp_time,
      // 扫描值 TPM/60 可能为小数，提交入参为 int TPS
      tps: Math.round(tg.tps),
    }))
  } catch {
    // 拦截器已弹 ElMessage
  }
})

const handleRemove = () => emit('remove')
</script>

<template>
  <el-card class="script-card" shadow="never">
    <template #header>
      <div class="card-head">
        <span class="card-title">
          <el-tag size="small" type="info">#{{ props.index + 1 }}</el-tag>
          {{ script.script_name || `script #${script.script_id}` }}
        </span>
        <el-button link type="danger" :icon="Delete" @click="handleRemove">
          移除
        </el-button>
      </div>
    </template>
    <div class="card-meta">
      <span class="meta-item meta-summary">
        <span class="meta-label">启用线程数</span>
        <span class="meta-value">{{ totalThreads }}</span>
      </span>
      <span class="meta-item meta-summary">
        <span class="meta-label">总 TPS</span>
        <span class="meta-value">{{ totalTps }}</span>
      </span>
      <label class="meta-item">
        <span class="meta-label">Agent 标签</span>
        <el-input
          v-model="agentTagsStr"
          placeholder="逗号分隔，如 prod,机房A"
          class="meta-tags"
        />
      </label>
      <label class="meta-item">
        <span class="meta-label">压力机数</span>
        <el-input-number v-model="script.agent_count" :min="1" :max="100" />
      </label>
    </div>
    <ThreadGroupTable v-model="script.thread_groups" />
  </el-card>
</template>

<style scoped lang="scss">
.script-card {
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color-light);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.card-meta {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.meta-label {
  white-space: nowrap;
}
.meta-tags {
  width: 240px;
}
.meta-summary {
  .meta-value {
    font-weight: 600;
    color: var(--el-color-primary);
  }
}
</style>
