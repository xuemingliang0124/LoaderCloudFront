import request from './request'
import type {
  Plugin,
  PluginDeleteResult,
  PluginSyncResult,
  PluginUpdateResult,
  PluginUploadResult,
} from '@/types/api'

// 列表查询（无分页，后端一次返回全部）
export const listPlugins = () =>
  request.get<unknown, Plugin[]>('/plugins')

// 详情（含 file_key）
export const getPlugin = (pluginId: number) =>
  request.get<unknown, Plugin>(`/plugins/${pluginId}`)

// 上传 jar：multipart/form-data
// 后端按 sha256 去重，命中既有记录时返回 deduplicated=true
export const uploadPlugin = (payload: {
  file: File
  name?: string
  version?: string
  description?: string
}) => {
  const form = new FormData()
  form.append('file', payload.file)
  if (payload.name) form.append('name', payload.name)
  form.append('version', payload.version || 'v1')
  form.append('description', payload.description || '')
  return request.post<unknown, PluginUploadResult>('/plugins', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// 启用/禁用、改描述：multipart/form-data（enabled 与 description 至少传一项）
// 启用 → 后端推 install 给在线 Agent；禁用 → 推 remove 卸载
export const updatePlugin = (
  pluginId: number,
  payload: { enabled?: boolean; description?: string },
) => {
  const form = new FormData()
  if (payload.enabled !== undefined) {
    form.append('enabled', String(payload.enabled))
  }
  if (payload.description !== undefined) {
    form.append('description', payload.description)
  }
  return request.patch<unknown, PluginUpdateResult>(
    `/plugins/${pluginId}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
}

// 删除：后端顺序为 推 remove → 清 agent_plugin → 删 jmeter_plugin → 删 MinIO 对象
export const deletePlugin = (pluginId: number) =>
  request.delete<unknown, PluginDeleteResult>(`/plugins/${pluginId}`)

// 手动触发对全部在线 Agent 同步某插件（运营兜底）
export const syncPlugin = (pluginId: number) =>
  request.post<unknown, PluginSyncResult>(`/plugins/${pluginId}/sync`)
