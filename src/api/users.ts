import request from './request'
import type {
  PageResult,
  User,
  UserCreateIn,
  UserQuery,
  UserUpdateIn,
} from '@/types/api'

// 新建用户（仅 admin）：用户名不可重复
export const createUser = (payload: UserCreateIn) =>
  request.post<unknown, User>('/users', payload)

// 用户分页列表（仅 admin）：支持用户名模糊、角色精确过滤
export const listUsers = (params: UserQuery = {}) =>
  request.get<unknown, PageResult<User>>('/users', { params })

// 用户详情（仅 admin）
export const getUser = (username: string) =>
  request.get<unknown, User>(`/users/${encodeURIComponent(username)}`)

// 更新用户角色/密码（仅 admin）：role 与 password 至少传一项
// 自保护：不可降级自己；末位管理员保护
export const updateUser = (username: string, payload: UserUpdateIn) =>
  request.put<unknown, User>(
    `/users/${encodeURIComponent(username)}`,
    payload,
  )

// 删除用户（仅 admin）：不可删除自己、不可删除最后一个管理员
// 同事务级联清理 project_member
export const deleteUser = (username: string) =>
  request.delete<unknown, { username: string; deleted: boolean }>(
    `/users/${encodeURIComponent(username)}`,
  )
