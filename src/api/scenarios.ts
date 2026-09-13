import request from './request'
import type {
  PageResult,
  Scenario,
  ScenarioDeletePrecheck,
  ScenarioDeleteResult,
  ScenarioIn,
} from '@/types/api'

// 新建场景（editor+）：关联脚本须属于同一项目
export const createScenario = (project_id: number, payload: ScenarioIn) =>
  request.post<unknown, Scenario>(`/projects/${project_id}/scenarios`, payload)

// 分页 + 按名称模糊查询
export interface ScenarioQuery {
  name?: string
  page?: number
  page_size?: number
}

export const listScenarios = (project_id: number, params: ScenarioQuery = {}) =>
  request.get<unknown, PageResult<Scenario>>(
    `/projects/${project_id}/scenarios`,
    { params },
  )

// 删除前预检：返回运行中任务数、历史执行记录数、引用的定时任务
export const precheckScenarioDelete = (project_id: number, scenario_id: number) =>
  request.get<unknown, ScenarioDeletePrecheck>(
    `/projects/${project_id}/scenarios/${scenario_id}/delete-precheck`,
  )

// 删除场景；force=true 级联清理历史执行记录/结果/定时任务/MinIO 产物（运行中任务仍拒绝）
export const deleteScenario = (
  project_id: number,
  scenario_id: number,
  force = false,
) =>
  request.delete<unknown, ScenarioDeleteResult>(
    `/projects/${project_id}/scenarios/${scenario_id}`,
    { params: { force } },
  )
