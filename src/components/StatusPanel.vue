<template>
  <div class="panel status-panel">
    <div class="panel-title">实时参数 · 单元监测</div>
    <div class="panel-body">
      <CellModel
        v-for="i in 3"
        :key="i"
        :index="i - 1"
        :voltage="cellVoltage(i - 1)"
        :current="telemetry.current.current"
        :temperature="telemetry.current.temperature"
        :active="activeCell === i - 1"
      />
      <div class="totals">
        <div class="total-row">
          <span class="total-label">总电压</span>
          <span class="total-value">{{ totalVoltage.toFixed(2) }} <em>V</em></span>
        </div>
        <div class="total-row">
          <span class="total-label">总电流</span>
          <span class="total-value">{{ telemetry.current.current.toFixed(1) }} <em>A</em></span>
        </div>
        <div class="total-row">
          <span class="total-label">总功率</span>
          <span class="total-value">{{ power.toFixed(1) }} <em>W</em></span>
        </div>
        <div class="total-row">
          <span class="total-label">流量</span>
          <span class="total-value">{{ telemetry.current.flow.toFixed(2) }} <em>L/min</em></span>
        </div>
        <div class="total-row">
          <span class="total-label">氢气纯度</span>
          <span class="total-value good">{{ telemetry.current.purity.toFixed(2) }} <em>%</em></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { telemetry } from '../store/useTelemetry.js'
import CellModel from './CellModel.vue'

defineProps({
  activeCell: { type: Number, default: -1 }
})

const cellVoltage = (i) => {
  const c = telemetry.current
  return [c.cell1_voltage, c.cell2_voltage, c.cell3_voltage][i] ?? 0
}

const totalVoltage = computed(() => {
  const c = telemetry.current
  return (+c.cell1_voltage) + (+c.cell2_voltage) + (+c.cell3_voltage)
})
const power = computed(() => totalVoltage.value * telemetry.current.current)
</script>

<style scoped>
.status-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.panel-body {
  flex: 1;
  overflow: auto;
}
.totals {
  margin-top: 10px;
  border-top: 1px dashed rgba(80, 180, 255, 0.25);
  padding-top: 10px;
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(3px, 0.4vw, 7px) 4px;
  font-size: clamp(10px, 0.85vw, 14px);
  border-bottom: 1px solid rgba(80, 180, 255, 0.08);
}
.total-label {
  color: var(--text-dim);
  letter-spacing: 1px;
}
.total-value {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: clamp(14px, 1.05vw, 20px);
  font-weight: 600;
  color: #ffdf6c;
  text-shadow: 0 0 8px rgba(255, 200, 80, 0.45);
}
.total-value.good { color: #6effb5; text-shadow: 0 0 8px rgba(80, 255, 160, 0.45); }
.total-value em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-dim);
  margin-left: 4px;
  font-weight: 400;
}
</style>
