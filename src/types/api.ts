// 镜像后端 master/app/schemas/*.py + app/models/enums.py，字段全 snake_case
// 注意：枚举 API 输出为小写 value（如 running/online），见 utils/status.ts

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  total: number
  items: T[]
}

// auth
export interface LoginIn {
  username: string
  password: string
}
export interface LoginOut {
  token: string
  username: string
  role: string
}

// agent（AgentOut）
export interface Agent {
  id: number
  agent_id: string
  ip: string
  hostname: string
  tags: string[] | null
  jmeter_version: string
  plugins: string[] | null // Agent 已安装的第三方插件 jar 文件名
  cpu_cores: number
  mem_total_gb: number
  status: string // online | busy | offline
  cpu_percent: number
  mem_percent: number
  current_run_no: string | null
  last_heartbeat: string | null
}

// run（RunOut）
export interface Run {
  id: number
  run_no: string
  scenario_id: number
  status: string // pending | running | stopping | finished | partial | failed | stopped
  trigger: string // manual | scheduled
  agent_ids: string[] | null
  start_time: string | null
  end_time: string | null
  error_message: string
  created_by: string
}
export interface RunCreateResult {
  run_no: string
  agent_ids: string[]
}

// script（ScriptOut）
export interface ScriptParam {
  key: string
  default?: string
  desc?: string
}
export interface ScriptAttachment {
  key: string
  filename: string
}
export interface Script {
  id: number
  name: string
  version: string
  file_key: string
  data_files: ScriptAttachment[] | null
  params: ScriptParam[] | null
  plugins: ScriptAttachment[] | null // 随任务下发的第三方插件 jar
  description: string
}

// scenario（ScenarioOut / ScenarioIn）
export interface Scenario {
  id: number
  name: string
  script_id: number
  param_overrides: Record<string, unknown> | null
  agent_tags: string[] | null
  agent_count: number
  total_threads: number // >0 按 Agent CPU 核数拆分；0 每台全量加压
  duration: number
  description: string
}
export interface ScenarioIn {
  name: string
  script_id: number
  param_overrides?: Record<string, unknown>
  agent_tags?: string[]
  agent_count?: number
  total_threads?: number
  duration?: number
  description?: string
}

// schedule（ScheduleOut / ScheduleIn）
export interface Schedule {
  id: number
  name: string
  scenario_id: number
  cron: string
  enabled: boolean
  last_run_no: string | null
}
export interface ScheduleIn {
  name: string
  scenario_id: number
  cron: string
}

// metrics（timeseries）：后端已把 ES 聚合拍平为点列表
export interface TimeseriesPoint {
  ts: number // 秒级 unix（绝对时区无关）
  label: string
  avg_rt: number // 平均响应时间 ms
  tps: number
  error_rate: number // 百分比 0~100（后端已从 0~1 比率 *100）
}
