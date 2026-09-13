<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Refresh, Delete, Edit } from '@element-plus/icons-vue'
import {
  deletePlugin,
  listPlugins,
  syncPlugin,
  updatePlugin,
  uploadPlugin,
} from '@/api/plugins'
import type { Plugin } from '@/types/api'
import { formatBytes } from '@/utils/format'

const plugins = ref<Plugin[]>([])
const loading = ref(false)

const fetchData = async () => {
  loading.value = true
  try {
    plugins.value = await listPlugins()
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
}

// SHA256 截断展示：前 8 + ... + 后 8
const shortSha = (sha: string) =>
  sha.length <= 20 ? sha : `${sha.slice(0, 8)}…${sha.slice(-8)}`

// ===== 上传新插件 =====
const uploadVisible = ref(false)
const uploadSubmitting = ref(false)
const uploadForm = ref<{
  file: File | null
  name: string
  version: string
  description: string
}>({ file: null, name: '', version: 'v1', description: '' })

const openUpload = () => {
  uploadForm.value = { file: null, name: '', version: 'v1', description: '' }
  uploadVisible.value = true
}

const handleFileChange = (file: { raw: File; name: string }) => {
  uploadForm.value.file = file.raw
  // 名称默认填文件名（去 .jar 后缀）
  if (!uploadForm.value.name) {
    uploadForm.value.name = file.name.replace(/\.jar$/i, '')
  }
}

const handleUpload = async () => {
  if (!uploadForm.value.file) {
    ElMessage.warning('请选择 .jar 文件')
    return
  }
  uploadSubmitting.value = true
  try {
    const res = await uploadPlugin({
      file: uploadForm.value.file,
      name: uploadForm.value.name.trim() || undefined,
      version: uploadForm.value.version.trim() || 'v1',
      description: uploadForm.value.description.trim(),
    })
    ElMessage.success(
      res.deduplicated ? '上传成功（同内容已存在，复用既有记录）' : '上传成功',
    )
    uploadVisible.value = false
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（仅 .jar 3201 等）
  } finally {
    uploadSubmitting.value = false
  }
}

// ===== 启用/禁用 =====
const handleToggleEnabled = async (row: Plugin, next: boolean) => {
  try {
    await ElMessageBox.confirm(
      next
        ? `确认启用插件「${row.name}」？将向在线 Agent 推送安装。`
        : `确认禁用插件「${row.name}」？将向在线 Agent 推送卸载，已加载该插件的运行中任务不受影响。`,
      '操作确认',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' },
    )
  } catch {
    // 用户取消：开关会自动回弹
    return
  }
  try {
    await updatePlugin(row.id, { enabled: next })
    row.enabled = next
    ElMessage.success(next ? '已启用并推送安装' : '已禁用并推送卸载')
  } catch {
    // 拦截器已弹 ElMessage
  }
}

// ===== 编辑描述 =====
const editVisible = ref(false)
const editSubmitting = ref(false)
const editTarget = ref<Plugin | null>(null)
const editDescription = ref('')

const openEdit = (row: Plugin) => {
  editTarget.value = row
  editDescription.value = row.description || ''
  editVisible.value = true
}

const handleEdit = async () => {
  if (!editTarget.value) return
  if (editDescription.value.trim() === editTarget.value.description) {
    ElMessage.warning('描述未变更')
    return
  }
  editSubmitting.value = true
  try {
    await updatePlugin(editTarget.value.id, {
      description: editDescription.value.trim(),
    })
    editTarget.value.description = editDescription.value.trim()
    ElMessage.success('描述已更新')
    editVisible.value = false
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    editSubmitting.value = false
  }
}

// ===== 手动同步 =====
const syncLoadingId = ref<number | null>(null)
const handleSync = async (row: Plugin) => {
  syncLoadingId.value = row.id
  try {
    const res = await syncPlugin(row.id)
    ElMessage.success(
      res.pushed_to > 0
        ? `已推送给 ${res.pushed_to} 台在线 Agent`
        : '当前无在线 Agent，未推送',
    )
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    syncLoadingId.value = null
  }
}

// ===== 删除 =====
const handleDelete = async (row: Plugin) => {
  try {
    await ElMessageBox.confirm(
      `确认删除插件「${row.name}」？将向在线 Agent 推送卸载，并清理 MinIO 归档对象，删除后不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deletePlugin(row.id)
    ElMessage.success('删除成功')
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>插件管理</span>
        <el-button type="primary" :icon="Upload" @click="openUpload">
          上传插件
        </el-button>
      </div>
    </template>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="tips"
      title="全局插件池：上传的 jar 用于所有项目，启用后自动推送到在线 Agent；禁用或删除会联动卸载。"
    />

    <el-table :data="plugins" v-loading="loading" border stripe style="margin-top: 12px">
      <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="version" label="版本" width="90" />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatBytes(row.size) }}</template>
      </el-table-column>
      <el-table-column label="SHA256" width="200">
        <template #default="{ row }">
          <el-tooltip :content="row.sha256" placement="top">
            <code class="sha">{{ shortSha(row.sha256) }}</code>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="启用状态" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.enabled"
            :loading="syncLoadingId === row.id"
            @change="(v: boolean) => handleToggleEnabled(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="description"
        label="描述"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column prop="created_by" label="创建者" width="120" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button
            size="small"
            :icon="Refresh"
            :loading="syncLoadingId === row.id"
            @click="handleSync(row)"
          >
            同步
          </el-button>
          <el-button size="small" :icon="Edit" @click="openEdit(row)">
            描述
          </el-button>
          <el-button
            size="small"
            type="danger"
            :icon="Delete"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="uploadVisible"
      title="上传插件"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px">
        <el-form-item label="jar 文件" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".jar"
            :on-change="handleFileChange"
            :on-exceed="() => ElMessage.warning('只能上传 1 个文件')"
          >
            <el-button type="primary" :icon="Upload">选择文件</el-button>
            <template #tip>
              <div class="upload-tip">仅支持 .jar 文件，按内容 sha256 自动去重</div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="名称">
          <el-input
            v-model="uploadForm.name"
            placeholder="留空则取文件名"
            maxlength="64"
          />
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="uploadForm.version" placeholder="v1" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="uploadForm.description"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="uploadSubmitting"
          @click="handleUpload"
        >
          上传
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑描述对话框 -->
    <el-dialog
      v-model="editVisible"
      title="修改描述"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input :model-value="editTarget?.name" disabled />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editDescription"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEdit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tips {
  margin-bottom: 0;
}
.sha {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
