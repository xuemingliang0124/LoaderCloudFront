import request from './request'
import type { PageResult, Schedule, ScheduleIn } from '@/types/api'

// 新建定时任务（editor+）：关联场景须属于同一项目
export const createSchedule = (project_id: number, payload: ScheduleIn) =>
  request.post<unknown, Schedule>(`/projects/${project_id}/schedules`, payload)

// 分页 + 按名称模糊查询 + enabled 精确过滤
export interface ScheduleQuery {
  name?: string
  enabled?: boolean
  page?: number
  page_size?: number
}

export const listSchedules = (project_id: number, params: ScheduleQuery = {}) =>
  request.get<unknown, PageResult<Schedule>>(
    `/projects/${project_id}/schedules`,
    { params },
  )

// POST /projects/{project_id}/schedules/{job_id}/toggle 切换启停，返回最新 ScheduleOut
export const toggleSchedule = (project_id: number, job_id: number) =>
  request.post<unknown, Schedule>(
    `/projects/${project_id}/schedules/${job_id}/toggle`,
  )
