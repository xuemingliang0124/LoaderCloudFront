import request from './request'
import type { Script } from '@/types/api'

// POST /scripts 是 multipart：file + name/version/description/params(JSON 字符串) + data_files(多文件)
// params 在 view 层 JSON.stringify 后作为表单字段传入
export const uploadScript = (formData: FormData) =>
  request.post<unknown, Script>('/scripts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// 后端无分页
export const listScripts = () => request.get<unknown, Script[]>('/scripts')
