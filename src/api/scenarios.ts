import request from './request'
import type { PageResult, Scenario, ScenarioIn } from '@/types/api'

export const createScenario = (payload: ScenarioIn) =>
  request.post<unknown, Scenario>('/scenarios', payload)

// 分页 + 按名称模糊查询
export interface ScenarioQuery {
  name?: string
  page?: number
  page_size?: number
}

export const listScenarios = (params: ScenarioQuery = {}) =>
  request.get<unknown, PageResult<Scenario>>('/scenarios', { params })
