import request from './request'
import type {
  Environment,
  EnvironmentDeletePrecheck,
  EnvironmentDeleteResult,
  EnvironmentIn,
  EnvironmentQuery,
  EnvironmentUpdateIn,
  PageResult,
} from '@/types/api'

// 分页列表：name 模糊、env_code 精确，按 id 倒序
export const listEnvironments = (projectId: number, params: EnvironmentQuery = {}) =>
  request.get<unknown, PageResult<Environment>>(
    `/projects/${projectId}/environments`,
    { params },
  )

// 环境详情
export const getEnvironment = (projectId: number, envId: number) =>
  request.get<unknown, Environment>(`/projects/${projectId}/environments/${envId}`)

// 新建环境：项目内 env_code 不可重复（3040）
export const createEnvironment = (projectId: number, payload: EnvironmentIn) =>
  request.post<unknown, Environment>(`/projects/${projectId}/environments`, payload)

// 更新环境：所有字段可选，至少传一项；env_code 变更后不可与项目内其他重复
export const updateEnvironment = (
  projectId: number,
  envId: number,
  payload: EnvironmentUpdateIn,
) =>
  request.put<unknown, Environment>(
    `/projects/${projectId}/environments/${envId}`,
    payload,
  )

// 删除前预检：返回引用该环境的场景数
export const precheckEnvironmentDelete = (projectId: number, envId: number) =>
  request.get<unknown, EnvironmentDeletePrecheck>(
    `/projects/${projectId}/environments/${envId}/delete-precheck`,
  )

// 删除：遵循「预检 + force」模式，被场景引用时严格模式拒绝（3043）
export const deleteEnvironment = (
  projectId: number,
  envId: number,
  force = false,
) =>
  request.delete<unknown, EnvironmentDeleteResult>(
    `/projects/${projectId}/environments/${envId}`,
    { params: { force } },
  )
