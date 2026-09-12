<script setup lang="ts">
import { ref, watch } from 'vue'
import { listScripts } from '@/api/scripts'
import type { Script } from '@/types/api'

const props = defineProps<{
  visible: boolean
  // 已选脚本 id 列表，用于在 picker 中标记/禁用重复添加
  exclude: number[]
}>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
  select: [scripts: Script[]]
}>()

const scripts = ref<Script[]>([])
const loading = ref(false)
const keyword = ref('')
const selected = ref<Script[]>([])

// 打开弹窗时拉脚本列表（按需懒加载，不拖慢主页面首屏）
watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    selected.value = []
    keyword.value = ''
    await fetchScripts()
  },
)

const fetchScripts = async () => {
  loading.value = true
  try {
    const res = await listScripts({
      name: keyword.value.trim() || undefined,
      page: 1,
      page_size: 100,
    })
    scripts.value = res.items
  } catch {
    // 拦截器已弹 ElMessage
  } finally {
    loading.value = false
  }
}

const handleSearch = () => fetchScripts()

const isExcluded = (id: number) => props.exclude.includes(id)

const isSelected = (id: number) => selected.value.some((s) => s.id === id)

const toggleSelect = (s: Script) => {
  if (isExcluded(s.id)) return
  if (isSelected(s.id)) {
    selected.value = selected.value.filter((x) => x.id !== s.id)
  } else {
    selected.value.push(s)
  }
}

const handleConfirm = () => {
  if (!selected.value.length) return
  emit('select', selected.value)
  emit('update:visible', false)
}

const handleCancel = () => emit('update:visible', false)
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="添加脚本"
    width="720px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="picker-toolbar">
      <el-input
        v-model="keyword"
        placeholder="脚本名称"
        clearable
        class="picker-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <span v-if="selected.length" class="picker-selected">
        已选 {{ selected.length }} 个
      </span>
    </div>
    <el-table
      v-loading="loading"
      :data="scripts"
      stripe
      max-height="400"
      @row-click="toggleSelect"
    >
      <el-table-column width="50" align="center">
        <template #default="{ row }">
          <el-checkbox
            :model-value="isSelected(row.id)"
            :disabled="isExcluded(row.id)"
            @click.stop
            @change="toggleSelect(row)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="version" label="版本" width="100" />
      <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="isExcluded(row.id)" size="small" type="info">已添加</el-tag>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button
        type="primary"
        :disabled="!selected.length"
        @click="handleConfirm"
      >
        添加 {{ selected.length || '' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.picker-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.picker-input {
  width: 240px;
}
.picker-selected {
  margin-left: auto;
  color: var(--el-color-primary);
  font-size: 13px;
}
:deep(.el-table__row) {
  cursor: pointer;
}
</style>
