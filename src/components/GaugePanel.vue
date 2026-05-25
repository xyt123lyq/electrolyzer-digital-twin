<template>
  <div class="panel gauge-panel">
    <div class="panel-title">仪表区 · 流量 / 纯度 / 温度</div>
    <div ref="chartHost" class="chart-host"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { telemetry } from '../store/useTelemetry.js'

echarts.use([GaugeChart, TitleComponent, TooltipComponent, CanvasRenderer])

const chartHost = ref(null)
let chart = null
let stopWatch = null
let resizeObs = null

const GAUGES = [
  { key: 'flow',        title: '流量',       unit: 'L/min', min: 0, max: 8,  good: [1, 5],   color: ['#29b6ff', '#66e3ff'] },
  { key: 'purity',      title: '氢气纯度',   unit: '%',     min: 90, max: 100, good: [98, 100], color: ['#6effb5', '#a8ffd2'] },
  { key: 'temperature', title: '温度',       unit: '℃',    min: 0, max: 100, good: [40, 60], color: ['#ffae42', '#ffdf6c'] }
]

function gaugeSeries(idx, g, value) {
  const centerX = `${(idx + 0.5) * (100 / GAUGES.length)}%`
  return {
    type: 'gauge',
    center: [centerX, '60%'],
    radius: '70%',
    min: g.min,
    max: g.max,
    startAngle: 220,
    endAngle: -40,
    progress: {
      show: true,
      width: 8,
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [{ offset: 0, color: g.color[0] }, { offset: 1, color: g.color[1] }]
        }
      }
    },
    axisLine: {
      lineStyle: { width: 8, color: [[1, 'rgba(80,180,255,0.15)']] }
    },
    pointer: { length: '55%', width: 3, itemStyle: { color: g.color[1] } },
    axisTick: { distance: -14, length: 4, lineStyle: { color: 'rgba(150,200,255,0.5)' } },
    splitLine: { distance: -16, length: 8, lineStyle: { color: 'rgba(150,200,255,0.7)' } },
    axisLabel: { color: '#7ba6cf', fontSize: 9, distance: -32 },
    anchor: { show: true, size: 8, itemStyle: { color: g.color[1], borderColor: '#fff', borderWidth: 1 } },
    title: { show: true, offsetCenter: [0, '78%'], color: '#9ec6ee', fontSize: 12 },
    detail: {
      valueAnimation: true,
      formatter: `{value} ${g.unit}`,
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 600,
      offsetCenter: [0, '40%']
    },
    data: [{ value: +value.toFixed(2), name: g.title }]
  }
}

function refresh() {
  if (!chart) return
  const c = telemetry.current
  chart.setOption({
    series: GAUGES.map((g, i) => gaugeSeries(i, g, c[g.key]))
  })
}

onMounted(() => {
  chart = echarts.init(chartHost.value, null, { renderer: 'canvas' })
  refresh()
  stopWatch = watch(() => telemetry.current, refresh, { deep: true })
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
.gauge-panel {
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
