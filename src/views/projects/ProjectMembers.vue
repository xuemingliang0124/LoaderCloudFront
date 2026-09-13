<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  grantMember,
  listMembers,
  removeMember,
  updateMemberRole,
} from '@/api/members'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import type { Member, ProjectRole } from '@/types/api'

const route = useRoute()
const projectStore = useProjectStore()
const auth = useAuthStore()
const projectId = Number(route.params.projectId)

// 成员管理权限：admin 或项目管理员(owner)
const canManage = computed(() => {
  if (auth.isAdmin) return true
  const p = projectStore.projects.find((x) => x.id === projectId)
  return projectStore.hasRole(p, '项目管理员')
})

const members = ref<Member[]>([])
const total = ref(0)
const loading = ref(false)

const filters = reactive({ username: '' })
const page = reactive({ page: 1, page_size: 20 })

const ROLE_OPTIONS: ProjectRole[] = ['项目管理员', '编辑者', '观察者']

const roleTagType = (role: string) => {
  if (role === '项目管理员') return 'success'
  if (role === '编辑者') return 'warning'
  return 'info'
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listMembers(projectId, {
      username: filters.username.trim() || undefined,
      page: page.page,
      page_size: page.page_size,
    })
    members.value = res.items
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
  filters.username = ''
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

// ===== 授权成员 =====
const grantVisible = ref(false)
const grantSubmitting = ref(false)
const grantForm = reactive({ username: '', role: '观察者' as ProjectRole })

const openGrant = () => {
  grantForm.username = ''
  grantForm.role = '观察者'
  grantVisible.value = true
}

const handleGrant = async () => {
  if (!grantForm.username.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }
  grantSubmitting.value = true
  try {
    await grantMember(projectId, {
      username: grantForm.username.trim(),
      role: grantForm.role,
    })
    ElMessage.success('授权成功')
    grantVisible.value = false
    page.page = 1
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（用户不存在 3035 / 重复授权 3032 等）
  } finally {
    grantSubmitting.value = false
  }
}

// ===== 变更角色 =====
const handleRoleChange = async (row: Member, role: string) => {
  if (row.role === role) return
  try {
    await updateMemberRole(projectId, row.username, { role: role as ProjectRole })
    ElMessage.success('角色已更新')
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（创建者不可降级 3034 / 最后 owner 不可降级 3034 等）
    await fetchData() // 回滚前端选择
  }
}

// ===== 移除成员 =====
const handleRemove = async (row: Member) => {
  try {
    await ElMessageBox.confirm(
      `确认移除成员「${row.username}」？移除后该用户将无法访问本项目。`,
      '移除确认',
      { type: 'warning', confirmButtonText: '移除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await removeMember(projectId, row.username)
    ElMessage.success('已移除')
    await fetchData()
  } catch {
    // 拦截器已弹 ElMessage（创建者不可移除 3034 / 最后 owner 不可移除 3034 等）
  }
}

onMounted(fetchData)
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>项目成员</span>
        <el-button v-if="canManage" type="primary" @click="openGrant">授权成员</el-button>
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
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="members" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column label="角色" width="140">
        <template #default="{ row }">
          <el-select
            v-if="canManage"
            :model-value="row.role"
            size="small"
            style="width: 120px"
            @change="(val: string) => handleRoleChange(row, val)"
          >
            <el-option v-for="r in ROLE_OPTIONS" :key="r" :label="r" :value="r" />
          </el-select>
          <el-tag v-else :type="roleTagType(row.role)" size="small">{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="granted_by" label="授权人" width="120" />
      <el-table-column label="加入时间" width="180">
        <template #default="{ row }">{{ row.created_at }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canManage"
            link
            type="danger"
            size="small"
            @click="handleRemove(row)"
          >移除</el-button>
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

    <el-dialog v-model="grantVisible" title="授权成员" width="420px">
      <el-form label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="grantForm.username" placeholder="输入已注册的用户名" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="grantForm.role" style="width: 100%">
            <el-option v-for="r in ROLE_OPTIONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="grantVisible = false">取消</el-button>
        <el-button type="primary" :loading="grantSubmitting" @click="handleGrant">授权</el-button>
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
</style>
