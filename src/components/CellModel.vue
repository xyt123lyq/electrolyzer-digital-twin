<template>
  <div class="cell-card" :class="['lvl-' + alarmLevel, { active }]">
    <div class="cell-card-header">
      <span class="cell-tag">Cell {{ index + 1 }}</span>
      <span class="cell-state">
        <span class="dot" :class="dotKind"></span>
        {{ stateText }}
      </span>
    </div>
    <div class="cell-card-body">
      <div class="metric">
        <div class="metric-label">膜电压</div>
        <div class="metric-value">{{ voltage.toFixed(2) }}<span>V</span></div>
      </div>
      <div class="metric">
        <div class="metric-label">电流</div>
        <div class="metric-value">{{ current.toFixed(1) }}<span>A</span></div>
      </div>
      <div class="metric">
        <div class="metric-label">温度</div>
        <div class="metric-value">{{ temperature.toFixed(1) }}<span>℃</span></div>
      </div>
    </div>
    <div class="cell-card-footer">
      <div class="bar">
        <div class="bar-fill" :style="{ width: voltagePct + '%' }"></div>
      </div>
      <span class="bar-text">电压基准 1.80 ~ 2.00 V</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { thresholds } from '../store/useTelemetry.js'

const props = defineProps({
  index: { type: Number, required: true },
  voltage: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  temperature: { type: Number, default: 0 },
  active: { type: Boolean, default: false }
})

const t = computed(() => thresholds[`cell${props.index + 1}_voltage`] || thresholds.cell1_voltage)

const voltagePct = computed(() => {
  const min = t.value.L, max = t.value.H
  const v = Math.min(max, Math.max(min, props.voltage))
  return ((v - min) / (max - min)) * 100
})

const alarmLevel = computed(() => {
  const v = props.voltage
  const th = t.value
  if (v >= th.HH || v <= th.LL) return 'crit'
  if (v >= th.H  || v <= th.L)  return 'warn'
  return 'ok'
})

const dotKind = computed(() => {
  if (alarmLevel.value === 'crit') return 'bad'
  if (alarmLevel.value === 'warn') return 'warn'
  return 'ok'
})

const stateText = computed(() => {
  const v = props.voltage
  const th = t.value
  if (v >= th.HH) return '电压致命高'
  if (v <= th.LL) return '电压致命低'
  if (v >= th.H)  return '电压偏高'
  if (v <= th.L)  return '电压偏低'
  return '运行正常'
})
</script>

<style scoped>
.cell-card {
  background: rgba(10, 35, 65, 0.55);
  border: 1px solid var(--border-cyan);
  padding: clamp(6px, 0.7vw, 11px) clamp(8px, 0.85vw, 13px);
  margin-bottom: clamp(6px, 0.7vw, 11px);
  border-radius: 2px;
  position: relative;
  transition: all .3s;
}
.cell-card.active {
  border-color: var(--border-cyan-strong);
  box-shadow: 0 0 16px rgba(80, 200, 255, 0.55);
  background: rgba(20, 60, 110, 0.6);
}
.cell-card.lvl-warn {
  border-color: rgba(255, 174, 66, 0.7);
  box-shadow: 0 0 14px rgba(255, 174, 66, 0.35);
  background: rgba(60, 40, 10, 0.5);
}
.cell-card.lvl-crit {
  border-color: rgba(255, 90, 110, 0.85);
  box-shadow: 0 0 18px rgba(255, 80, 90, 0.55);
  background: rgba(60, 15, 25, 0.55);
  animation: cell-alarm-blink 1.2s ease-in-out infinite;
}
@keyframes cell-alarm-blink {
  0%, 100% { box-shadow: 0 0 18px rgba(255, 80, 90, 0.4); }
  50%      { box-shadow: 0 0 24px rgba(255, 80, 90, 0.85); }
}
.cell-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 8px;
}
.cell-tag {
  background: linear-gradient(90deg, rgba(40, 140, 220, 0.8), rgba(20, 70, 130, 0.5));
  padding: 2px 10px;
  border-radius: 2px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #fff;
}
.cell-state {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-dim);
}
.cell-card-body {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.metric {
  background: rgba(0, 0, 0, 0.25);
  padding: 6px 4px;
  border-radius: 2px;
  text-align: center;
  border-bottom: 1px solid rgba(80, 180, 255, 0.18);
}
.metric-label {
  font-size: clamp(9px, 0.7vw, 12px);
  color: var(--text-dim);
}
.metric-value {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: clamp(14px, 1.1vw, 20px);
  font-weight: 600;
  color: #fff;
  text-shadow: 0 0 8px rgba(80, 200, 255, 0.6);
  line-height: 1.3;
}
.metric-value span {
  font-size: clamp(9px, 0.65vw, 11px);
  margin-left: 2px;
  color: var(--text-dim);
  font-weight: 400;
}
.cell-card-footer {
  margin-top: 8px;
}
.bar {
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2c8fff, #66e3ff);
  box-shadow: 0 0 8px rgba(80, 200, 255, 0.6);
  transition: width .4s;
}
.bar-text {
  display: block;
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 2px;
}
</style>
