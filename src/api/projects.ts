import request from './request'
import type {
  PageResult,
  Project,
  ProjectDeletePrecheck,
  ProjectDeleteResult,
  ProjectIn,
  ProjectQuery,
  ProjectUpdateIn,
} from '@/types/api'

// 新建项目：创建者自动成为 owner
export const createProject = (payload: ProjectIn) =>
  request.post<unknown, Project>('/projects', payload)

// 分页 + 按名称模糊查询：admin 全量可见，非 admin 仅可见成员项目
export const listProjects = (params: ProjectQuery = {}) =>
  request.get<unknown, PageResult<Project>>('/projects', { params })

// 更新项目名称/描述（owner+，name 与 description 至少传一项）
export const updateProject = (project_id: number, payload: ProjectUpdateIn) =>
  request.put<unknown, Project>(`/projects/${project_id}`, payload)

// 删除前预检：返回项目内脚本/场景/运行中任务/定时任务数
export const precheckProjectDelete = (project_id: number) =>
  request.get<unknown, ProjectDeletePrecheck>(
    `/projects/${project_id}/delete-precheck`,
  )

// 删除项目（owner+）：严格模式有资产拒绝，force=true 级联清理（运行中任务仍拒绝）
export const deleteProject = (project_id: number, force = false) =>
  request.delete<unknown, ProjectDeleteResult>(`/projects/${project_id}`, {
    params: { force },
  })
