import request from './request'
import type {
  PageResult,
  Run,
  RunCreateResult,
  RunSummary,
  RunSummaryResponse,
} from '@/types/api'

// 唯一分页列表
export const listRuns = (project_id: number, page = 1, page_size = 20) =>
  request.get<unknown, PageResult<Run>>(`/projects/${project_id}/runs`, {
    params: { page, page_size },
  })

// 执行记录详情（2003 不存在 / 3022 不属于该项目），返回结构与列表项一致
export const getRun = (project_id: number, run_no: string) =>
  request.get<unknown, Run>(
    `/projects/${project_id}/runs/${encodeURIComponent(run_no)}`,
  )

// POST /projects/{project_id}/runs 返回 { run_no, agent_ids }（agent_ids 是后端实际选中的压力机）
export const createRun = (
  project_id: number,
  scenario_id: number,
  agent_ids?: string[],
) =>
  request.post<unknown, RunCreateResult>(`/projects/${project_id}/runs`, {
    scenario_id,
    agent_ids,
  })

export const stopRun = (project_id: number, run_no: string) =>
  request.post<unknown, void>(`/projects/${project_id}/runs/${run_no}/stop`)

// 运行结果汇总（GET /runs/{run_no}/summary），返回全程聚合 + 按 label 分组的明细
// 后端默认返回含 request/transaction 两类 by_label 行，统计类型由前端过滤
export const getRunSummary = (run_no: string) =>
  request.get<unknown, RunSummaryResponse>(`/runs/${encodeURIComponent(run_no)}/summary`)

// 执行期实时汇总（GET /runs/{run_no}/realtime-summary）
// 与终态 /summary 差异：执行中可查（不抛 2004）、p95 为 tdigest 近似值、
// avg_tps 用窗口口径；返回体无 agents/failed_agents/artifacts/stopped 外层包装
export const getRunRealtimeSummary = (run_no: string) =>
  request.get<unknown, RunSummary>(
    `/runs/${encodeURIComponent(run_no)}/realtime-summary`,
  )
