<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { createScenario, listScenarios, updateScenario } from '@/api/scenarios'
import type { Scenario, ScenarioScriptIn, Script } from '@/types/api'
import type { ScenarioType } from '@/utils/status'
import ScenarioBasicForm from './components/ScenarioBasicForm.vue'
import ScriptPicker from './components/ScriptPicker.vue'
import ScenarioScriptCard from './components/ScenarioScriptCard.vue'

const route = useRoute()
const router = useRouter()
const projectId = Number(route.params.projectId)

// 路由含 :scenarioId 时为编辑态（复用本创建页）
const scenarioId = Number(route.params.scenarioId)
const isEdit = computed(() => !Number.isNaN(scenarioId) && scenarioId > 0)

const submitting = ref(false)
const loading = ref(false)
const pickerVisible = ref(false)
const basicFormRef = ref<InstanceType<typeof ScenarioBasicForm>>()

// 页面唯一 state owner，子组件通过 v-model 同步
// 编辑态脚本关联 = 提交字段 + 仅展示用 script_name
type FormScript = ScenarioScriptIn & { script_name?: string }
const form = reactive({
  name: '',
  scenario_type: '单交易基准' as ScenarioType,
  duration: 300,
  description: '',
  param_overrides_str: '{}',
  scripts: [] as FormScript[],
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

// ---- 编辑态：详情回填 ----
const fillFromScenario = (s: Scenario) => {
  form.name = s.name
  form.scenario_type = s.scenario_type
  form.duration = s.duration ?? 300
  form.description = s.description || ''
  form.param_overrides_str = JSON.stringify(s.param_overrides ?? {}, null, 2)
  // 浅拷贝关联数据，避免直接改动列表页经 history.state 传入的行对象
  form.scripts = s.scripts.map((x) => ({
    script_id: x.script_id,
    script_name: x.script_name,
    order_index: x.order_index,
    agent_tags: [...(x.agent_tags || [])],
    agent_count: x.agent_count,
    thread_groups: x.thread_groups.map((t) => ({
      thread_group_name: t.thread_group_name,
      testclass: t.testclass,
      enabled: t.enabled,
      num_threads: t.num_threads,
      ramp_time: t.ramp_time,
      tps: t.tps,
    })),
  }))
  excludeIds.splice(0, excludeIds.length, ...form.scripts.map((s2) => s2.script_id))
}

onMounted(async () => {
  if (!isEdit.value) return
  // 列表跳转时行数据随 history.state 传入，免一次请求
  const passed = (window.history.state as { scenario?: Scenario } | null)?.scenario
  if (passed && passed.id === scenarioId) {
    fillFromScenario(passed)
    return
  }
  // 刷新/直链进入（state 丢失）：后端无单条详情端点，拉首页列表按 id 兜底
  loading.value = true
  try {
    const res = await listScenarios(projectId, { page: 1, page_size: 100 })
    const found = res.items.find((x) => x.id === scenarioId)
    if (!found) {
      ElMessage.error('场景不存在或无权访问')
      router.replace(`/projects/${projectId}/scenarios`)
      return
    }
    fillFromScenario(found)
  } catch {
    // 拦截器已弹 ElMessage，退回列表避免停留在空白表单
    router.replace(`/projects/${projectId}/scenarios`)
  } finally {
    loading.value = false
  }
})

const handleSubmit = async () => {
  // 基础信息（名称/描述）走 el-form 规则校验，不通过时字段下方显示错误
  const basicForm = basicFormRef.value
  const formValid = basicForm
    ? await basicForm.validate().catch(() => false)
    : true
  if (!formValid) return
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
    // 提交前剥离 script_name（前端展示用字段，后端不接受）；名称去首尾空白
    const payload = {
      name: form.name.trim(),
      scenario_type: form.scenario_type,
      duration: form.duration,
      description: form.description,
      param_overrides: paramOverrides,
      scripts: form.scripts.map((s) => ({
        script_id: s.script_id,
        order_index: s.order_index,
        agent_tags: s.agent_tags,
        agent_count: s.agent_count,
        // 剥离 script_name（展示用字段），其余含 tps/enabled 原样提交
        thread_groups: s.thread_groups.map((t) => ({
          thread_group_name: t.thread_group_name,
          testclass: t.testclass,
          enabled: t.enabled,
          num_threads: t.num_threads,
          ramp_time: t.ramp_time,
          tps: t.tps,
        })),
      })),
    }
    await (isEdit.value
      ? updateScenario(projectId, scenarioId, payload)
      : createScenario(projectId, payload))
    ElMessage.success(isEdit.value ? '保存成功' : '创建成功')
    router.push(`/projects/${projectId}/scenarios`)
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    submitting.value = false
  }
}

const handleCancel = () => router.push(`/projects/${projectId}/scenarios`)
</script>

<template>
  <el-card v-loading="loading">
    <template #header>
      <div class="header">
        <span>{{ isEdit ? '编辑场景' : '新建场景' }}</span>
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
        ref="basicFormRef"
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
        :project-id="projectId"
        v-model="form.scripts[i]"
        @remove="handleRemoveScript(i)"
      />
      <el-empty v-if="!form.scripts.length" description="尚未添加脚本" />
    </div>

    <ScriptPicker
      v-model:visible="pickerVisible"
      :project-id="projectId"
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
