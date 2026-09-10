# LoaderCloudFrontV2

LoaderCloud 压测平台前端 —— JMeter 分布式压测控制台。压力机管理、脚本上传、场景编排、运行触发与停止、运行实时大盘、定时任务。

## 技术栈

| 维度 | 选型 |
| --- | --- |
| 框架 | Vue 3 + `<script setup>` + TypeScript |
| 构建 | Vite 5 |
| UI | Element Plus（按需自动导入） |
| 图标 | @element-plus/icons-vue |
| 图表 | ECharts 5（直连裸用） |
| 路由 | vue-router 4（history 模式） |
| 状态 | Pinia（setup 风格） |
| HTTP | axios + 拦截器 |
| 样式 | sass |
| 自动导入 | unplugin-auto-import + unplugin-vue-components |

## 目录结构

```
src/
├─ api/          # 一资源一文件，镜像后端 /api/v1/
│  ├─ request.ts # axios 实例 + 拦截器（核心）
│  ├─ auth.ts
│  ├─ agents.ts
│  ├─ scripts.ts
│  ├─ scenarios.ts
│  ├─ runs.ts
│  ├─ schedules.ts
│  └─ metrics.ts
├─ stores/auth.ts    # token / username / role / login / logout
├─ router/index.ts   # 路由表 + 全局守卫
├─ layouts/MainLayout.vue
├─ views/
│  ├─ login/Login.vue
│  ├─ agents/AgentList.vue
│  ├─ scripts/ScriptList.vue
│  ├─ scenarios/ScenarioList.vue
│  ├─ runs/RunList.vue       # 唯一分页列表
│  ├─ runs/RunDetail.vue     # ECharts 实时曲线 + 5s 轮询
│  └─ schedules/ScheduleList.vue
├─ types/api.ts      # 镜像后端 schemas 的 TS 类型
├─ utils/
│  ├─ format.ts
│  ├─ status.ts
│  └─ echarts.ts
├─ styles/global.scss
├─ App.vue
└─ main.ts
```

## 路由与页面

| 路径 | 组件 | 说明 |
| --- | --- | --- |
| `/login` | Login.vue | 登录，dev 预填 `admin/admin123` |
| `/agents` | AgentList.vue | 压力机列表（不分页） |
| `/scripts` | ScriptList.vue | 脚本上传与列表（不分页） |
| `/scenarios` | ScenarioList.vue | 场景编排（不分页） |
| `/runs` | RunList.vue | 运行记录（分页）+ 触发/停止 |
| `/runs/:runNo` | RunDetail.vue | 运行详情实时曲线（5s 轮询） |
| `/schedules` | ScheduleList.vue | 定时任务与启停 |

路由守卫：未登录访问非 public 页 → 跳 `/login?redirect=...`，登录后跳回。

## 环境变量

| 文件 | 值 |
| --- | --- |
| `.env.development` | `VITE_API_BASE=/api/v1`（走 dev proxy） |
| `.env.production` | `VITE_API_BASE=/api/v1`（Nginx 反代到后端） |

## 本地开发

### 前置依赖

- Node.js（建议 ≥ 18）
- 后端服务 `LoaderCloudBackendV2` 运行于 `http://127.0.0.1:8000`（FastAPI）

### 启动

```bash
# 安装依赖
npm install

# 启动 dev server（端口 5173，/api 代理到 8000）
npm run dev
```

### 默认账号

`admin / admin123`（后端 `ensure_default_user` 兜底创建）

## 构建

```bash
npm run build   # 产物输出到 dist/
npm run preview # 本地预览构建产物
```

生产部署：Nginx `location /api/ { proxy_pass http://backend:8000; }`，`location / { try_files $uri $uri/ /index.html; }`，与后端同网络部署，无跨域。

## dev proxy

- `/api` → `http://127.0.0.1:8000`（changeOrigin）
- `/ws` → `ws://127.0.0.1:8000`（预留；后端 `/ws/agent` 为 Agent 专用，浏览器不可连）

## 相关文档

- [前端项目设计方案](docs/前端项目设计方案.md) — 设计原则与契约对齐说明
- [.trae/skills/ptp-frontend-dev/SKILL.md](.trae/skills/ptp-frontend-dev/SKILL.md) — 前端开发规范（写代码前必读）

## 后端仓

https://github.com/xuemingliang0124/LoaderCloudBackend.git （FastAPI，监听 `127.0.0.1:8000`）
