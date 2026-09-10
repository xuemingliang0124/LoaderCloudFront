# Vue3 前端项目框架搭建

> **Workspace:** d:\PycharmProjects\LoaderCloudBackendV2

---

**User**

当前后端项目骨架已经搭建完成，基本流程已经跑通，我想开始前端项目的搭建，计划使用vue3，我应该如何根据当前后端项目快速搭建前端框架

**Assistant**

我来帮你规划基于当前后端项目的前端搭建。首先调用项目开发规范技能，了解后端的约定，这样前端才能与后端无缝对接。

技能文档已加载。后端是 FastAPI + 统一响应 `{code,message,data}` + JWT + WS。让我并行读取后端关键文件，弄清 API 清单、Schema 契约、认证方式，再给出前端搭建方案。

继续并行读取路由聚合、认证接口、统一响应包装、依赖注入、以及一个典型资源端点，确保前端能精确对接。

已掌握后端契约。再看一眼 schemas 总表和 WS/指标端点，前端实时大盘和指标曲线要对接它们。

已摸清后端契约。下面给出与你当前后端精确对接的 Vue3 前端搭建方案。

---

## 一、后端契约速览（前端必须对齐的点）

| 维度 | 后端约定 | 前端对应处理 |
|---|---|---|
| 路由前缀 | `/api/v1` + 资源复数 | axios baseURL = `/api/v1`（dev 走 vite proxy） |
| 统一响应 | `{code:0,message:"ok",data:...}`；业务错误 code≠0 + HTTP 400 | 响应拦截器：code≠0 抛错 + ElMessage；code=0 直接返回 data |
| 分页 | `?page&page_size`，响应 `{total,items}` | 封装 `usePagination` |
| 认证 | `Authorization: Bearer <jwt>`；401=未登录/过期 | 请求拦截器注入 token；响应拦截器遇 401 跳登录 |
| 字段命名 | snake_case（`run_no`/`agent_id`/`created_at`） | 前端 TS 类型直接用 snake_case，避免转换层 |
| 实时指标 | `GET /metrics/timeseries?run_no&start&end&interval`（轮询）；`/ws/agent` 是 Agent→Master 通道，**浏览器不可连** | Run 详情页轮询 timeseries + ECharts |
| 默认账号 | admin / admin123 | 登录页预填 |

**后端资源→前端页面映射**（一一对应 8 个路由文件）：

```
auth.py        → /login
agents.py      → /agents           压力机列表
scripts.py     → /scripts          脚本管理
scenarios.py   → /scenarios        场景配置
runs.py        → /runs + /runs/:no 运行记录 + 运行详情（ECharts）
schedules.py   → /schedules        定时任务
metrics.py     → (运行详情内调用)   指标曲线
health.py      → (无需页面)
```

---

## 二、技术栈与脚手架命令

项目记忆已锁定：**Vue3 + Element Plus + ECharts**，另建仓。建议栈：

```bash
# 1. 在与后端同级的目录创建前端仓
cd d:\PycharmProjects
npm create vite@latest LoaderCloudFrontend -- --template vue-ts

cd LoaderCloudFrontend
npm install

# UI + 图表 + 路由 + 状态 + HTTP
npm install element-plus echarts vue-echarts vue-router@4 pinia axios @element-plus/icons-vue

# 开发体验
npm install -D unplugin-auto-import unplugin-vue-components sass
```

---

## 三、目录结构（镜像后端资源划分）

```
src/
  api/                  # 一资源一文件，对应后端 api/v1/
    request.ts          # axios 实例 + 拦截器（核心）
    auth.ts agents.ts scripts.ts scenarios.ts runs.ts schedules.ts metrics.ts
  stores/
    auth.ts              # token / 用户信息 / 登录登出
  router/
    index.ts             # 路由表 + 全局前置守卫
  layouts/
    MainLayout.vue      # 顶栏 + 侧栏菜单
  views/
    login/Login.vue
    agents/AgentList.vue
    scripts/ScriptList.vue
    scenarios/ScenarioList.vue
    runs/RunList.vue
    runs/RunDetail.vue   # ECharts 实时曲线
    schedules/ScheduleList.vue
  components/
    charts/LineChart.vue # ECharts 通用折线封装
  types/
    api.ts               # 镜像后端 schemas 的 TS 类型
  utils/
    format.ts            # 时间/数值格式化
  App.vue  main.ts
.env.development        # VITE_API_BASE=/api/v1
.env.production
vite.config.ts
```

---

## 四、核心基建文件（直接复制）

### 1. `vite.config.ts` — dev 代理到后端 8000

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
})
```

### 2. `src/types/api.ts` — 镜像后端 Pydantic schema（字段 snake_case 一致）

```typescript
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}
export interface PageResult<T> { total: number; items: T[] }

export interface LoginIn { username: string; password: string }
export interface LoginOut { token: string; username: string; role: string }

export interface Agent {
  id: number; agent_id: string; ip: string; hostname: string
  tags: string[] | null; jmeter_version: string; status: string
  cpu_percent: number; mem_percent: number
  current_run_no: string | null; last_heartbeat: string | null
}
export interface Run {
  id: number; run_no: string; scenario_id: number; status: string
  trigger: string; agent_ids: string[] | null
  start_time: string | null; end_time: string | null
  error_message: string; created_by: string
}
export interface Scenario {
  id: number; name: string; script_id: number
  param_overrides: Record<string, unknown> | null
  agent_tags: string[] | null; agent_count: number
  duration: number; description: string
}
export interface Script {
  id: number; name: string; version: string; file_key: string
  data_files: string[] | null; params: unknown[] | null; description: string
}
export interface Schedule {
  id: number; name: string; scenario_id: number
  cron: string; enabled: boolean; last_run_no: string | null
}
export interface TimeseriesPoint { ts: number; label: string; avg_rt: number; tps: number; error_rate: number }
```

### 3. `src/api/request.ts` — 统一响应拆包 + JWT + 401 处理（最关键）

```typescript
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api/v1',
  timeout: 30000,
})

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const auth = useAuthStore()
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`
  return config
})

instance.interceptors.response.use(
  (resp) => {
    const body = resp.data as ApiResponse
    if (body.code !== 0) {
      ElMessage.error(body.message || '请求失败')
      return Promise.reject(new Error(body.message))
    }
    return body.data as never
  },
  (err: AxiosError<ApiResponse>) => {
    if (err.response?.status === 401) {
      const auth = useAuthStore()
      auth.logout()
      router.push(`/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`)
    } else {
      const msg = err.response?.data?.message || err.message || '网络异常'
      ElMessage.error(msg)
    }
    return Promise.reject(err)
  }
)

export default instance
```

### 4. `src/api/runs.ts` — 资源 API 模板（其余照此复制）

```typescript
import request from './request'
import type { PageResult, Run } from '@/types/api'

export const listRuns = (page = 1, page_size = 20) =>
  request.get<unknown, PageResult<Run>>('/runs', { params: { page, page_size } })

export const createRun = (scenario_id: number, agent_ids?: string[]) =>
  request.post<unknown, { run_no: string }>('/runs', { scenario_id, agent_ids })

export const stopRun = (run_no: string) =>
  request.post<unknown, void>(`/runs/${run_no}/stop`)

export const getTimeseries = (run_no: string, start: number, end: number, interval = 15) =>
  request.get<unknown, unknown[]>('/metrics/timeseries', { params: { run_no, start, end, interval } })
```

### 5. `src/stores/auth.ts` — Pinia 鉴权

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import request from '@/api/request'
import type { LoginIn, LoginOut } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('ptp_token') || '')
  const username = ref(localStorage.getItem('ptp_user') || '')
  const role = ref(localStorage.getItem('ptp_role') || '')

  const login = async (payload: LoginIn) => {
    const data = await request.post<unknown, LoginOut>('/auth/login', payload)
    token.value = data.token
    username.value = data.username
    role.value = data.role
    localStorage.setItem('ptp_token', data.token)
    localStorage.setItem('ptp_user', data.username)
    localStorage.setItem('ptp_role', data.role)
  }
  const logout = () => {
    token.value = ''
    username.value = ''
    role.value = ''
    localStorage.removeItem('ptp_token')
    localStorage.removeItem('ptp_user')
    localStorage.removeItem('ptp_role')
  }
  return { token, username, role, login, logout }
})
```

### 6. `src/router/index.ts` — 路由守卫

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', component: () => import('@/views/login/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/agents',
    children: [
      { path: 'agents', component: () => import('@/views/agents/AgentList.vue'), meta: { title: '压力机' } },
      { path: 'scripts', component: () => import('@/views/scripts/ScriptList.vue'), meta: { title: '脚本' } },
      { path: 'scenarios', component: () => import('@/views/scenarios/ScenarioList.vue'), meta: { title: '场景' } },
      { path: 'runs', component: () => import('@/views/runs/RunList.vue'), meta: { title: '运行记录' } },
      { path: 'runs/:runNo', component: () => import('@/views/runs/RunDetail.vue'), meta: { title: '运行详情' } },
      { path: 'schedules', component: () => import('@/views/schedules/ScheduleList.vue'), meta: { title: '定时任务' } },
    ],
  },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.token) {
    return `/login?redirect=${encodeURIComponent(to.fullPath)}`
  }
})

export default router
```

### 7. `src/views/runs/RunDetail.vue` — ECharts 实时曲线（最体现对接价值的页）

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { getTimeseries } from '@/api/runs'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const runNo = route.params.runNo as string
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let timer: number | null = null

const render = (rows: any[]) => {
  const labels = [...new Set(rows.map(r => r.label))]
  const series = labels.map(label => ({
    name: label, type: 'line', smooth: true,
    data: rows.filter(r => r.label === label).map(r => [r.ts * 1000, r.tps]),
  }))
  chart!.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: labels, type: 'scroll', bottom: 0 },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: 'TPS' },
    series,
  })
}

const poll = async () => {
  const end = Math.floor(Date.now() / 1000)
  const start = end - 300
  const rows = await getTimeseries(runNo, start, end)
  render(rows as any[])
}

onMounted(() => {
  chart = echarts.init(chartRef.value!)
  poll()
  timer = window.setInterval(poll, 5000)
})
onBeforeUnmount(() => { timer && clearInterval(timer); chart?.dispose() })
</script>

<template>
  <el-card>
    <template #header>运行 {{ runNo }} 实时 TPS</template>
    <div ref="chartRef" style="height: 420px" />
  </el-card>
</template>
```

> 其余列表页（AgentList/ScriptList 等）按"调 `listXxx` → `el-table` 渲染 + `el-pagination` 翻页"模板复制即可，模式完全一致。

### 8. `.env.development`

```
VITE_API_BASE=/api/v1
```

---

## 五、对接要点提示

1. **后端目前没有浏览器端 WS 端点**（`/ws/agent` 是 Agent 专用）。前端实时大盘用 5s 轮询 `/metrics/timeseries` 即可（如后续要秒级推送，可在后端加 `/ws/runs/{run_no}`，再在前端用 `new WebSocket` 接）。
2. **登录返回的 role 字段**目前后端给了但路由没做权限分层，前端菜单可暂全显示，预留 `v-if="auth.role==='admin'"`。
3. **字段全 snake_case**：`run_no`/`agent_id`/`created_at` 直接用，别做驼峰转换，省一层心智负担。
4. **`/runs` 列表后端只支持分页、无详情端点**（项目记忆已记），RunDetail 页用 timeseries + 列表里的 status 字段组装即可。
5. **dev 启动顺序**：先 `uvicorn app.main:app --reload --port 8000` 起后端，再 `npm run dev` 起前端，proxy 自动转 `/api` 与 `/ws`。

---

## 六、关于搭建方式

我现在处于 **Chat Mode（只读）**，无法直接在你新仓里创建文件。两种落地方式任选：

1. **你自己建仓**：在 `d:\PycharmProjects\LoaderCloudFrontend` 执行上面的脚手架命令，然后把第四节的文件按目录结构粘进去。
2. **交给 Builder 自助搭建**：在输入框输入 `@Builder` 切换到构建代理，把本回复第三节目录 + 第四节文件清单交给它，可让它一次性把整个前端骨架文件全部落地并 `npm install` 跑通。

需要我继续补充哪个部分？比如：登录页完整实现、AgentList 列表页完整实现、或 MainLayout 侧栏菜单完整代码——告诉我哪一块，我直接给完整可粘代码。

---

