// ECharts 按需注册：仅引入本项目用到的图表/组件/渲染器，避免全量打包（RunDetail chunk 1MB→~400KB）
// 新页面需要其他图表类型时，在此追加注册，不要直接 import 'echarts' 全量包
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

export { echarts }
export type { EChartsType } from 'echarts/core'
export type { EChartsOption } from 'echarts'
