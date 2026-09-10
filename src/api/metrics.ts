import request from './request'
import type { TimeseriesPoint } from '@/types/api'

// start/end 为秒级 unix；interval 默认 15
export const getTimeseries = (
  run_no: string,
  start: number,
  end: number,
  interval = 15,
) => request.get<unknown, TimeseriesPoint[]>('/metrics/timeseries', { params: { run_no, start, end, interval } })
