import request from './request'
import type {
  Member,
  MemberGrantIn,
  MemberQuery,
  MemberRoleUpdateIn,
  PageResult,
} from '@/types/api'

// 授权用户加入项目（owner+）：目标用户须存在，不可重复授权
export const grantMember = (project_id: number, payload: MemberGrantIn) =>
  request.post<unknown, Member>(`/projects/${project_id}/members`, payload)

// 项目成员分页列表（viewer+）：支持按用户名模糊查询
export const listMembers = (project_id: number, params: MemberQuery = {}) =>
  request.get<unknown, PageResult<Member>>(
    `/projects/${project_id}/members`,
    { params },
  )

// 变更成员角色（owner+）：创建者不可降级、最后一个 owner 不可降级
export const updateMemberRole = (
  project_id: number,
  username: string,
  payload: MemberRoleUpdateIn,
) =>
  request.put<unknown, Member>(
    `/projects/${project_id}/members/${encodeURIComponent(username)}`,
    payload,
  )

// 移除成员（owner+）：创建者不可移除、最后一个 owner 不可移除
export const removeMember = (project_id: number, username: string) =>
  request.delete<unknown, { project_id: number; username: string; removed: boolean }>(
    `/projects/${project_id}/members/${encodeURIComponent(username)}`,
  )
