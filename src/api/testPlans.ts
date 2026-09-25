import request from './request'
import type {
  PageResult,
  TestPlan,
  TestPlanDeletePrecheck,
  TestPlanDeleteResult,
  TestPlanExecuteResult,
  TestPlanIn,
  TestPlanQuery,
  TestPlanUpdateIn,
} from '@/types/api'

// 新建测试方案（editor+）：项目内 name 不可重复（3070），scenarios 一并挂载
export const createTestPlan = (projectId: number, payload: TestPlanIn) =>
  request.post<unknown, TestPlan>(
    `/projects/${projectId}/test-plans`,
    payload,
  )

// 分页列表（viewer+）：支持名称模糊过滤，按 id 倒序，响应含 total
export const listTestPlans = (projectId: number, params: TestPlanQuery = {}) =>
  request.get<unknown, PageResult<TestPlan>>(
    `/projects/${projectId}/test-plans`,
    { params },
  )

// 方案详情（viewer+）：含挂载场景列表
export const getTestPlan = (projectId: number, planId: number) =>
  request.get<unknown, TestPlan>(
    `/projects/${projectId}/test-plans/${planId}`,
  )

// 更新方案（editor+）：name 变更后不可与项目内其他方案重复（3070）；
// scenarios 传则全量替换挂载集合
export const updateTestPlan = (
  projectId: number,
  planId: number,
  payload: TestPlanUpdateIn,
) =>
  request.put<unknown, TestPlan>(
    `/projects/${projectId}/test-plans/${planId}`,
    payload,
  )

// 删除前预检（viewer+）：返回挂载场景数与外部引用数（references 当前恒为 0）
export const precheckTestPlanDelete = (projectId: number, planId: number) =>
  request.get<unknown, TestPlanDeletePrecheck>(
    `/projects/${projectId}/test-plans/${planId}/delete-precheck`,
  )

// 删除方案（owner+）：遵循「预检 + force」模式；仅删除方案与挂载关联行，不触碰场景
export const deleteTestPlan = (
  projectId: number,
  planId: number,
  force = false,
) =>
  request.delete<unknown, TestPlanDeleteResult>(
    `/projects/${projectId}/test-plans/${planId}`,
    { params: { force } },
  )

// 一键批量执行（editor+）：按 seq 升序逐个触发场景执行，单场景失败不阻断其余
export const executeTestPlan = (projectId: number, planId: number) =>
  request.post<unknown, TestPlanExecuteResult>(
    `/projects/${projectId}/test-plans/${planId}/execute`,
  )
