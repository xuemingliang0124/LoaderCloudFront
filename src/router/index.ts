import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/Login.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/projects',
    children: [
      // 项目列表（全局入口，非项目作用域）
      {
        path: 'projects',
        name: 'projects',
        component: () => import('@/views/projects/ProjectList.vue'),
        meta: { title: '项目' },
      },
      // 全局资源：压力机（不挂项目）
      {
        path: 'agents',
        name: 'agents',
        component: () => import('@/views/agents/AgentList.vue'),
        meta: { title: '压力机' },
      },
      // 全局管理：用户管理（仅 admin）
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/users/UserList.vue'),
        meta: { title: '用户管理', adminOnly: true },
      },
      // 项目作用域资源：scripts / scenarios / runs / schedules
      {
        path: 'projects/:projectId/members',
        name: 'project-members',
        component: () => import('@/views/projects/ProjectMembers.vue'),
        meta: { title: '项目成员', projectScoped: true },
      },
      {
        path: 'projects/:projectId/scripts',
        name: 'scripts',
        component: () => import('@/views/scripts/ScriptList.vue'),
        meta: { title: '脚本', projectScoped: true },
      },
      {
        path: 'projects/:projectId/scenarios',
        name: 'scenarios',
        component: () => import('@/views/scenarios/ScenarioList.vue'),
        meta: { title: '场景', projectScoped: true },
      },
      {
        path: 'projects/:projectId/scenarios/create',
        name: 'scenario-create',
        component: () => import('@/views/scenarios/ScenarioCreate.vue'),
        meta: { title: '新建场景', projectScoped: true },
      },
      {
        path: 'projects/:projectId/runs',
        name: 'runs',
        component: () => import('@/views/runs/RunList.vue'),
        meta: { title: '运行记录', projectScoped: true },
      },
      {
        path: 'projects/:projectId/runs/:runNo',
        name: 'run-detail',
        component: () => import('@/views/runs/RunDetail.vue'),
        meta: { title: '运行详情', projectScoped: true },
      },
      {
        path: 'projects/:projectId/schedules',
        name: 'schedules',
        component: () => import('@/views/schedules/ScheduleList.vue'),
        meta: { title: '定时任务', projectScoped: true },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/projects' },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.token) {
    return `/login?redirect=${encodeURIComponent(to.fullPath)}`
  }

  // 仅管理员可访问的页面
  if (to.meta.adminOnly && !auth.isAdmin) {
    return '/projects'
  }

  // 项目作用域页：校验 projectId 合法且当前用户可见
  if (to.meta.projectScoped) {
    const rawId = to.params.projectId as string
    const projectId = Number(rawId)
    if (!rawId || Number.isNaN(projectId)) {
      return '/projects'
    }
    const projectStore = useProjectStore()
    // 列表未加载时先拉取（保证切换器数据可用）
    if (!projectStore.projects.length) {
      try {
        await projectStore.fetchProjects()
      } catch {
        return '/projects'
      }
    }
    // 项目不可见（非成员且非 admin）时回退到项目列表
    if (!projectStore.projects.some((p) => p.id === projectId)) {
      return '/projects'
    }
    projectStore.setCurrent(projectId)
  }
  return true
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) || ''
  document.title = title ? `${title} - LoaderCloud` : 'LoaderCloud 压测平台'
})

export default router
