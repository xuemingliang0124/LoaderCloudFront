import request from './request'
import type { Schedule, ScheduleIn } from '@/types/api'

export const createSchedule = (payload: ScheduleIn) =>
  request.post<unknown, Schedule>('/schedules', payload)

// 后端无分页
export const listSchedules = () => request.get<unknown, Schedule[]>('/schedules')

// POST /schedules/{job_id}/toggle 切换启停，返回最新 ScheduleOut
export const toggleSchedule = (job_id: number) =>
  request.post<unknown, Schedule>(`/schedules/${job_id}/toggle`)
