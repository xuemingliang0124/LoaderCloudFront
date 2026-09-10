import request from './request'
import type { Agent } from '@/types/api'

// 后端无分页，一次性返回数组
export const listAgents = () => request.get<unknown, Agent[]>('/agents')
