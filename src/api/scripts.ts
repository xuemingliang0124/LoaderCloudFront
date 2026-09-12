import request from './request'
import type { PageResult, Script, ThreadGroupScan } from '@/types/api'

// POST /scripts 是 multipart：file + name/version/description/params(JSON 字符串) + data_files(多文件)
// params 在 view 层 JSON.stringify 后作为表单字段传入
export const uploadScript = (formData: FormData) =>
  request.post<unknown, Script>('/scripts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// 分页 + 按名称模糊查询
export interface ScriptQuery {
  name?: string
  page?: number
  page_size?: number
}

export const listScripts = (params: ScriptQuery = {}) =>
  request.get<unknown, PageResult<Script>>('/scripts', { params })

// PUT /scripts/{id}/jmx：更换 JMX 文件（multipart，仅 file 字段）
// 后端比对新旧文件线程组（名称+类型），不一致返回业务错误 code 3009
export const replaceScriptJmx = (scriptId: number, formData: FormData) =>
  request.put<unknown, Script>(`/scripts/${scriptId}/jmx`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// DELETE /scripts/{id}：被场景引用时后端拒绝（code 3010）
export const deleteScript = (scriptId: number) =>
  request.delete<unknown, { id: number; deleted: boolean }>(`/scripts/${scriptId}`)

// GET /scripts/{id}/thread-groups：扫描 JMX 返回线程组（变量引用已按作用域解析）
export const getThreadGroups = (scriptId: number) =>
  request.get<unknown, { thread_groups: ThreadGroupScan[] }>(
    `/scripts/${scriptId}/thread-groups`,
  )
