import request from './request'
import type { PageResult, Schedule, ScheduleIn } from '@/types/api'

export const createSchedule = (payload: ScheduleIn) =>
  request.post<unknown, Schedule>('/schedules', payload)

// 分页 + 按名称模糊查询 + enabled 精确过滤
export interface ScheduleQuery {
  name?: string
  enabled?: boolean
  page?: number
  page_size?: number
}

export const listSchedules = (params: ScheduleQuery = {}) =>
  request.get<unknown, PageResult<Schedule>>('/schedules', { params })

// POST /schedules/{job_id}/toggle 切换启停，返回最新 ScheduleOut
export const toggleSchedule = (job_id: number) =>
  request.post<unknown, Schedule>(`/schedules/${job_id}/toggle`)
