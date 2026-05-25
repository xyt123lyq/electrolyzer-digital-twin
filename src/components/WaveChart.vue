<template>
  <div class="panel wave-chart">
    <div class="panel-title">{{ title }}</div>
    <div ref="chartHost" class="chart-host"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { telemetry } from '../store/useTelemetry.js'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

/**
 * 通用波形 — 支持 'voltage' (V-T) / 'current' (I-T).
 * activeCell >= 0 时只展示对应 cell 的曲线 (单线 + 配色匹配), -1 时回到全量.
 * 时间窗口可参数化, 默认 60s.
 */
const props = defineProps({
  type: { type: String, default: 'voltage' },  // 'voltage' | 'current'
  windowSec: { type: Number, default: 60 },
  activeCell: { type: Number, default: -1 }    // -1 = 全量 / 0..2 = 聚焦该 cell
})

const chartHost = ref(null)
let chart = null
let stopWatch = null
let resizeObs = null

const COLORS = ['#29b6ff', '#ffdf6c', '#6effb5']
const AREA_RGBA = ['rgba(41,182,255,0.18)', 'rgba(255,223,108,0.15)', 'rgba(110,255,181,0.15)']

const title = computed(() => {
  const cellTag = props.activeCell >= 0 ? ` · Cell ${props.activeCell + 1}` : ''
  if (props.type === 'voltage') return props.activeCell >= 0 ? `V-T 曲线${cellTag} 电压` : 'V-T 曲线 · 三单元实时电压'
  if (props.type === 'current') return props.activeCell >= 0 ? `I-T 曲线${cellTag} 极片电流` : 'I-T 曲线 · 总电流'
  return '曲线'
})

function baseOption() {
  return {
    backgroundColor: 'transparent',
    grid: { left: 50, right: 18, top: 30, bottom: 28 },
    legend: {
      top: 4,
      right: 12,
      textStyle: { color: '#9ec6ee', fontSize: 11 },
      itemWidth: 12, itemHeight: 6
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(5,25,50,0.95)',
      borderColor: '#3899e6',
      textStyle: { color: '#cfe7ff', fontSize: 12 },
      axisPointer: { lineStyle: { color: '#3899e6' } }
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#1d4a78' } },
      axisLabel: { color: '#7ba6cf', fontSize: 10 },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: '#1d4a78' } },
      axisLabel: { color: '#7ba6cf', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(80,180,255,0.12)' } },
      name: props.type === 'voltage' ? 'V' : 'A',
      nameTextStyle: { color: '#7ba6cf', fontSize: 10 }
    },
    series: buildSeriesShell()
  }
}

function buildSeriesShell() {
  const common = {
    type: 'line',
    showSymbol: false,
    smooth: 0.3,
    lineStyle: { width: 1.6 }
  }
  if (props.type === 'voltage') {
    if (props.activeCell >= 0) {
      const i = props.activeCell
      return [
        { ...common, name: `Cell${i + 1}`, itemStyle: { color: COLORS[i] },
          areaStyle: { color: AREA_RGBA[i] }, lineStyle: { width: 2.0, color: COLORS[i] }, data: [] }
      ]
    }
    return [
      { ...common, name: 'Cell1', itemStyle: { color: COLORS[0] }, areaStyle: { color: 'rgba(41,182,255,0.15)' }, data: [] },
      { ...common, name: 'Cell2', itemStyle: { color: COLORS[1] }, areaStyle: { color: 'rgba(255,223,108,0.10)' }, data: [] },
      { ...common, name: 'Cell3', itemStyle: { color: COLORS[2] }, areaStyle: { color: 'rgba(110,255,181,0.10)' }, data: [] }
    ]
  }
  // current: 串联回路下三单元电流相同, 切换 cell 时只改名字 + 配色, 突出"该 cell 通过的电流"
  if (props.activeCell >= 0) {
    const i = props.activeCell
    return [
      { ...common, name: `Cell${i + 1}`, itemStyle: { color: COLORS[i] },
        areaStyle: { color: AREA_RGBA[i] }, lineStyle: { width: 2.0, color: COLORS[i] }, data: [] }
    ]
  }
  return [
    { ...common, name: '总电流', itemStyle: { color: '#ff8e6e' }, areaStyle: { color: 'rgba(255,142,110,0.20)' }, data: [] }
  ]
}

function refresh() {
  if (!chart) return
  const now = Date.now()
  const minT = now - props.windowSec * 1000
  const points = telemetry.history.filter(s => s.timestamp >= minT)

  if (props.type === 'voltage') {
    if (props.activeCell >= 0) {
      const key = ['cell1_voltage', 'cell2_voltage', 'cell3_voltage'][props.activeCell]
      const d = points.map(s => [s.timestamp, s[key]])
      chart.setOption({ xAxis: { min: minT, max: now }, series: [{ data: d }] })
    } else {
      const d1 = points.map(s => [s.timestamp, s.cell1_voltage])
      const d2 = points.map(s => [s.timestamp, s.cell2_voltage])
      const d3 = points.map(s => [s.timestamp, s.cell3_voltage])
      chart.setOption({ xAxis: { min: minT, max: now }, series: [{ data: d1 }, { data: d2 }, { data: d3 }] })
    }
  } else {
    const d = points.map(s => [s.timestamp, s.current])
    chart.setOption({ xAxis: { min: minT, max: now }, series: [{ data: d }] })
  }
}

onMounted(() => {
  chart = echarts.init(chartHost.value, null, { renderer: 'canvas' })
  chart.setOption(baseOption())
  refresh()
  // 用 timestamp 触发刷新 — 不依赖 history.length (满后不再变化)
  stopWatch = watch(() => telemetry.current.timestamp, refresh)
  // activeCell 切换: series 数量/配色都变, 必须整体重建 (notMerge=true)
  watch(() => props.activeCell, () => {
    if (!chart) return
    chart.setOption(baseOption(), true)
    refresh()
  })

  resizeObs = new ResizeObserver(() => chart && chart.resize())
  resizeObs.observe(chartHost.value)
})

onBeforeUnmount(() => {
  stopWatch && stopWatch()
  resizeObs && resizeObs.disconnect()
  chart && chart.dispose()
  chart = null
})
</script>

<style scoped>
.wave-chart {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.chart-host {
  flex: 1;
  width: 100%;
  min-height: 0;
}
</style>
