<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { createScenario } from '@/api/scenarios'
import type { ScenarioScript, Script } from '@/types/api'
import type { ScenarioType } from '@/utils/status'
import ScenarioBasicForm from './components/ScenarioBasicForm.vue'
import ScriptPicker from './components/ScriptPicker.vue'
import ScenarioScriptCard from './components/ScenarioScriptCard.vue'

const router = useRouter()
const submitting = ref(false)
const pickerVisible = ref(false)

// 页面唯一 state owner，子组件通过 v-model 同步
const form = reactive({
  name: '',
  scenario_type: '单交易基准' as ScenarioType,
  duration: 300,
  description: '',
  param_overrides_str: '{}',
  scripts: [] as ScenarioScript[],
})

// 已选脚本 id（用于 picker 标记/禁用重复添加）
const excludeIds = reactive([]) as number[]

const handleAddScripts = (selected: Script[]) => {
  for (const s of selected) {
    // 后端 code 3011 会校验同场景内脚本唯一，前端先拦住体验更好
    if (form.scripts.some((x) => x.script_id === s.id)) continue
    form.scripts.push({
      script_id: s.id,
      script_name: s.name,
      order_index: form.scripts.length,
      agent_tags: [],
      agent_count: 1,
      thread_groups: [],
    })
  }
  // 同步到 excludeIds
  excludeIds.splice(0, excludeIds.length, ...form.scripts.map((s) => s.script_id))
}

const handleRemoveScript = (index: number) => {
  form.scripts.splice(index, 1)
  // 重排 order_index
  form.scripts.forEach((s, i) => (s.order_index = i))
  excludeIds.splice(0, excludeIds.length, ...form.scripts.map((s) => s.script_id))
}

const handleSubmit = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请填写场景名称')
    return
  }
  if (!form.scripts.length) {
    ElMessage.warning('至少添加一个脚本')
    return
  }

  // 解析 param_overrides
  let paramOverrides: Record<string, unknown> = {}
  const raw = form.param_overrides_str.trim()
  if (raw) {
    try {
      paramOverrides = JSON.parse(raw)
    } catch {
      ElMessage.error('参数覆盖不是合法 JSON')
      return
    }
  }

  submitting.value = true
  try {
    // 提交前剥离 script_name（前端展示用字段，后端不接受）
    const payload = {
      name: form.name,
      scenario_type: form.scenario_type,
      duration: form.duration,
      description: form.description,
      param_overrides: paramOverrides,
      scripts: form.scripts.map((s) => ({
        script_id: s.script_id,
        order_index: s.order_index,
        agent_tags: s.agent_tags,
        agent_count: s.agent_count,
        thread_groups: s.thread_groups,
      })),
    }
    await createScenario(payload)
    ElMessage.success('创建成功')
    router.push('/scenarios')
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    submitting.value = false
  }
}

const handleCancel = () => router.push('/scenarios')
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>新建场景</span>
        <div class="header-actions">
          <el-button @click="handleCancel">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            保存
          </el-button>
        </div>
      </div>
    </template>

    <!-- 基础信息区块 -->
    <div class="section">
      <div class="section-title">基础信息</div>
      <ScenarioBasicForm
        v-model:name="form.name"
        v-model:scenario-type="form.scenario_type"
        v-model:duration="form.duration"
        v-model:description="form.description"
        v-model:param-overrides-str="form.param_overrides_str"
      />
    </div>

    <!-- 关联脚本区块 -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">关联脚本</span>
        <el-button type="primary" :icon="Plus" @click="pickerVisible = true">
          添加脚本
        </el-button>
      </div>
      <ScenarioScriptCard
        v-for="(s, i) in form.scripts"
        :key="s.script_id"
        :index="i"
        v-model="form.scripts[i]"
        @remove="handleRemoveScript(i)"
      />
      <el-empty v-if="!form.scripts.length" description="尚未添加脚本" />
    </div>

    <ScriptPicker
      v-model:visible="pickerVisible"
      :exclude="excludeIds"
      @select="handleAddScripts"
    />
  </el-card>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.section {
  margin-bottom: 24px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  .section-title {
    margin-bottom: 0;
  }
}
</style>
