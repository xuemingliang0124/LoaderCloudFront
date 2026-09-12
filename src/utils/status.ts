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
