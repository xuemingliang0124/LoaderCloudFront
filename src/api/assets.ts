import request from './request'
import type {
  Asset,
  AssetDeleteResult,
  AssetQuery,
  AssetRetryResult,
  AssetUploadResult,
  AssetUpdateIn,
  KnowledgeSearchResult,
  PageResult,
} from '@/types/api'

// 分页 + 类型/状态/名称过滤
export const listAssets = (projectId: number, params: AssetQuery = {}) =>
  request.get<unknown, PageResult<Asset>>(
    `/projects/${projectId}/assets`,
    { params },
  )

// 资产详情
export const getAsset = (projectId: number, assetId: number) =>
  request.get<unknown, Asset>(`/projects/${projectId}/assets/${assetId}`)

// 上传文档资产：multipart，file + asset_type + name? + description?
// 后端按 (project_id, hash_sha256) 去重：命中既有记录返回 reused=true
export const uploadAsset = (projectId: number, formData: FormData) =>
  request.post<unknown, AssetUploadResult>(
    `/projects/${projectId}/assets`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )

// 更新元数据：仅名称/描述/类型可改，文件本体不可替换
export const updateAsset = (
  projectId: number,
  assetId: number,
  payload: AssetUpdateIn,
) =>
  request.put<unknown, Asset>(
    `/projects/${projectId}/assets/${assetId}`,
    payload,
  )

// 删除：删库行 + best-effort 清理 MinIO 对象
export const deleteAsset = (projectId: number, assetId: number) =>
  request.delete<unknown, AssetDeleteResult>(
    `/projects/${projectId}/assets/${assetId}`,
  )

// 重试解析：pending/failed 状态可重新投递 D3 解析任务
export const retryAssetParse = (projectId: number, assetId: number) =>
  request.post<unknown, AssetRetryResult>(
    `/projects/${projectId}/assets/${assetId}/retry-parse`,
  )

// RAG 知识检索：非嵌套路径，project_id 走 query 参数
export const knowledgeSearch = (
  projectId: number,
  q: string,
  topK = 5,
) =>
  request.get<unknown, KnowledgeSearchResult>('/assets/knowledge-search', {
    params: { project_id: projectId, q, top_k: topK },
  })
