<template>
  <div class="panel iv-chart">
    <div class="panel-title">{{ title }}</div>
    <div ref="chartHost" class="chart-host"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent, TooltipComponent, LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { telemetry } from '../store/useTelemetry.js'

echarts.use([LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  activeCell: { type: Number, default: -1 }    // -1 = 三单元平均 / 0..2 = 聚焦该 cell
})

const chartHost = ref(null)
let chart = null
let stopWatch = null
let resizeObs = null

const title = computed(() =>
  props.activeCell >= 0
    ? `I-V 曲线 · Cell ${props.activeCell + 1} 极化特性`
    : 'I-V 曲线 · 极化特性'
)

// 一条参考极化曲线 (理想模型): U = U0 + R*I, 用作"历史/参考"基线
function buildPolarizationCurve() {
  const points = []
  for (let i = 0; i <= 16; i++) {
    const I = i
    const V = 1.48 + 0.04 * I + 0.002 * I * I
    points.push([V, I])
  }
  return points
}

function baseOption() {
  return {
    backgroundColor: 'transparent',
    grid: { left: 50, right: 16, top: 32, bottom: 40 },
    legend: {
      top: 4,
      right: 12,
      textStyle: { color: '#9ec6ee', fontSize: 11 },
      itemWidth: 12, itemHeight: 6
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(5,25,50,0.95)',
      borderColor: '#3899e6',
      textStyle: { color: '#cfe7ff', fontSize: 12 }
    },
    xAxis: {
      type: 'value',
      name: 'V (V)',
      nameTextStyle: { color: '#7ba6cf', fontSize: 10 },
      min: 1.3, max: 2.4,
      axisLine: { lineStyle: { color: '#1d4a78' } },
      axisLabel: { color: '#7ba6cf', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(80,180,255,0.12)' } }
    },
    yAxis: {
      type: 'value',
      name: 'I (A)',
      nameTextStyle: { color: '#7ba6cf', fontSize: 10 },
      min: 0, max: 20,
      axisLine: { lineStyle: { color: '#1d4a78' } },
      axisLabel: { color: '#7ba6cf', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(80,180,255,0.12)' } }
    },
    series: [
      {
        name: '参考极化曲线',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#3899e6', width: 1.4, type: 'dashed' },
        areaStyle: { color: 'rgba(50,150,230,0.08)' },
        data: buildPolarizationCurve()
      },
      {
        name: '实时工作点',
        type: 'scatter',
        symbolSize: 14,
        itemStyle: {
          color: '#ffdf6c',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 20,
          shadowColor: 'rgba(255,200,80,0.85)'
        },
        data: []
      },
      {
        name: '历史轨迹',
        type: 'scatter',
        symbolSize: 3,
        itemStyle: { color: 'rgba(110,255,181,0.55)' },
        data: []
      }
    ]
  }
}

function pickV(sample) {
  const i = props.activeCell
  if (i === 0) return +sample.cell1_voltage
  if (i === 1) return +sample.cell2_voltage
  if (i === 2) return +sample.cell3_voltage
  return ((+sample.cell1_voltage) + (+sample.cell2_voltage) + (+sample.cell3_voltage)) / 3
}

function refresh() {
  if (!chart) return
  const c = telemetry.current
  const curV = pickV(c)
  const history = telemetry.history.slice(-80).map(s => [pickV(s), s.current])
  chart.setOption({
    series: [
      {},
      { data: [[curV, c.current]] },
      { data: history }
    ]
  })
}

onMounted(() => {
  chart = echarts.init(chartHost.value, null, { renderer: 'canvas' })
  chart.setOption(baseOption())
  refresh()
  stopWatch = watch(() => telemetry.current.timestamp, refresh)
  // 切换 cell 时立即重算工作点 + 历史轨迹
  watch(() => props.activeCell, refresh)
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
.iv-chart {
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
