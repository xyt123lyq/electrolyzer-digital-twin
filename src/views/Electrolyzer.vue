<template>
  <div class="layout">
    <!-- Header 三栏 flex, 24px 间距, 所有元素 nowrap -->
    <header class="header">
      <div class="header-left">
        <div class="logo-mark"></div>
        <div class="title-block">
          <div class="title-main">电解槽 膜电极 运行状态 监测系统</div>
          <div class="title-sub">Electrolyzer · Real-time Monitoring</div>
        </div>
      </div>
      <div class="header-center">
        <div class="hud-stat" v-for="s in headerStats" :key="s.label">
          <div class="hud-stat-label">{{ s.label }}</div>
          <div class="hud-stat-value">{{ s.value }}<em>{{ s.unit }}</em></div>
        </div>
      </div>
      <div class="header-right">
        <div class="clock">{{ clock }}</div>
      </div>
    </header>

    <!-- 主体: 左上 3D / 右上 状态 / 左下 V-T+I-T / 右下 I-V+仪表 -->
    <section class="threeD-area" ref="threeDAreaRef">
      <Electrolyzer3D
        ref="electrolyzerRef"
        :auto-demo="demoOn"
        @cell-exploded="onCellExploded"
        @cell-collapsed="onCellCollapsed"
      />
      <AlarmBanner />
      <div class="overlay-controller">
        <ExplosionController
          :demo-on="demoOn"
          @explode="explode"
          @reset="reset"
          @toggleDemo="toggleDemo"
          @fullscreen="toggleFullscreen"
          @updateSpacing="updateSpacing"
        />
      </div>
    </section>

    <aside class="right-params">
      <StatusPanel :active-cell="-1" />
    </aside>

    <section class="bottom-row">
      <div class="bl-row"><WaveChart type="voltage" :window-sec="60" :active-cell="-1" /></div>
      <div class="bl-row"><WaveChart type="current" :window-sec="60" :active-cell="-1" /></div>
      <div class="bl-row"><IVChart :active-cell="-1" /></div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Electrolyzer3D from '../components/Electrolyzer3D.vue'
import StatusPanel from '../components/StatusPanel.vue'
import WaveChart from '../components/WaveChart.vue'
import IVChart from '../components/IVChart.vue'
import ExplosionController from '../components/ExplosionController.vue'
import AlarmBanner from '../components/AlarmBanner.vue'
import { telemetry } from '../store/useTelemetry.js'

const electrolyzerRef = ref(null)
const threeDAreaRef = ref(null)
const demoOn = ref(true)

const headerStats = computed(() => {
  const c = telemetry.current
  const totalV = (+c.cell1_voltage) + (+c.cell2_voltage)
  return [
    { label: '总电压', value: totalV.toFixed(2), unit: 'V' },
    { label: '总电流', value: (+c.current).toFixed(1), unit: 'A' },
    { label: '总功率', value: (totalV * c.current).toFixed(1), unit: 'W' },
    { label: '流量',   value: (+c.flow).toFixed(2), unit: 'L/min' },
    { label: '纯度',   value: (+c.purity).toFixed(2), unit: '%' }
  ]
})

const clock = ref(formatTime(new Date()))
let clockTimer = null
function formatTime(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
onMounted(() => { clockTimer = setInterval(() => { clock.value = formatTime(new Date()) }, 1000) })
onBeforeUnmount(() => { if (clockTimer) clearInterval(clockTimer) })

function onCellExploded() { /* 爆炸完成 */ }
function onCellCollapsed() { /* 复位完成 */ }

function explode() {
  if (demoOn.value) toggleDemo()
  electrolyzerRef.value?.explode()
}
function reset() {
  electrolyzerRef.value?.reset()
}
function toggleDemo() {
  demoOn.value = !demoOn.value
  if (demoOn.value) electrolyzerRef.value?.startDemo()
  else electrolyzerRef.value?.stopDemo()
}
function toggleFullscreen() {
  const el = threeDAreaRef.value
  if (!el) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    el.requestFullscreen().catch(err => console.warn('fullscreen failed:', err))
  }
}
function updateSpacing(scale) {
  electrolyzerRef.value?.setExplosionScale(scale)
}
</script>

<style scoped>
/*
 * 桌面端流式适配:
 *   - 1280-1366: 笔记本/小屏, 紧凑模式
 *   - 1440-1680: 主流桌面
 *   - 1920+:    大屏/工业大屏
 * 关键尺寸用 clamp() 在视口宽度区间内插值, 避免硬切断点导致跳变.
 */
.layout {
  --gap:        clamp(6px, 0.55vw, 12px);
  --pad:        clamp(6px, 0.55vw, 12px);
  --header-h:   clamp(50px, 4.2vw + 10px, 72px);
  --bottom-h:   clamp(220px, 22vh, 340px);
  --left-col:   clamp(56%, 58vw, 62%);

  display: grid;
  grid-template-columns: var(--left-col) 1fr;
  grid-template-rows: var(--header-h) minmax(0, 1fr) var(--bottom-h);
  width: 100vw;
  height: 100vh;
  gap: var(--gap);
  padding: var(--pad);
}

.header {
  grid-column: 1 / 3;
  grid-row: 1;
  display: flex;
  align-items: center;
  padding: 0 clamp(12px, 1.2vw, 22px);
  gap: 24px;                                  /* U1 24px 间距 */
  min-width: 0;
  background:
    linear-gradient(90deg, rgba(20, 70, 130, 0.45) 0%, rgba(40, 140, 220, 0.18) 50%, rgba(20, 70, 130, 0.45) 100%);
  border: 1px solid var(--border-cyan);
  border-radius: 2px;
  position: relative;
  box-shadow: 0 0 20px rgba(40, 140, 220, 0.25);
}
.header::before, .header::after {
  content: ''; position: absolute; top: 50%; transform: translateY(-50%);
  width: 60px; height: 2px;
  background: linear-gradient(90deg, var(--accent), transparent);
}
.header::before { left: -1px; }
.header::after  { right: -1px; background: linear-gradient(-90deg, var(--accent), transparent); }

.header-left {
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.8vw, 16px);
  flex: 0 0 auto;                              /* 不被压缩 */
  min-width: 0;
}
.title-block {
  min-width: 0;
  overflow: hidden;
}
.logo-mark {
  width: clamp(28px, 2.2vw, 40px); height: clamp(28px, 2.2vw, 40px);
  flex-shrink: 0;
  border: 2px solid var(--accent);
  border-radius: 50%;
  position: relative;
  box-shadow: 0 0 12px rgba(80, 180, 255, 0.55);
}
.logo-mark::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  border: 2px solid var(--text-accent);
  border-top-color: transparent;
  border-right-color: transparent;
  animation: spin 6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.title-main {
  font-size: clamp(14px, 1.15vw, 20px);
  font-weight: 700;
  letter-spacing: clamp(2px, 0.3vw, 5px);
  color: #fff;
  text-shadow: 0 0 12px rgba(80, 200, 255, 0.7);
  white-space: nowrap;
}
.title-sub {
  font-size: clamp(9px, 0.7vw, 12px);
  color: var(--text-dim);
  letter-spacing: 1.2px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-center {
  display: flex;
  flex: 1 1 auto;                               /* 占据中间剩余空间 */
  justify-content: center;
  gap: clamp(12px, 1.4vw, 26px);
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.hud-stat {
  text-align: center;
  min-width: clamp(60px, 5vw, 90px);
  flex-shrink: 0;
}
.hud-stat-label {
  font-size: clamp(9px, 0.75vw, 12px);
  color: var(--text-dim);
  letter-spacing: 1.5px;
}
.hud-stat-value {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: clamp(14px, 1.15vw, 22px);
  font-weight: 600;
  color: #ffdf6c;
  text-shadow: 0 0 8px rgba(255, 200, 80, 0.55);
  line-height: 1.2;
}
.hud-stat-value em {
  font-style: normal;
  font-size: clamp(9px, 0.7vw, 12px);
  color: var(--text-dim);
  margin-left: 3px;
  font-weight: 400;
}

.header-right {
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.6vw, 14px);
  flex: 0 0 auto;
  white-space: nowrap;
}
.clock {
  font-family: 'Consolas', monospace;
  font-size: clamp(10px, 0.85vw, 14px);
  color: var(--text-accent);
  letter-spacing: 1px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px clamp(6px, 0.7vw, 12px);
  border: 1px solid rgba(80, 180, 255, 0.25);
  border-radius: 2px;
  white-space: nowrap;
}

/* 屏幕宽度不足时, 让数据源面板更紧凑或换行 */
@media (max-width: 1500px) {
  .header-right :deep(.ws-input) { width: 130px; }
}
@media (max-width: 1300px) {
  /* 极小屏: 隐藏部分次要统计避免溢出 */
  .header-center .hud-stat:nth-child(n+4) { display: none; }
  .header-right :deep(.ws-input) { display: none; }
  .clock { display: none; }
}

.threeD-area {
  grid-column: 1;
  grid-row: 2;
  position: relative;
  background: rgba(5, 25, 50, 0.4);
  border: 1px solid var(--border-cyan);
  border-radius: 2px;
  overflow: hidden;
  box-shadow: inset 0 0 60px rgba(0, 80, 160, 0.3);
}
.threeD-area::before, .threeD-area::after,
.right-params::before, .right-params::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 1px solid var(--accent);
  pointer-events: none;
  z-index: 4;
}
.threeD-area::before, .right-params::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.threeD-area::after,  .right-params::after  { bottom: -1px; right: -1px; border-left: none; border-top: none; }

.overlay-controller {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 5;
}

.right-params {
  grid-column: 2;
  grid-row: 2;
  position: relative;
  display: flex;
  flex-direction: column;
}

.bottom-row {
  grid-column: 1 / 3;
  grid-row: 3;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--gap);
  min-height: 0;
}
.bl-row { min-height: 0; height: 100%; min-width: 0; }

</style>
