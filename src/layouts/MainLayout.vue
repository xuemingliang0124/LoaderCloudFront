<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter, RouterView } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import {
  Cpu,
  Document,
  Files,
  VideoPlay,
  Timer,
  Setting,
  SwitchButton,
  Folder,
  User,
  UserFilled,
  DataBoard,
  Box,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projectStore = useProjectStore()

// ElMenu 实例 ref：用于在进入项目作用域页时手动 open('project') 分组
// 注：Element Plus 未在公开类型中声明 open/close 方法，故此处使用 any
const menuRef = ref<any>()

// 全局资源菜单（与项目无关）
const globalMenus = [
  { index: 'projects', title: '项目列表', icon: Folder, path: '/projects' },
  { index: 'agents', title: '压力机', icon: Cpu, path: '/agents' },
  { index: 'users', title: '用户管理', icon: UserFilled, path: '/users', adminOnly: true },
]

// 项目作用域菜单（依赖当前 projectId）
const projectMenus = [
  { index: 'members', title: '项目成员', icon: User, resource: 'members' },
  { index: 'scripts', title: '脚本', icon: Document, resource: 'scripts' },
  { index: 'scenarios', title: '场景', icon: Files, resource: 'scenarios' },
  { index: 'runs', title: '运行记录', icon: VideoPlay, resource: 'runs' },
  { index: 'schedules', title: '定时任务', icon: Timer, resource: 'schedules' },
]

const visibleGlobalMenus = computed(() =>
  globalMenus.filter((m) => !m.adminOnly || auth.isAdmin),
)

// 菜单高亮：项目作用域页按资源名匹配，否则按路径
const activeMenu = computed(() => {
  const name = route.name as string | undefined
  if (name === 'run-detail') return 'runs'
  if (name === 'project-members') return 'members'
  if (route.meta.projectScoped) {
    const m = route.path.match(/\/projects\/\d+\/([^/]+)/)
    return m ? m[1] : ''
  }
  return route.path.replace(/^\//, '')
})

const handleMenuSelect = async (index: string) => {
  // 全局菜单：直接跳转固定路径
  const gm = globalMenus.find((m) => m.index === index)
  if (gm) {
    router.push(gm.path)
    return
  }
  // 项目作用域菜单：需要当前 projectId，没有则取第一个可见项目
  const pm = projectMenus.find((m) => m.index === index)
  if (pm) {
    let pid = projectStore.currentProjectId
    if (pid === null) {
      pid = await projectStore.selectFirstIfNeeded()
    }
    if (pid === null) {
      ElMessage.warning('请先选择项目')
      router.push('/projects')
      return
    }
    router.push(`/projects/${pid}/${pm.resource}`)
  }
}

// ===== Header 项目切换器（仅项目作用域页显示）=====
const projectScoped = computed(() => !!route.meta.projectScoped)
const currentProject = computed(() => {
  const id = projectStore.currentProjectId
  return projectStore.projects.find((p) => p.id === id) || null
})

// 进入项目作用域页时自动展开「项目资源」分组（v-if 切换后 default-openeds 不再生效，需手动 open）
watch(
  projectScoped,
  async (v) => {
    if (!v) return
    await nextTick()
    menuRef.value?.open('project')
  },
  { immediate: true },
)

const handleProjectChange = (pid: number) => {
  projectStore.setCurrent(pid)
  // 保持当前资源子路径，切换到新项目
  const m = route.path.match(/\/projects\/\d+\/(.+)/)
  const sub = m ? m[1] : 'scripts'
  router.push(`/projects/${pid}/${sub}`)
}

const handleLogout = async () => {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="layout__aside">
      <div class="layout__logo">LoaderCloud</div>
      <el-menu
        ref="menuRef"
        :default-active="activeMenu"
        :default-openeds="['global']"
        background-color="#001529"
        text-color="#cfd8e6"
        active-text-color="#fff"
        @select="handleMenuSelect"
      >
        <el-sub-menu index="global">
          <template #title>
            <el-icon><DataBoard /></el-icon>
            <span>全局管理</span>
          </template>
          <el-menu-item
            v-for="m in visibleGlobalMenus"
            :key="m.index"
            :index="m.index"
          >
            <el-icon><component :is="m.icon" /></el-icon>
            <span>{{ m.title }}</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-if="projectScoped" index="project">
          <template #title>
            <el-icon><Box /></el-icon>
            <span>项目资源</span>
          </template>
          <el-menu-item
            v-for="m in projectMenus"
            :key="m.index"
            :index="m.index"
          >
            <el-icon><component :is="m.icon" /></el-icon>
            <span>{{ m.title }}</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="layout__header">
        <div class="layout__header-left">
          <span class="layout__header-title">
            {{ route.meta.title || 'LoaderCloud 压测平台' }}
          </span>
          <el-select
            v-if="projectScoped"
            v-model="projectStore.currentProjectId"
            class="project-switcher"
            placeholder="选择项目"
            @change="handleProjectChange"
          >
            <el-option
              v-for="p in projectStore.projects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
          <span v-if="projectScoped && currentProject" class="layout__project-role">
            [{{ currentProject.my_role }}]
          </span>
        </div>
        <el-dropdown>
          <span class="layout__user">
            <el-icon><Setting /></el-icon>
            {{ auth.username || '未登录' }}
            <span v-if="auth.role" class="layout__role">[{{ auth.role }}]</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleLogout">
                <el-icon><SwitchButton /></el-icon>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main class="layout__main">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.layout {
  height: 100%;
  &__aside {
    background: #001529;
    display: flex;
    flex-direction: column;
  }
  &__logo {
    height: 56px;
    line-height: 56px;
    text-align: center;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 1px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--el-border-color);
    background: var(--el-bg-color);
    &-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    &-title {
      font-size: 16px;
      font-weight: 600;
    }
  }
  &__project-role {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  &__user {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    color: var(--el-text-color-regular);
  }
  &__role {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  &__main {
    background: #f5f7fa;
    padding: 16px;
  }
}
.project-switcher {
  width: 200px;
}
:deep(.el-menu) {
  border-right: none;
  flex: 1;
}
</style>
