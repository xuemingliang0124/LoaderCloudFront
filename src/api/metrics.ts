import request from './request'
import type { TimeseriesPoint } from '@/types/api'

// start/end 为秒级 unix；interval 默认 15
// sample_type 过滤统计类型：request=仅请求、transaction=仅事务、缺省=全部
export const getTimeseries = (
  run_no: string,
  start: number,
  end: number,
  interval = 15,
  sample_type?: 'request' | 'transaction',
) =>
  request.get<unknown, TimeseriesPoint[]>('/metrics/timeseries', {
    params: { run_no, start, end, interval, sample_type },
  })
