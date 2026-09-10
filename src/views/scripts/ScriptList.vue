<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadRawFile, FormInstance } from 'element-plus'
import { listScripts, uploadScript } from '@/api/scripts'
import type { Script, ScriptAttachment } from '@/types/api'

const pluginNames = (plugins: ScriptAttachment[] | null | undefined): string =>
  (plugins || []).map((p) => p.filename).join(', ')

const scripts = ref<Script[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const uploading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  version: 'v1',
  description: '',
  params: '[]',
})

const jmxFile = ref<File | null>(null)
const dataFiles = ref<File[]>([])
const pluginFiles = ref<File[]>([])

const fetchData = async () => {
  loading.value = true
  try {
    scripts.value = await listScripts()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
}

const handleJmxChange = (file: UploadFile) => {
  const raw = file.raw as UploadRawFile
  if (!raw.name.toLowerCase().endsWith('.jmx')) {
    ElMessage.error('仅支持上传 .jmx 文件')
    return
  }
  jmxFile.value = raw as unknown as File
}

const handleDataFilesChange = (file: UploadFile) => {
  dataFiles.value.push(file.raw as unknown as File)
}

const handleRemoveDataFile = (file: UploadFile) => {
  const target = file.raw as unknown as File
  dataFiles.value = dataFiles.value.filter((f) => f.name !== target.name)
}

const handlePluginFilesChange = (file: UploadFile) => {
  pluginFiles.value.push(file.raw as unknown as File)
}

const handleRemovePluginFile = (file: UploadFile) => {
  const target = file.raw as unknown as File
  pluginFiles.value = pluginFiles.value.filter((f) => f.name !== target.name)
}

const resetForm = () => {
  form.name = ''
  form.version = 'v1'
  form.description = ''
  form.params = '[]'
  jmxFile.value = null
  dataFiles.value = []
  pluginFiles.value = []
}

const handleUpload = async () => {
  if (!jmxFile.value) {
    ElMessage.warning('请选择 JMX 脚本文件')
    return
  }
  // 校验 params 是合法 JSON（后端会再校验一次，code 3002）
  try {
    JSON.parse(form.params)
  } catch {
    ElMessage.error('params 不是合法 JSON')
    return
  }

  const formData = new FormData()
  formData.append('file', jmxFile.value)
  formData.append('name', form.name || jmxFile.value.name.replace(/\.jmx$/i, ''))
  formData.append('version', form.version)
  formData.append('description', form.description)
  formData.append('params', form.params)
  // 数据文件字段名 data_files；插件 jar 字段名 plugin_files（后端 multipart 约定）
  dataFiles.value.forEach((f) => formData.append('data_files', f))
  pluginFiles.value.forEach((f) => formData.append('plugin_files', f))

  uploading.value = true
  try {
    await uploadScript(formData)
    ElMessage.success('上传成功')
    dialogVisible.value = false
    resetForm()
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    uploading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>脚本列表</span>
        <el-button type="primary" @click="dialogVisible = true">上传脚本</el-button>
      </div>
    </template>
    <el-table v-loading="loading" :data="scripts" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="150" />
      <el-table-column prop="version" label="版本" width="90" />
      <el-table-column prop="file_key" label="文件 Key" min-width="180" show-overflow-tooltip />
      <el-table-column label="数据文件" min-width="150">
        <template #default="{ row }">
          <el-tag v-for="df in row.data_files || []" :key="df.key" size="small" class="tag-gap">
            {{ df.filename }}
          </el-tag>
          <span v-if="!row.data_files?.length">-</span>
        </template>
      </el-table-column>
      <el-table-column label="插件" min-width="120">
        <template #default="{ row }">
          <el-tooltip
            v-if="row.plugins?.length"
            :content="pluginNames(row.plugins)"
            placement="top"
          >
            <el-tag size="small" type="warning">{{ row.plugins.length }} 个 jar</el-tag>
          </el-tooltip>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="参数" width="80">
        <template #default="{ row }">
          <span v-if="row.params?.length">{{ row.params.length }} 项</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
    </el-table>

    <el-dialog v-model="dialogVisible" title="上传脚本" width="560px" @close="resetForm">
      <el-form ref="formRef" :model="form" label-width="100px">
        <el-form-item label="JMX 文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="handleJmxChange"
            :on-exceed="() => ElMessage.warning('只能上传 1 个 JMX 文件')"
            accept=".jmx"
          >
            <el-button type="primary">选择 JMX</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="留空则用文件名" />
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="form.version" />
        </el-form-item>
        <el-form-item label="数据文件">
          <el-upload
            :auto-upload="false"
            multiple
            :on-change="handleDataFilesChange"
            :on-remove="handleRemoveDataFile"
            accept=".csv,.txt,.dat,.tsv"
          >
            <el-button>选择数据文件</el-button>
            <template #tip>
              <div class="tip">仅支持 .csv / .txt / .dat / .tsv；JMX 引用的数据文件必须全部上传（后端 code 3006 校验）</div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="插件 jar">
          <el-upload
            :auto-upload="false"
            multiple
            :on-change="handlePluginFilesChange"
            :on-remove="handleRemovePluginFile"
            accept=".jar"
          >
            <el-button>选择插件 jar</el-button>
            <template #tip>
              <div class="tip">JMX 使用的第三方插件；Agent 缺失时随任务自动下发，免改镜像</div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="参数">
          <el-input v-model="form.params" type="textarea" :rows="3" placeholder='[{"key":"k","default":"v","desc":"说明"}]' />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload">上传</el-button>
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
.tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
