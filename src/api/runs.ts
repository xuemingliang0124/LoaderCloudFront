import request from './request'
import type { PageResult, Run, RunCreateResult } from '@/types/api'

// 唯一分页列表
export const listRuns = (page = 1, page_size = 20) =>
  request.get<unknown, PageResult<Run>>('/runs', { params: { page, page_size } })

// POST /runs 返回 { run_no, agent_ids }（agent_ids 是后端实际选中的压力机）
export const createRun = (scenario_id: number, agent_ids?: string[]) =>
  request.post<unknown, RunCreateResult>('/runs', { scenario_id, agent_ids })

export const stopRun = (run_no: string) =>
  request.post<unknown, void>(`/runs/${run_no}/stop`)
