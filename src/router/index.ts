import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
    redirect: '/agents',
    children: [
      {
        path: 'agents',
        name: 'agents',
        component: () => import('@/views/agents/AgentList.vue'),
        meta: { title: '压力机' },
      },
      {
        path: 'scripts',
        name: 'scripts',
        component: () => import('@/views/scripts/ScriptList.vue'),
        meta: { title: '脚本' },
      },
      {
        path: 'scenarios',
        name: 'scenarios',
        component: () => import('@/views/scenarios/ScenarioList.vue'),
        meta: { title: '场景' },
      },
      {
        path: 'runs',
        name: 'runs',
        component: () => import('@/views/runs/RunList.vue'),
        meta: { title: '运行记录' },
      },
      {
        path: 'runs/:runNo',
        name: 'run-detail',
        component: () => import('@/views/runs/RunDetail.vue'),
        meta: { title: '运行详情' },
      },
      {
        path: 'schedules',
        name: 'schedules',
        component: () => import('@/views/schedules/ScheduleList.vue'),
        meta: { title: '定时任务' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/agents' },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.token) {
    return `/login?redirect=${encodeURIComponent(to.fullPath)}`
  }
  return true
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) || ''
  document.title = title ? `${title} - LoaderCloud` : 'LoaderCloud 压测平台'
})

export default router
