// 镜像后端 master/app/schemas/*.py + app/models/enums.py，字段全 snake_case
// 注意：枚举 API 输出为小写 value（如 running/online），见 utils/status.ts
import type { ScenarioType } from '@/utils/status'

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
  scenario_name: string // 接口层按 scenario_id 关联填充，ORM 无此列
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

// 场景内线程组加压参数——提交/编辑态（对应后端 ThreadGroupSettingIn）
// 仅保留可编辑字段；scheduler 强制开启、duration 取场景级时长
export interface ThreadGroupSettingIn {
  thread_group_name: string
  testclass: string
  enabled: boolean // false 时执行期整组不运行
  num_threads: number
  ramp_time: number
  tps: number // 目标 TPS，0 表示不限速
}

// 场景内线程组加压参数——后端返回（Out，含调度字段）
export interface ThreadGroupSetting extends ThreadGroupSettingIn {
  scheduler: boolean
  duration: number // scheduler=false 时为 0
}

// 场景内单个脚本关联——提交/编辑态（对应后端 ScenarioScriptIn）
export interface ScenarioScriptIn {
  script_id: number
  order_index: number
  agent_tags: string[]
  agent_count: number
  thread_groups: ThreadGroupSettingIn[]
}

// 场景内单个脚本关联——后端返回（对应 ScenarioScriptOut）
export interface ScenarioScript extends ScenarioScriptIn {
  thread_groups: ThreadGroupSetting[]
  // 前端展示用，提交时不发送给后端
  script_name?: string
}

// JMX 扫描返回的线程组（GET /scripts/{id}/thread-groups，对应 ThreadGroupOut）
export interface ThreadGroupScan {
  name: string
  testclass: string
  enabled: boolean
  num_threads: number
  ramp_time: number
  loops: number
  scheduler: boolean
  duration: number
  tps: number // TPM/60 换算值，可能为小数
}

// scenario（ScenarioOut / ScenarioIn）
export interface Scenario {
  id: number
  name: string
  scenario_type: ScenarioType
  duration: number
  param_overrides: Record<string, unknown> | null
  description: string
  scripts: ScenarioScript[]
}
export interface ScenarioIn {
  name: string
  scenario_type: ScenarioType
  duration?: number
  param_overrides?: Record<string, unknown>
  description?: string
  scripts: ScenarioScriptIn[]
}

// 场景删除预检（GET /scenarios/{id}/delete-precheck）
export interface ScenarioDeletePrecheck {
  scenario_id: number
  running_runs: number // 未结束的执行任务（pending/running/stopping），存在时禁止删除
  history_runs: number // 历史执行记录数，严格模式阻断、force 级联清理
  schedule_jobs: { id: number; name: string }[] // 引用该场景的定时任务
}

// 场景删除结果（DELETE /scenarios/{id}?force=）
export interface ScenarioDeleteResult {
  id: number
  deleted: boolean
  force: boolean
  removed_runs: number
  removed_schedules: number
  removed_artifacts: number
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
  sample_type?: 'request' | 'transaction' // 统计类型（缺省全量查询时后端返回，供前端分组）
  avg_rt: number // 平均响应时间 ms
  tps: number
  error_rate: number // 百分比 0~100（后端已从 0~1 比率 *100）
}

// 运行结果汇总（GET /runs/{run_no}/summary）
// data.summary 为全程聚合统计（含 by_label 明细）；响应时间单位均为 ms，avg_tps 为平均吞吐量(次/秒)
// 成功率前端按 success/samples*100 计算
export interface RunSummaryStats {
  samples: number // 样本数
  success: number // 成功数
  errors: number // 错误数
  min_rt: number // 最小响应时间(ms)
  avg_rt: number // 平均响应时间(ms)
  max_rt: number // 最大响应时间(ms)
  p95_rt: number // 95 分位响应时间(ms)
  avg_tps: number // 平均吞吐量(次/秒)
}

// 按 label（请求/事务名）分组的明细行
export interface RunSummaryByLabel extends RunSummaryStats {
  label: string
  sample_type: 'request' | 'transaction'
}

// 全程聚合统计 = 公共统计字段 + 按 label 分组的明细列表
export interface RunSummary extends RunSummaryStats {
  by_label: RunSummaryByLabel[]
}

export interface RunSummaryArtifact {
  key: string
  type: string
}

export interface RunSummaryResponse {
  agents: string[]
  failed_agents: string[]
  summary: RunSummary
  artifacts: RunSummaryArtifact[]
  stopped: boolean
}

// ===== 项目 / 项目成员 / 用户（项目管理 + 权限模型）=====

// 项目（ProjectOut）：my_role 为当前用户在该项目的角色（中文：项目管理员/编辑者/观察者）
// admin 对所有项目恒为「项目管理员」；非成员为「观察者」（列表接口仅返回成员项目，实际为成员角色）
export interface Project {
  id: number
  name: string
  description: string
  created_by: string
  created_at: string
  updated_at: string
  my_role: string
}
export interface ProjectIn {
  name: string
  description?: string
}
// ProjectUpdateIn：name 与 description 至少提供一项，前端按需传
export interface ProjectUpdateIn {
  name?: string
  description?: string
}
export interface ProjectQuery {
  name?: string
  page?: number
  page_size?: number
}

// 项目删除预检（GET /projects/{id}/delete-precheck）
export interface ProjectDeletePrecheck {
  project_id: number
  scripts: number // 项目内脚本数
  scenarios: number // 项目内场景数
  running_runs: number // 未结束的执行任务，存在时禁止删除（force 也拒绝）
  schedule_jobs: { id: number; name: string }[] // 项目内定时任务
}
// 项目删除结果（DELETE /projects/{id}?force=）
export interface ProjectDeleteResult {
  id: number
  deleted: boolean
  force: boolean
  removed_scripts: number
  removed_scenarios: number
  removed_runs: number
  removed_schedules: number
  removed_artifacts: number
}

// 项目成员角色（API 收/出中文）：项目管理员 / 编辑者 / 观察者
export type ProjectRole = '项目管理员' | '编辑者' | '观察者'

// 项目成员（MemberOut）
export interface Member {
  id: number
  project_id: number
  username: string
  role: string // 中文角色名
  granted_by: string
  created_at: string
  updated_at: string
}
export interface MemberGrantIn {
  username: string
  role: ProjectRole
}
export interface MemberRoleUpdateIn {
  role: ProjectRole
}
export interface MemberQuery {
  username?: string
  page?: number
  page_size?: number
}

// 全局角色（API 收/出中文）：管理员 / 普通用户
export type GlobalRole = '管理员' | '普通用户'

// 用户（UserOut）：不含密码，role 为中文角色名
export interface User {
  id: number
  username: string
  role: string // 中文角色名
  created_at: string
  updated_at: string
}
export interface UserCreateIn {
  username: string
  password: string
  role: GlobalRole
}
// UserUpdateIn：role 与 password 至少提供一项
export interface UserUpdateIn {
  role?: GlobalRole
  password?: string
}
export interface UserQuery {
  username?: string
  role?: GlobalRole
  page?: number
  page_size?: number
}

// ===== 全局插件管理（JMeter 第三方插件 jar 池）=====
// 对应后端 GET /plugins 列表项 / GET /plugins/{id} 详情
// 上传去重：同 sha256 视为同一插件，后端返回 deduplicated=true
export interface Plugin {
  id: number
  name: string
  version: string
  sha256: string // 64 位内容指纹，前端展示需截断
  size: number // 字节数，前端格式化为 KB/MB
  enabled: boolean // 禁用时不进入 expected_plugins，Agent 收 MSG_PLUGIN_REMOVE 卸载
  description: string
  created_by: string
  // 仅详情接口返回，列表不返回
  file_key?: string
}
// 上传返回：deduplicated=true 表示同 sha 已存在，复用既有记录
export interface PluginUploadResult {
  id: number
  deduplicated: boolean
}
// PATCH /plugins/{id} 返回
export interface PluginUpdateResult {
  id: number
  enabled: boolean
}
// DELETE /plugins/{id} 返回
export interface PluginDeleteResult {
  id: number
  deleted: boolean
}
// POST /plugins/{id}/sync 返回：pushed_to 为推送到的在线 Agent 数量
export interface PluginSyncResult {
  plugin_id: number
  pushed_to: number
}

// ===== 资产管理（项目作用域文档资产，对应后端 assets.py）=====
// 资产类型（AssetType value，小写）：决定 D3 解析管道走向与列映射规则
export type AssetType =
  | 'plan_doc'
  | 'env_inventory'
  | 'txn_inventory'
  | 'sla_doc'
  | 'architecture_doc'

// 解析状态机：PENDING → PARSING → READY / FAILED
export type AssetStatus = 'pending' | 'parsing' | 'ready' | 'failed'

// 资产（AssetOut）：文件本体存 MinIO，元数据与解析状态入 MySQL
export interface Asset {
  id: number
  project_id: number
  name: string
  asset_type: AssetType
  status: AssetStatus
  filename: string
  file_key: string
  hash_sha256: string
  file_size: number
  content_type: string
  description: string
  parse_meta: Record<string, unknown> | null
  created_by: string
  created_at: string
  updated_at: string
}

// 上传返回：reused=true 表示同 hash 复用既有记录，未重复存 MinIO
export interface AssetUploadResult extends Asset {
  reused: boolean
}

// 更新请求：name/description/asset_type 至少传一项
export interface AssetUpdateIn {
  name?: string
  description?: string
  asset_type?: AssetType
}

// 列表查询参数
export interface AssetQuery {
  name?: string
  asset_type?: AssetType
  status?: AssetStatus
  page?: number
  page_size?: number
}

// 删除返回
export interface AssetDeleteResult {
  id: number
  project_id: number
  deleted: boolean
}

// 重试解析返回：queued=true 表示已重新投递 D3 解析任务
export interface AssetRetryResult {
  id: number
  status: AssetStatus
  queued: boolean
}

// 知识检索单条命中（含相似度分）
export interface KnowledgeSearchItem {
  citation: string
  content: string
  score: number
  asset_id: number | null
  asset_type: string
  chunk_index: number
}
export interface KnowledgeSearchResult {
  total: number
  items: KnowledgeSearchItem[]
}

// ===== 交易清单管理（项目作用域被测交易资产，对应后端 transactions.py）=====
// 交易是场景编排的语义单元：一个交易可对应多版本 JMX 脚本，
// default_script_id 为弱关联（nullable，仅标记默认执行版本）
// (project_id, txn_code) 项目内唯一
export interface Transaction {
  id: number
  project_id: number
  name: string
  txn_code: string
  default_script_id: number | null
  sla_tps: number | null // 目标吞吐量（次/秒）
  sla_p95_ms: number | null // P95 响应时间（毫秒）
  sla_error_rate: number | null // 错误率上限（百分比 0-100）
  description: string
  created_at: string
  updated_at: string
}

// 新建交易请求
export interface TransactionIn {
  name: string
  txn_code: string
  default_script_id?: number | null
  sla_tps?: number | null
  sla_p95_ms?: number | null
  sla_error_rate?: number | null
  description?: string
}

// 更新交易请求：所有字段可选，至少传一项
export interface TransactionUpdateIn {
  name?: string
  txn_code?: string
  default_script_id?: number | null
  sla_tps?: number | null
  sla_p95_ms?: number | null
  sla_error_rate?: number | null
  description?: string
}

// 列表查询参数：name 模糊、txn_code 精确
export interface TransactionQuery {
  name?: string
  txn_code?: string
  page?: number
  page_size?: number
}

// 删除预检结果（当前阶段 scenarios/test_plans 恒为 0）
export interface TransactionDeletePrecheck {
  transaction_id: number
  scenarios: number
  test_plans: number
}

// 删除结果
export interface TransactionDeleteResult {
  id: number
  deleted: boolean
  force: boolean
  removed_scenarios: number
  removed_test_plans: number
}

// ===== LLM 对话（FR-09/FR-10，SRS 6.1，对应后端 chat.py）=====
// POST /chat 与 /chat/stream 请求体
export interface ChatRequest {
  project_id: number
  message: string
  use_tools?: boolean
  top_k?: number
  run_no?: string
}
// FR-09 统一输出（同步接口 data 字段；流式 done 事件携带同样五字段）
export interface AnswerOut {
  answer: string
  citations: string[]
  used_metrics: string[] | null
  confidence: number
  notes: string
}
