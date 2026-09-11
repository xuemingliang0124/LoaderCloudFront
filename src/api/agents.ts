import request from './request'
import type { Agent, PageResult } from '@/types/api'

// 列表查询参数：keyword 模糊匹配 agent_id/IP/主机名，status 精确过滤
export interface AgentQuery {
  keyword?: string
  status?: string
  page?: number
  page_size?: number
}

export const listAgents = (params: AgentQuery = {}) =>
  request.get<unknown, PageResult<Agent>>('/agents', { params })
