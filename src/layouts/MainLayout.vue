<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  Cpu,
  Document,
  Files,
  VideoPlay,
  Timer,
  Setting,
  SwitchButton,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const activeMenu = computed(() => {
  // runs/:runNo 仍高亮 runs
  const name = route.name as string | undefined
  if (name === 'run-detail') return '/runs'
  return route.path
})

const menus = [
  { index: '/agents', title: '压力机', icon: Cpu },
  { index: '/scripts', title: '脚本', icon: Document },
  { index: '/scenarios', title: '场景', icon: Files },
  { index: '/runs', title: '运行记录', icon: VideoPlay },
  { index: '/schedules', title: '定时任务', icon: Timer },
]

const handleLogout = async () => {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="210px" class="layout__aside">
      <div class="layout__logo">LoaderCloud</div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#cfd8e6"
        active-text-color="#fff"
      >
        <el-menu-item v-for="m in menus" :key="m.index" :index="m.index">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="layout__header">
        <div class="layout__header-title">
          {{ route.meta.title || 'LoaderCloud 压测平台' }}
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
    &-title {
      font-size: 16px;
      font-weight: 600;
    }
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
:deep(.el-menu) {
  border-right: none;
  flex: 1;
}
</style>
