<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type {
  UploadFile,
  UploadRawFile,
  UploadInstance,
  FormInstance,
} from 'element-plus'
import { listScripts, uploadScript, replaceScriptJmx, deleteScript } from '@/api/scripts'
import type { Script } from '@/types/api'

const scripts = ref<Script[]>([])
const total = ref(0)
const loading = ref(false)

// 查询条件（输入中的值，点查询后才同步到请求参数）
const filters = reactive({ name: '' })
const page = reactive({ page: 1, page_size: 20 })

const dialogVisible = ref(false)
const uploading = ref(false)
const formRef = ref<FormInstance>()

// 详情对话框：展示脚本基本信息与参数文件（data_files）列表
const detailVisible = ref(false)
const detailScript = ref<Script | null>(null)

// 更换 JMX 对话框
const replaceVisible = ref(false)
const replacing = ref(false)
const replaceTarget = ref<Script | null>(null)
const replaceFile = ref<File | null>(null)
const replaceUploadRef = ref<UploadInstance>()

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
    const res = await listScripts({
      name: filters.name.trim() || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    scripts.value = res.items
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
    page.page = 1 // 新脚本按 id desc 排在首页
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    uploading.value = false
  }
}

// ===== 详情 =====
const openDetail = (row: Script) => {
  detailScript.value = row
  detailVisible.value = true
}

// ===== 更换 JMX =====
const openReplace = (row: Script) => {
  replaceTarget.value = row
  replaceFile.value = null
  replaceVisible.value = true
}

const resetReplace = () => {
  replaceFile.value = null
  replaceTarget.value = null
  replaceUploadRef.value?.clearFiles()
}

const handleReplaceChange = (file: UploadFile) => {
  const raw = file.raw as UploadRawFile
  if (!raw.name.toLowerCase().endsWith('.jmx')) {
    ElMessage.error('仅支持上传 .jmx 文件')
    replaceUploadRef.value?.clearFiles()
    return
  }
  replaceFile.value = raw as unknown as File
}

const handleReplaceConfirm = async () => {
  if (!replaceTarget.value) return
  if (!replaceFile.value) {
    ElMessage.warning('请选择新的 JMX 文件')
    return
  }
  const formData = new FormData()
  formData.append('file', replaceFile.value)

  replacing.value = true
  try {
    await replaceScriptJmx(replaceTarget.value.id, formData)
    ElMessage.success('更换成功')
    replaceVisible.value = false
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（线程组不一致 code 3009 等）
  } finally {
    replacing.value = false
  }
}

// ===== 删除 =====
const handleDelete = (row: Script) => {
  ElMessageBox.confirm(
    `确认删除脚本「${row.name}」？JMX 与参数文件将一并清理，删除后不可恢复。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  )
    .then(async () => {
      try {
        await deleteScript(row.id)
        ElMessage.success('删除成功')
        await fetchData()
      } catch {
        // 拦截器已弹 ElMessage（如被场景引用 code 3010）
      }
    })
    .catch(() => {
      // 用户取消，无需处理
    })
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
    <div class="filters">
      <el-input
        v-model="filters.name"
        placeholder="脚本名称"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>
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
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
          <el-button link type="primary" size="small" @click="openReplace(row)">更换</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
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

    <!-- 详情：脚本基本信息 + 参数文件列表 -->
    <el-dialog v-model="detailVisible" title="脚本详情" width="640px">
      <el-descriptions v-if="detailScript" :column="2" border>
        <el-descriptions-item label="ID">{{ detailScript.id }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{ detailScript.name }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ detailScript.version }}</el-descriptions-item>
        <el-descriptions-item label="参数文件数">{{ detailScript.data_files?.length || 0 }}</el-descriptions-item>
        <el-descriptions-item label="JMX 文件 Key" :span="2">
          {{ detailScript.file_key || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">
          {{ detailScript.description || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <div class="section-title">参数文件列表</div>
      <el-table
        :data="detailScript?.data_files || []"
        size="small"
        stripe
        empty-text="暂无参数文件"
      >
        <el-table-column type="index" label="#" width="55" />
        <el-table-column prop="filename" label="参数文件名" min-width="160" />
        <el-table-column prop="key" label="文件 Key" min-width="260" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <!-- 更换 JMX -->
    <el-dialog v-model="replaceVisible" title="更换 JMX" width="480px" @close="resetReplace">
      <div v-if="replaceTarget" class="replace-target">
        当前脚本：<strong>{{ replaceTarget.name }}</strong>（{{ replaceTarget.version }}）
      </div>
      <el-upload
        ref="replaceUploadRef"
        :auto-upload="false"
        :limit="1"
        :on-change="handleReplaceChange"
        :on-exceed="() => ElMessage.warning('只能上传 1 个 JMX 文件')"
        accept=".jmx"
      >
        <el-button type="primary">选择新 JMX</el-button>
        <template #tip>
          <div class="tip">
            新脚本的线程组（名称+类型）必须与原脚本完全一致，否则后端拒绝替换；线程数等参数由场景设置覆盖
          </div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="replaceVisible = false">取消</el-button>
        <el-button type="primary" :loading="replacing" @click="handleReplaceConfirm">
          确认更换
        </el-button>
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
.tag-gap {
  margin-right: 4px;
  margin-bottom: 4px;
}
.tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.section-title {
  margin: 16px 0 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.replace-target {
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
}
</style>
