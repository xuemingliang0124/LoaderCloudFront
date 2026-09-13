<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createUser, deleteUser, listUsers, updateUser } from '@/api/users'
import type { GlobalRole, User } from '@/types/api'

const users = ref<User[]>([])
const total = ref(0)
const loading = ref(false)

const filters = reactive({ username: '', role: '' as '' | GlobalRole })
const page = reactive({ page: 1, page_size: 20 })

const ROLE_OPTIONS: GlobalRole[] = ['管理员', '普通用户']

const roleTagType = (role: string) => (role === '管理员' ? 'danger' : 'info')

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listUsers({
      username: filters.username.trim() || undefined,
      role: filters.role === '' ? undefined : filters.role,
      page: page.page,
      page_size: page.page_size,
    })
    users.value = res.items
    total.value = res.total
  } catch {
    // 拦截器已弹 ElMessage（非管理员 1010 等）
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.page = 1
  fetchData()
}
const handleReset = () => {
  filters.username = ''
  filters.role = ''
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

// ===== 新建用户 =====
const createVisible = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({ username: '', password: '', role: '普通用户' as GlobalRole })

const openCreate = () => {
  createForm.username = ''
  createForm.password = ''
  createForm.role = '普通用户'
  createVisible.value = true
}

const handleCreate = async () => {
  if (!createForm.username.trim() || !createForm.password) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  createSubmitting.value = true
  try {
    await createUser({
      username: createForm.username.trim(),
      password: createForm.password,
      role: createForm.role,
    })
    ElMessage.success('创建成功')
    createVisible.value = false
    page.page = 1
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（用户名重复 1011 等）
  } finally {
    createSubmitting.value = false
  }
}

// ===== 编辑用户（角色 / 密码，至少一项）=====
const editVisible = ref(false)
const editSubmitting = ref(false)
const editTarget = ref<User | null>(null)
const editForm = reactive({ role: '普通用户' as GlobalRole, password: '' })

const openEdit = (row: User) => {
  editTarget.value = row
  editForm.role = (row.role as GlobalRole) || '普通用户'
  editForm.password = ''
  editVisible.value = true
}

const handleEdit = async () => {
  if (!editTarget.value) return
  const role = editForm.role
  const password = editForm.password
  if (!password && role === editTarget.value.role) {
    ElMessage.warning('角色与密码至少修改一项')
    return
  }
  editSubmitting.value = true
  try {
    await updateUser(editTarget.value.username, {
      role: role !== editTarget.value!.role ? role : undefined,
      password: password || undefined,
    })
    ElMessage.success('更新成功')
    editVisible.value = false
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（不可降级自己 1014 / 末位管理员 1015 等）
  } finally {
    editSubmitting.value = false
  }
}

// ===== 删除用户 =====
const handleDelete = async (row: User) => {
  try {
    await ElMessageBox.confirm(
      `确认删除用户「${row.username}」？该用户的项目成员关系将一并清理，删除后不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteUser(row.username)
    ElMessage.success('删除成功')
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（不可删自己 1014 / 末位管理员 1015 等）
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>用户管理</span>
        <el-button type="primary" @click="openCreate">新建用户</el-button>
      </div>
    </template>

    <div class="filters">
      <el-input
        v-model="filters.username"
        placeholder="用户名"
        clearable
        class="filter-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select
        v-model="filters.role"
        placeholder="角色"
        clearable
        class="filter-select"
        @change="handleSearch"
      >
        <el-option v-for="r in ROLE_OPTIONS" :key="r" :label="r" :value="r" />
      </el-select>
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="users" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="roleTagType(row.role)" size="small">{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ row.created_at }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
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

    <!-- 新建用户 -->
    <el-dialog v-model="createVisible" title="新建用户" width="420px">
      <el-form label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="createForm.username" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="createForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="createForm.role" style="width: 100%">
            <el-option v-for="r in ROLE_OPTIONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑用户 -->
    <el-dialog v-model="editVisible" title="编辑用户" width="420px">
      <el-form label-width="80px">
        <el-form-item label="用户名">
          <el-input :model-value="editTarget?.username" disabled />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="editForm.role" style="width: 100%">
            <el-option v-for="r in ROLE_OPTIONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="editForm.password"
            type="password"
            show-password
            placeholder="留空则不修改密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEdit">保存</el-button>
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
.filter-select {
  width: 140px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
