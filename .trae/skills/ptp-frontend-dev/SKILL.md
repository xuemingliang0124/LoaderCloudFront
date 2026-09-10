---
name: "ptp-frontend-dev"
description: "LoaderCloud 压测平台前端（Vue3+Element Plus+ECharts）开发规范。写 Vue3 代码前、新增页面/API/组件、改 request.ts 拦截器或路由守卫或 ECharts 实时逻辑前必读。"
---

# LoaderCloud 前端开发规范（ptp-frontend-dev）

> 本规范是 [前端项目设计方案](file:///d:/PycharmProjects/LoaderCloudFrontV2/docs/前端项目设计方案.md) 的执行级条款。设计方案讲「为什么」，本规范讲「怎么写才合规」。
> 后端契约唯一事实源：`d:\PycharmProjects\LoaderCloudBackendV2\master\app\`，凡有疑问以源码为准。

## 0. 何时读这个 Skill

- 新建任何 `.vue` / `.ts` 文件前
- 修改 `src/api/request.ts`（拦截器）、`src/router/index.ts`（守卫）、`src/stores/auth.ts`、ECharts 实时逻辑前
- 新增 API 调用、新增页面、改路由表前
- 任何与后端契约对接相关的改动

## 1. 技术栈与版本红线

- **必选**：Vue 3（`<script setup lang="ts">`）、Vite 5、TypeScript、Element Plus、ECharts 5、vue-router 4、Pinia、axios
- **自动导入**：`unplugin-auto-import` + `unplugin-vue-components`（EP 按需），不要手写 `import { ElMessage } from 'element-plus'` 以外的 EP 显式导入
- **禁引入**：`vue-echarts`（包一层限制实时控制）、`vuex`、`axios-retry`、`dayjs` 之外的日期库
- **图表用裸 echarts 按需注册**：统一从 `@/utils/echarts` 导入（内部基于 `echarts/core` + `echarts.use` 按需注册 LineChart/Grid/Tooltip/Legend/CanvasRenderer），`echarts.init(ref.value)`；**禁止** `import * as echarts from 'echarts'` 全量导入（会把 RunDetail chunk 撑到 1MB+）。新图表类型在 `@/utils/echarts.ts` 追加注册

## 2. 目录与命名约定

- **一资源一文件**：`src/api/agents.ts` 对应后端 `api/v1/agents.py`，文件名复数与后端一致
- **views 按资源分目录**：`views/agents/AgentList.vue`、`views/runs/RunDetail.vue`
- **组件 PascalCase**，函数/变量 camelCase，TS 类型 PascalCase
- **字段全 snake_case**：`run_no`/`agent_id`/`created_at`/`cpu_percent`/`jmeter_version`/`file_key`/`scenario_id`/`agent_tags`/`param_overrides`/`last_run_no` 等，**禁止**做驼峰转换，省双向映射层
- **路径别名**：`@/` 指向 `src/`，import 一律用 `@/api/request` 而非相对路径

## 3. API 层规范（`src/api/*.ts`）

### 3.1 模板

```typescript
import request from './request'
import type { Agent } from '@/types/api'

// 无分页列表
export const listAgents = () => request.get<unknown, Agent[]>('/agents')

// 分页列表（仅 runs）
export const listRuns = (page = 1, page_size = 20) =>
  request.get<unknown, PageResult<Run>>('/runs', { params: { page, page_size } })

// POST
export const createRun = (scenario_id: number, agent_ids?: string[]) =>
  request.post<unknown, { run_no: string; agent_ids: string[] }>('/runs', { scenario_id, agent_ids })

// multipart 上传
export const uploadScript = (formData: FormData) =>
  request.post<unknown, Script>('/scripts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
```

### 3.2 红线

- **泛型第二参数就是返回类型**：`request.get<unknown, T>(...)`，不要写 `request.get<T>`（后者拿到的是 AxiosResponse）
- **不要在 api 层做数据转换**（不重命名字段、不格式化时间），转换在 view 层用 `utils/format.ts`
- **不要在 api 层 `try/catch` 吞错**，错误让拦截器统一处理并 reject 到 view
- **不写 baseURL**：baseURL 由 `VITE_API_BASE` 注入，api 层只写相对路径如 `/agents`

## 4. request.ts 拦截器红线（最关键）

### 4.1 请求拦截器

```typescript
instance.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`
  return config
})
```

- token 来自 `useAuthStore()`，**不要**直接读 localStorage（Pinia 才是 single source of truth）

### 4.2 响应拦截器（成功分支）

```typescript
(resp) => {
  const body = resp.data as ApiResponse
  if (body.code !== 0) {
    ElMessage.error(body.message || '请求失败')
    return Promise.reject(new Error(body.message))
  }
  return body.data as never
}
```

- `code === 0` 返回 `body.data`，调用方拿到的就是业务数据
- `code !== 0` 兜底（正常业务错误走 HTTP 400，不会进成功分支；此处仅防御）

### 4.3 响应拦截器（错误分支）—— 必须按此顺序

```typescript
(err: AxiosError<ApiResponse | { detail?: string }>) => {
  const status = err.response?.status
  // 1. 401 优先：登出 + 跳登录，不弹 ElMessage
  if (status === 401) {
    const auth = useAuthStore()
    auth.logout()
    router.push(`/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`)
    return Promise.reject(err)
  }
  // 2. 400 业务错误：读后端 {code, message}
  if (status === 400 && err.response?.data && 'message' in err.response.data) {
    ElMessage.error((err.response.data as ApiResponse).message)
    return Promise.reject(err)
  }
  // 3. 其他：兜底
  const msg = (err.response?.data as any)?.message || err.message || '网络异常'
  ElMessage.error(msg)
  return Promise.reject(err)
}
```

### 4.4 拦截器三大红线

1. **401 响应体不是统一格式**：后端 `HTTPException(401, detail="未登录")` 返回 FastAPI 默认 `{"detail":"未登录"}`，**不是** `{code,message,data}`。所以错误分支必须**先判 HTTP status**，再读 body。绝不能假设 401 也走 `body.code`。
2. **401 不要弹 ElMessage**：避免与跳转后的登录页提示叠加。
3. **`useAuthStore` 和 `router` 必须懒调**（在拦截器函数体内），不能在模块顶层 import 时取值，否则 Pinia/Router 未初始化报错。

## 5. 鉴权规范（`src/stores/auth.ts`）

- localStorage key：`ptp_token` / `ptp_user` / `ptp_role`（与项目代号 ptp 一致，**不要**改成 `loader_token` 之类）
- `login(payload: LoginIn)` 调 `POST /auth/login`，写 state + localStorage
- `logout()` 清空 state + localStorage（拦截器在 401 时调它）
- Pinia 用 **setup 风格**（`defineStore('auth', () => { ... })`），不用 options 风格

## 6. 路由规范（`src/router/index.ts`）

- `meta.public = true` 仅标 `/login`
- 守卫：`!to.meta.public && !auth.token` → `return '/login?redirect=...'`
- 路由组件一律 `() => import('@/views/...')` 懒加载
- RunDetail 路径参数 `:runNo`（camelCase 在 route params，但拿到后赋值给 `run_no` 变量与后端字段对齐）

## 7. 列表页规范（分页 vs 非分页）

> 后端只有 `GET /runs` 分页，其余列表（agents/scripts/scenarios/schedules）一次性返回数组。

- **分页页（仅 RunList）**：用 `el-pagination`，调 `listRuns(page, page_size)`，total 来自响应
- **非分页页（AgentList/ScriptList/ScenarioList/ScheduleList）**：直接调 `listXxx()` 拿数组，**不要**挂 `el-pagination`，**不要**前端假分页（除非数据量证明需要，再后端加）
- 表格统一 `el-table`，空态用 `el-empty`，加载态用 `v-loading`

## 8. ECharts 实时曲线规范（`RunDetail.vue`）

```typescript
let chart: EChartsType | null = null  // 类型来自 @/utils/echarts
let timer: number | null = null

// 窗口按 run 状态切换：活跃态从场景开始时间滚动到 now；终态用起止时间查全程
const buildWindow = () => {
  const now = Math.floor(Date.now() / 1000)
  const startTs = toEpoch(run.value?.start_time)  // naive ISO 经 new Date() 解析为秒
  if (isRunActive(run.value?.status)) {
    return { start: startTs !== null ? startTs - 60 : now - 300, end: now }
  }
  return { start: (startTs ?? now - 300) - 60, end: toEpoch(run.value?.end_time) ?? now + 60 }
}

const poll = async () => {
  const { start, end } = buildWindow()
  const rows = await getTimeseries(runNo, start, end)
  render(rows)
}

onMounted(() => {
  chart = echarts.init(chartRef.value!)
  poll()
  if (isRunActive(run.value?.status)) timer = window.setInterval(poll, 5000) // 仅活跃态轮询
})

onBeforeUnmount(() => {
  if (timer) { clearInterval(timer); timer = null }
  chart?.dispose()
  chart = null
})
```

### 红线

- **必须 `onBeforeUnmount` 清 timer + `chart.dispose()`**，否则路由切换后内存泄漏
- `xAxis.type = 'time'`，`tooltip.trigger = 'axis'`，`legend.type = 'scroll'`
- `timeseries` 的 `start/end` 是**秒级 unix**（不是毫秒），渲染时 `r.ts * 1000` 转 ECharts 用的毫秒
- **查询窗口按 run 状态切换**（判定走 `@/utils/status.ts` 的 `isRunActive`）：活跃态 `start=run.start_time-60`、`end=now` 滚动展示自场景开始时间起的全程并 5s 轮询；终态用 `start_time~end_time ±60` 查一次全程并停止轮询；`start_time` 缺失时退化为 `end-300`
- 浏览器**不可连** `/ws/agent`，不要尝试用 `new WebSocket('/ws/agent')`

## 9. 上传规范（`ScriptList.vue`）

- `POST /scripts` 是 **multipart**：`file`（JMX）+ `name/version/description/params(JSON 字符串)` + `data_files`（多文件）
- `params` 是 **JSON 字符串**不是对象（后端 `Form(default="[]")` + `json.loads`）
- 数据文件扩展名仅 `.csv/.txt/.dat/.tsv`，后端会 400（code 3003）
- 用 `el-upload` 拼 FormData，调用 `uploadScript(formData)`

## 10. 组件与状态管理规范

- 组件用 `<script setup lang="ts">`，不用 Options API
- 状态用 Pinia setup 风格；跨页共享态才进 store，页面私有态用 `ref/reactive` 即可
- Element Plus 组件通过 `unplugin-vue-components` 自动导入，**不要**全量 `app.use(ElementPlus)`
- 图标 `@element-plus/icons-vue` 按需 import

## 11. 样式规范

- `<style scoped lang="scss">`，不污染全局
- 主题色用 EP 变量（`--el-color-primary` 等），不写死色值
- 不引入 Tailwind / UnoCSS（与 EP 体系混用维护成本高）

## 12. 提交与分支规范

- 分支：`feat/xxx`、`fix/xxx`、`chore/xxx`
- commit message 与后端一致：`type: 简述`（feat/fix/chore/refactor/docs）
- 提交前 `npm run build` 必须通过（类型检查 + 构建）

## 13. 踩坑清单（写代码前过一遍）

1. **状态枚举 API 输出是小写 value**：Agent `online/busy/offline`，Run `pending/running/stopping/finished/partial/failed/stopped`，trigger `manual/scheduled`（Pydantic 把 `str,Enum` 序列化为 value 而非 name）。**禁止**在页面写 `'RUNNING'` 这类大写字面量；判定/文案/tag 颜色一律走 `@/utils/status.ts`（`isRunActive`/`isRunStoppable`/`runStatusTagType`/`runStatusText`/`agentStatusTagType`/`isAgentSelectable`）。曾因全大写导致运行中 run 的实时轮询永不启动、停止按钮永远禁用。
2. **Agent 有 busy 态**（正在执行任务时心跳置 busy）；offline 之外都可选来下发，能否再派由后端选机逻辑裁决。
3. **新增字段别漏**：Agent.`plugins`(string[] jar 名)/`cpu_cores`/`mem_total_gb`；Script.`plugins`(`{key,filename}[]`)；Scenario.`total_threads`（0=每台全量加压，>0 按 Agent CPU 核数拆分）。
4. **401 响应体是 `{detail}` 不是 `{code,message,data}`**——拦截器错误分支必须先判 HTTP status 再读 body。
5. **`agents/scripts/scenarios/schedules` 列表无分页**——别给它们挂 `el-pagination`，只有 `runs` 有。
6. **`POST /runs` 返回 `{run_no, agent_ids}`**——不是只返回 run_no；`agent_ids` 是后端实际选中的压力机列表（可能与你传入的不同，自动选机场景）。
7. **`POST /scripts` 的 params 是 JSON 字符串**——`JSON.stringify([{key,default,desc}])`，不是直接传数组；另有 `plugin_files` 多 jar 字段。
8. **`/ws/agent` 浏览器不可连**——它是 Agent→Master 专用通道；前端实时大盘只能 5s 轮询 `/metrics/timeseries`。
9. **timeseries 的 start/end 是秒级 unix**——不是毫秒，渲染时 `ts * 1000`。
10. **ECharts 必须 dispose**——路由离开 RunDetail 不 dispose 会内存泄漏。
11. **`request.get<T>` 拿到的是 AxiosResponse**——必须用 `request.get<unknown, T>`，第二参数才是实际返回类型（响应拦截器已拆 data）。
12. **`useAuthStore` / `router` 在拦截器内懒调**——模块顶层取值会在 Pinia/Router 未初始化时报错。
13. **字段全 snake_case**——别在 api 层转 camelCase，前后端一致最省心。
14. **`POST /schedules/{job_id}/toggle` 切换启停**——不是 `enabled` 字段 PATCH；返回最新的 ScheduleOut。
15. **runs 无详情端点**——RunDetail 页只能用 `GET /runs` 列表里的字段 + `GET /metrics/timeseries` 组装，别调 `GET /runs/:run_no`（不存在）。
16. **dev 启动顺序**——先后端 `uvicorn app.main:app --reload --port 8000`，再前端 `npm run dev`，proxy 才能转发。
17. **role 字段后端给了但路由没做权限分层**——菜单暂全显示，预留 `v-if="auth.role==='admin'"`。
18. **默认账号 admin/admin123**——Login.vue 仅 dev 预填，生产别预填。
19. **timeseries 响应是扁平点列表不是 ES 原始聚合**——后端 `query_timeseries` 已拍平为 `[{ts(秒),label,tps,avg_rt,error_rate(百分比)}]`；`error_rate` 后端已 *100，前端不要再乘。若看到 `rows.map is not a function`，说明后端退回了嵌套聚合结构。
20. **RunDetail 查询窗口按 run 状态切换**——活跃态（`pending/running/stopping`）`start=run.start_time`、`end=now` 滚动查自场景开始时间起的全程；终态（`finished/partial/failed/stopped`）用 `start_time~end_time` 全程窗口查一次并停止轮询。`start_time` 是 naive ISO（master 容器 TZ=Asia/Shanghai 后为北京墙钟），用 `new Date(str)` 按浏览器本地时区解析；ES 的 `@timestamp` 是绝对 epoch 毫秒，时区无关。
21. **master 容器必须 TZ=Asia/Shanghai**——Dockerfile 装 tzdata + compose master 环境变量 TZ；否则 `datetime.now()` 写 UTC 墙钟，naive 时间串与北京浏览器解析差 8 小时。
