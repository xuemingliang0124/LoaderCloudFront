// 后端枚举（master/app/models/enums.py）：API 输出为小写 value，禁止前端写大写字面量
// 集中状态判定与 Element Plus tag 类型映射，避免魔法字符串散落各页面

// ---- Agent 状态 ----
export const AGENT_STATUS = {
  ONLINE: 'online',
  BUSY: 'busy',
  OFFLINE: 'offline',
} as const

export const agentStatusTagType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  switch (status) {
    case AGENT_STATUS.ONLINE:
      return 'success'
    case AGENT_STATUS.BUSY:
      return 'warning'
    case AGENT_STATUS.OFFLINE:
      return 'danger'
    default:
      return 'info'
  }
}

export const agentStatusText = (status: string): string => {
  switch (status) {
    case AGENT_STATUS.ONLINE:
      return '在线'
    case AGENT_STATUS.BUSY:
      return '压测中'
    case AGENT_STATUS.OFFLINE:
      return '离线'
    default:
      return status || '-'
  }
}

// offline 之外的 Agent 都可被选来下发任务（busy 能否再派由后端选机逻辑裁决）
export const isAgentSelectable = (status: string): boolean => status !== AGENT_STATUS.OFFLINE

// ---- Run 状态 ----
export const RUN_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  STOPPING: 'stopping',
  FINISHED: 'finished',
  PARTIAL: 'partial',
  FAILED: 'failed',
  STOPPED: 'stopped',
} as const

export const runStatusTagType = (
  status: string,
): 'success' | 'warning' | 'info' | 'danger' | 'primary' => {
  switch (status) {
    case RUN_STATUS.RUNNING:
      return 'success'
    case RUN_STATUS.PENDING:
    case RUN_STATUS.STOPPING:
      return 'warning'
    case RUN_STATUS.FAILED:
    case RUN_STATUS.STOPPED:
      return 'danger'
    case RUN_STATUS.PARTIAL:
      return 'primary'
    case RUN_STATUS.FINISHED:
    default:
      return 'info'
  }
}

export const runStatusText = (status: string): string => {
  const map: Record<string, string> = {
    pending: '排队中',
    running: '运行中',
    stopping: '停止中',
    finished: '已完成',
    partial: '部分失败',
    failed: '失败',
    stopped: '已停止',
  }
  return map[status] || status || '-'
}

// pending/running/stopping 可下发停止指令；终态不可
export const isRunStoppable = (status: string): boolean =>
  status === RUN_STATUS.PENDING ||
  status === RUN_STATUS.RUNNING ||
  status === RUN_STATUS.STOPPING

// 运行中（需要轮询实时指标）；翻终态后停止轮询
export const isRunActive = (status: string | null | undefined): boolean =>
  status === RUN_STATUS.PENDING ||
  status === RUN_STATUS.RUNNING ||
  status === RUN_STATUS.STOPPING

export const RUN_TRIGGER_TEXT: Record<string, string> = {
  manual: '手动',
  scheduled: '定时',
}

// ---- 场景类型 ----
// 后端 ScenarioType(str, Enum) 四选一，API 层输出中文 value（master/app/models/enums.py）
export const SCENARIO_TYPE_OPTIONS = [
  { value: '单交易基准', label: '单交易基准' },
  { value: '单交易负载', label: '单交易负载' },
  { value: '混合场景', label: '混合场景' },
  { value: '稳定性', label: '稳定性' },
] as const

export type ScenarioType = (typeof SCENARIO_TYPE_OPTIONS)[number]['value']

export const scenarioTypeTagType = (
  t: string,
): 'primary' | 'success' | 'warning' | 'info' => {
  switch (t) {
    case '单交易基准':
      return 'info'
    case '单交易负载':
      return 'primary'
    case '混合场景':
      return 'success'
    case '稳定性':
      return 'warning'
    default:
      return 'info'
  }
}

// ---- 资产类型 / 解析状态 ----
// 后端 AssetType(str, Enum) value 为小写，API 输出按 value 序列化
export const ASSET_TYPE = {
  PLAN_DOC: 'plan_doc',
  ENV_INVENTORY: 'env_inventory',
  TXN_INVENTORY: 'txn_inventory',
  SLA_DOC: 'sla_doc',
  ARCHITECTURE_DOC: 'architecture_doc',
} as const

export type AssetTypeValue =
  | typeof ASSET_TYPE.PLAN_DOC
  | typeof ASSET_TYPE.ENV_INVENTORY
  | typeof ASSET_TYPE.TXN_INVENTORY
  | typeof ASSET_TYPE.SLA_DOC
  | typeof ASSET_TYPE.ARCHITECTURE_DOC

// 资产类型 → 中文标签（与 SRS 一致，供列表/上传/编辑下拉统一使用）
export const ASSET_TYPE_OPTIONS: { value: AssetTypeValue; label: string }[] = [
  { value: ASSET_TYPE.PLAN_DOC, label: '测试方案' },
  { value: ASSET_TYPE.ENV_INVENTORY, label: '环境清单' },
  { value: ASSET_TYPE.TXN_INVENTORY, label: '交易清单' },
  { value: ASSET_TYPE.SLA_DOC, label: 'SLA 指标' },
  { value: ASSET_TYPE.ARCHITECTURE_DOC, label: '架构说明' },
]

export const assetTypeText = (t: string): string =>
  ASSET_TYPE_OPTIONS.find((o) => o.value === t)?.label || t || '-'

// 各资产类型允许的扩展名（与后端 _ASSET_TYPE_EXTENSIONS 对齐，用于前端上传前预校验）
export const ASSET_TYPE_EXTENSIONS: Record<AssetTypeValue, string[]> = {
  plan_doc: ['.docx', '.doc', '.pdf'],
  env_inventory: ['.xlsx', '.xls'],
  txn_inventory: ['.xlsx', '.xls'],
  sla_doc: ['.docx', '.doc', '.pdf'],
  architecture_doc: ['.docx', '.doc', '.pdf', '.pptx'],
}

export const ASSET_STATUS = {
  PENDING: 'pending',
  PARSING: 'parsing',
  READY: 'ready',
  FAILED: 'failed',
} as const

export const assetStatusTagType = (
  status: string,
): 'success' | 'warning' | 'info' | 'danger' => {
  switch (status) {
    case ASSET_STATUS.READY:
      return 'success'
    case ASSET_STATUS.PARSING:
      return 'warning'
    case ASSET_STATUS.FAILED:
      return 'danger'
    case ASSET_STATUS.PENDING:
    default:
      return 'info'
  }
}

export const assetStatusText = (status: string): string => {
  const map: Record<string, string> = {
    pending: '待解析',
    parsing: '解析中',
    ready: '已就绪',
    failed: '解析失败',
  }
  return map[status] || status || '-'
}

// 仅 pending/failed 状态可触发重试解析（与后端 3063 一致）
export const isAssetRetryable = (status: string): boolean =>
  status === ASSET_STATUS.PENDING || status === ASSET_STATUS.FAILED
