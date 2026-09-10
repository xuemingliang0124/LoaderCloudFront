<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { listScripts } from '@/api/scripts'
import { createScenario, listScenarios } from '@/api/scenarios'
import type { Scenario, Script } from '@/types/api'

const scenarios = ref<Scenario[]>([])
const scripts = ref<Script[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  script_id: undefined as number | undefined,
  param_overrides: '{}',
  agent_tags: '',
  agent_count: 1,
  total_threads: 0,
  duration: 300,
  description: '',
})

const fetchData = async () => {
  loading.value = true
  try {
    const [scs, scs2] = await Promise.all([listScenarios(), listScripts()])
    scenarios.value = scs
    scripts.value = scs2
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.name = ''
  form.script_id = undefined
  form.param_overrides = '{}'
  form.agent_tags = ''
  form.agent_count = 1
  form.total_threads = 0
  form.duration = 300
  form.description = ''
}

const handleCreate = async () => {
  if (!form.script_id) {
    ElMessage.warning('请选择关联脚本')
    return
  }
  let paramOverrides: Record<string, unknown> = {}
  try {
    paramOverrides = JSON.parse(form.param_overrides || '{}')
  } catch {
    ElMessage.error('param_overrides 不是合法 JSON')
    return
  }

  submitting.value = true
  try {
    await createScenario({
      name: form.name,
      script_id: form.script_id,
      param_overrides: paramOverrides,
      agent_tags: form.agent_tags
        ? form.agent_tags.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      agent_count: form.agent_count,
      total_threads: form.total_threads,
      duration: form.duration,
      description: form.description,
    })
    ElMessage.success('创建成功')
    dialogVisible.value = false
    resetForm()
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    submitting.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>场景列表</span>
        <el-button type="primary" @click="dialogVisible = true">新建场景</el-button>
      </div>
    </template>
    <el-table v-loading="loading" :data="scenarios" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column label="关联脚本" width="120">
        <template #default="{ row }">
          script #{{ row.script_id }}
        </template>
      </el-table-column>
      <el-table-column label="Agent 标签" min-width="160">
        <template #default="{ row }">
          <el-tag v-for="t in row.agent_tags || []" :key="t" size="small" class="tag-gap">{{ t }}</el-tag>
          <span v-if="!row.agent_tags?.length">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="agent_count" label="压力机数" width="100" />
      <el-table-column label="时长(秒)" width="100" prop="duration" />
      <el-table-column label="参数覆盖" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          {{ JSON.stringify(row.param_overrides || {}) }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
    </el-table>

    <el-dialog v-model="dialogVisible" title="新建场景" width="560px" @close="resetForm">
      <el-form ref="formRef" :model="form" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="关联脚本" required>
          <el-select v-model="form.script_id" placeholder="选择脚本" style="width: 100%">
            <el-option
              v-for="s in scripts"
              :key="s.id"
              :label="`${s.name} (${s.version})`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Agent 标签">
          <el-input v-model="form.agent_tags" placeholder="逗号分隔，如 prod,locust" />
        </el-form-item>
        <el-form-item label="压力机数">
          <el-input-number v-model="form.agent_count" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="总线程数">
          <el-input-number v-model="form.total_threads" :min="0" :max="100000" />
          <span class="hint">0=每台全量加压，&gt;0 按 Agent CPU 核数拆分</span>
        </el-form-item>
        <el-form-item label="时长(秒)">
          <el-input-number v-model="form.duration" :min="1" :max="86400" />
        </el-form-item>
        <el-form-item label="参数覆盖">
          <el-input v-model="form.param_overrides" type="textarea" :rows="3" placeholder='{"k":"v"}' />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">创建</el-button>
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
.tag-gap {
  margin-right: 4px;
  margin-bottom: 4px;
}
</style>
