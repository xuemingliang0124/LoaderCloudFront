<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile, UploadInstance } from 'element-plus'
import {
  deleteAsset,
  listAssets,
  retryAssetParse,
  updateAsset,
  uploadAsset,
} from '@/api/assets'
import type { Asset, AssetStatus, AssetType } from '@/types/api'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import { formatBytes, formatDateTime } from '@/utils/format'
import {
  ASSET_TYPE,
  ASSET_TYPE_EXTENSIONS,
  ASSET_TYPE_OPTIONS,
  assetStatusTagType,
  assetStatusText,
  assetTypeText,
  isAssetRetryable,
  type AssetTypeValue,
} from '@/utils/status'

const route = useRoute()
const projectStore = useProjectStore()
const auth = useAuthStore()
const projectId = Number(route.params.projectId)

// 写操作权限：admin 或项目编辑者+
const canWrite = computed(() => {
  if (auth.isAdmin) return true
  const p = projectStore.projects.find((x) => x.id === projectId)
  return projectStore.hasRole(p, '编辑者')
})

const assets = ref<Asset[]>([])
const total = ref(0)
const loading = ref(false)

// 查询条件：name 模糊、asset_type / status 精确过滤
const filters = reactive({
  name: '',
  asset_type: '' as AssetTypeValue | '',
  status: '' as AssetStatus | '',
})
const page = reactive({ page: 1, page_size: 20 })

// ===== 上传 =====
const uploadVisible = ref(false)
const uploading = ref(false)
const uploadRef = ref<UploadInstance>()
const uploadForm = reactive({
  asset_type: ASSET_TYPE.PLAN_DOC as AssetTypeValue,
  name: '',
  description: '',
})
const uploadFile = ref<File | null>(null)

// ===== 编辑 =====
const editVisible = ref(false)
const editSubmitting = ref(false)
const editTarget = ref<Asset | null>(null)
const editForm = reactive({
  name: '',
  description: '',
  asset_type: ASSET_TYPE.PLAN_DOC as AssetTypeValue,
})

// ===== 详情 =====
const detailVisible = ref(false)
const detailAsset = ref<Asset | null>(null)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listAssets(projectId, {
      name: filters.name.trim() || undefined,
      asset_type: filters.asset_type || undefined,
      status: filters.status || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    assets.value = res.items
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
  filters.asset_type = ''
  filters.status = ''
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

// 上传前预校验扩展名（与后端 _ASSET_TYPE_EXTENSIONS 对齐，避免 3060 业务错误）
const acceptOf = (t: AssetTypeValue) =>
  ASSET_TYPE_EXTENSIONS[t].join(',')

const handleUploadFileChange = (file: UploadFile) => {
  const raw = file.raw as File
  const ext = raw.name.slice(raw.name.lastIndexOf('.')).toLowerCase()
  const allowed = ASSET_TYPE_EXTENSIONS[uploadForm.asset_type]
  if (!allowed.includes(ext)) {
    ElMessage.error(
      `${assetTypeText(uploadForm.asset_type)} 仅支持 ${allowed.join(', ')} 文件`,
    )
    uploadRef.value?.clearFiles()
    uploadFile.value = null
    return
  }
  uploadFile.value = raw
}

// 类型变更后清空已选文件，避免扩展名不匹配
const handleUploadTypeChange = () => {
  uploadFile.value = null
  uploadRef.value?.clearFiles()
}

const resetUploadForm = () => {
  uploadForm.asset_type = ASSET_TYPE.PLAN_DOC
  uploadForm.name = ''
  uploadForm.description = ''
  uploadFile.value = null
  uploadRef.value?.clearFiles()
}

const handleUpload = async () => {
  if (!uploadFile.value) {
    ElMessage.warning('请选择要上传的文档')
    return
  }
  const formData = new FormData()
  formData.append('file', uploadFile.value)
  formData.append('asset_type', uploadForm.asset_type)
  // name 留空则后端取文件名去扩展名
  if (uploadForm.name.trim()) {
    formData.append('name', uploadForm.name.trim())
  }
  formData.append('description', uploadForm.description)

  uploading.value = true
  try {
    const res = await uploadAsset(projectId, formData)
    if (res.reused) {
      ElMessage.success('文件已存在（同 hash 复用），未重复存储')
    } else {
      ElMessage.success('上传成功，已投递解析任务')
    }
    uploadVisible.value = false
    resetUploadForm()
    page.page = 1
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3060 扩展名不匹配等）
  } finally {
    uploading.value = false
  }
}

// ===== 编辑 =====
const openEdit = (row: Asset) => {
  editTarget.value = row
  editForm.name = row.name
  editForm.description = row.description
  editForm.asset_type = row.asset_type
  editVisible.value = true
}

const handleEditSubmit = async () => {
  if (!editTarget.value) return
  if (!editForm.name.trim()) {
    ElMessage.warning('名称不能为空')
    return
  }
  const payload: {
    name?: string
    description?: string
    asset_type?: AssetType
  } = {}
  if (editForm.name.trim() !== editTarget.value.name) {
    payload.name = editForm.name.trim()
  }
  if (editForm.description !== editTarget.value.description) {
    payload.description = editForm.description
  }
  if (editForm.asset_type !== editTarget.value.asset_type) {
    payload.asset_type = editForm.asset_type
  }
  if (!Object.keys(payload).length) {
    ElMessage.info('未修改任何字段')
    editVisible.value = false
    return
  }

  editSubmitting.value = true
  try {
    await updateAsset(projectId, editTarget.value.id, payload)
    ElMessage.success('更新成功')
    editVisible.value = false
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（3060 类型与扩展名不匹配等）
  } finally {
    editSubmitting.value = false
  }
}

// ===== 重试解析 =====
const handleRetryParse = (row: Asset) => {
  ElMessageBox.confirm(
    `确认对资产「${row.name}」重新发起解析？`,
    '重试解析',
    { type: 'warning', confirmButtonText: '重试', cancelButtonText: '取消' },
  )
    .then(async () => {
      try {
        await retryAssetParse(projectId, row.id)
        ElMessage.success('已重新投递解析任务')
        await fetchData()
      } catch {
        // 拦截器已弹 ElMessage（3063 状态不允许等）
      }
    })
    .catch(() => {
      // 用户取消，无需处理
    })
}

// ===== 删除 =====
const handleDelete = (row: Asset) => {
  ElMessageBox.confirm(
    `确认删除资产「${row.name}」？文件本体将从 MinIO 清理，删除后不可恢复。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  )
    .then(async () => {
      try {
        await deleteAsset(projectId, row.id)
        ElMessage.success('删除成功')
        await fetchData()
      } catch {
        // 拦截器已弹 ElMessage
      }
    })
    .catch(() => {
      // 用户取消，无需处理
    })
}

// ===== 详情 =====
const openDetail = (row: Asset) => {
  detailAsset.value = row
  detailVisible.value = true
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>文档管理</span>
        <el-button v-if="canWrite" type="primary" @click="uploadVisible = true">
          上传文档
        </el-button>
      </div>
    </template>

    <div class="filters">
      <el-input
        v-model="filters.name"
        placeholder="资产名称"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select
        v-model="filters.asset_type"
        placeholder="资产类型"
        clearable
        class="filter-select"
        @change="handleSearch"
      >
        <el-option
          v-for="o in ASSET_TYPE_OPTIONS"
          :key="o.value"
          :label="o.label"
          :value="o.value"
        />
      </el-select>
      <el-select
        v-model="filters.status"
        placeholder="解析状态"
        clearable
        class="filter-select"
        @change="handleSearch"
      >
        <el-option label="待解析" value="pending" />
        <el-option label="解析中" value="parsing" />
        <el-option label="已就绪" value="ready" />
        <el-option label="解析失败" value="failed" />
      </el-select>
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="assets" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
      <el-table-column label="类型" width="120">
        <template #default="{ row }">
          <el-tag size="small">{{ assetTypeText(row.asset_type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="解析状态" width="110">
        <template #default="{ row }">
          <el-tag :type="assetStatusTagType(row.status)" size="small">
            {{ assetStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="filename" label="文件名" min-width="180" show-overflow-tooltip />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatBytes(row.file_size) }}</template>
      </el-table-column>
      <el-table-column prop="created_by" label="上传人" width="110" />
      <el-table-column label="上传时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
          <el-button v-if="canWrite" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button
            v-if="canWrite && isAssetRetryable(row.status)"
            link
            type="warning"
            size="small"
            @click="handleRetryParse(row)"
          >重试解析</el-button>
          <el-button v-if="canWrite" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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

    <!-- 上传对话框 -->
    <el-dialog v-model="uploadVisible" title="上传文档" width="520px" @close="resetUploadForm">
      <el-form :model="uploadForm" label-width="90px">
        <el-form-item label="资产类型" required>
          <el-select
            v-model="uploadForm.asset_type"
            style="width: 100%"
            @change="handleUploadTypeChange"
          >
            <el-option
              v-for="o in ASSET_TYPE_OPTIONS"
              :key="o.value"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文档文件" required>
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :on-change="handleUploadFileChange"
            :on-exceed="() => ElMessage.warning('只能上传 1 个文件')"
            :accept="acceptOf(uploadForm.asset_type)"
          >
            <el-button type="primary">选择文件</el-button>
            <template #tip>
              <div class="tip">
                当前类型仅支持：{{ ASSET_TYPE_EXTENSIONS[uploadForm.asset_type].join(', ') }}
              </div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="uploadForm.name" placeholder="留空则用文件名去扩展名" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="uploadForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload">上传</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" title="编辑资产" width="480px">
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="资产类型">
          <el-select v-model="editForm.asset_type" style="width: 100%">
            <el-option
              v-for="o in ASSET_TYPE_OPTIONS"
              :key="o.value"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
          <div class="tip">
            变更类型须与原文件扩展名匹配，否则后端拒绝（3060）
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEditSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="资产详情" width="640px">
      <el-descriptions v-if="detailAsset" :column="2" border>
        <el-descriptions-item label="ID">{{ detailAsset.id }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{ detailAsset.name }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ assetTypeText(detailAsset.asset_type) }}</el-descriptions-item>
        <el-descriptions-item label="解析状态">{{ assetStatusText(detailAsset.status) }}</el-descriptions-item>
        <el-descriptions-item label="文件名" :span="2">{{ detailAsset.filename }}</el-descriptions-item>
        <el-descriptions-item label="大小">{{ formatBytes(detailAsset.file_size) }}</el-descriptions-item>
        <el-descriptions-item label="内容类型">{{ detailAsset.content_type || '-' }}</el-descriptions-item>
        <el-descriptions-item label="文件 Key" :span="2">{{ detailAsset.file_key }}</el-descriptions-item>
        <el-descriptions-item label="SHA256" :span="2">{{ detailAsset.hash_sha256 }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ detailAsset.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="解析元数据" :span="2">
          <pre class="meta">{{ JSON.stringify(detailAsset.parse_meta || {}, null, 2) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="上传人">{{ detailAsset.created_by }}</el-descriptions-item>
        <el-descriptions-item label="上传时间">{{ formatDateTime(detailAsset.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间" :span="2">{{ formatDateTime(detailAsset.updated_at) }}</el-descriptions-item>
      </el-descriptions>
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
  flex-wrap: wrap;
}
.filter-input {
  width: 220px;
}
.filter-select {
  width: 150px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
// 详情对话框：长字符串（SHA256、content_type、文件 Key）允许在任意位置断行，
// 避免 el-descriptions 表格最小宽度被撑大后溢出对话框
:deep(.el-descriptions__cell) {
  overflow-wrap: anywhere;
}
// 标签列不换行，避免「文件 Key / 更新时间 / 解析元数据」折成多行
:deep(.el-descriptions__label) {
  white-space: nowrap;
}
.meta {
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
}
</style>
