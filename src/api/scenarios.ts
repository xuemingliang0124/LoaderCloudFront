import request from './request'
import type { Scenario, ScenarioIn } from '@/types/api'

export const createScenario = (payload: ScenarioIn) =>
  request.post<unknown, Scenario>('/scenarios', payload)

// 后端无分页
export const listScenarios = () => request.get<unknown, Scenario[]>('/scenarios')
