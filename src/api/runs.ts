import request from './request'
import type { PageResult, Run, RunCreateResult } from '@/types/api'

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
