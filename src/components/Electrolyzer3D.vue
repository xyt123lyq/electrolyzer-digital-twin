<template>
  <div class="electrolyzer-3d" ref="hostRef">
    <div ref="canvasHost" class="canvas-host"></div>

    <div class="phase-pill">
      <span class="dot mock"></span>
      <span>{{ phaseText }}</span>
    </div>
    
    <div class="hint">点击电解槽查看拆解 · 再次点击复位 · 鼠标拖动旋转 · 滚轮缩放</div>

    <!-- CFD Flow Field Analysis Control Panel -->
    <div class="cfd-panel glass-panel">
      <div class="cfd-title">
        <span class="cfd-pulse-dot"></span>
        <span class="cfd-title-text">CFD 多场耦合流态分析中枢</span>
      </div>
      
      <div class="cfd-modes">
        <button 
          v-for="m in cfdModes" 
          :key="m.value" 
          class="cfd-mode-btn"
          :class="{ active: currentCfdMode === m.value }"
          @click="changeCfdMode(m.value)"
        >
          <span class="btn-dot" :style="{ backgroundColor: m.color }"></span>
          {{ m.label }}
        </button>
      </div>

      <!-- Telemetry sliders and readouts visible when CFD is active -->
      <div class="cfd-slider-container" v-if="currentCfdMode !== 4">
        <div class="slider-header">
          <span>进液流量 (CFD Flow Rate)</span>
          <span class="slider-val text-cyan">{{ (flowRateVal * 4.8).toFixed(2) }} L/min</span>
        </div>
        <input 
          type="range" 
          min="0.05" 
          max="1.0" 
          step="0.05" 
          v-model="flowRateVal" 
          class="cfd-slider"
          @input="changeCfdVelocity"
        />
      </div>

      <!-- Real-time Multi-Physics CFD Telemetry -->
      <div class="cfd-telemetry" v-if="currentCfdMode !== 4">
        <div class="telem-row">
          <span class="telem-label">入口压力 (P_in):</span>
          <span class="telem-val text-yellow">{{ (98.2 + flowRateVal * 34.5).toFixed(1) }} kPa</span>
        </div>
        <div class="telem-row">
          <span class="telem-label">流道压降 (ΔP):</span>
          <span class="telem-val text-cyan">{{ (6.4 + flowRateVal * 18.2).toFixed(1) }} kPa</span>
        </div>
        <div class="telem-row" v-if="currentCfdMode === 3">
          <span class="telem-label">出口含气率 (Void %):</span>
          <span class="telem-val text-white">{{ (flowRateVal * 38.6).toFixed(1) }} %</span>
        </div>
        <div class="telem-row">
          <span class="telem-label">流场分布均匀度:</span>
          <span class="telem-val text-green">{{ (96.5 - (1.0 - flowRateVal) * 3.8).toFixed(1) }} %</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElectrolyzerScene } from '../three/ElectrolyzerScene.js'

const props = defineProps({ autoDemo: { type: Boolean, default: true } })
const emit = defineEmits(['cell-exploded', 'cell-collapsed', 'demo-phase'])

const hostRef = ref(null)
const canvasHost = ref(null)
let scene = null

const phaseText = ref('整体浏览模式')

// CFD 流场控制状态
const currentCfdMode = ref(0) // 默认：0-物理常规流态
const flowRateVal = ref(0.6)

const cfdModes = [
  { label: '常规流态 (Flow)', value: 0, color: '#00d8ff' },
  { label: '流速场分析 (Velocity)', value: 1, color: '#ff3b30' },
  { label: '压力降分析 (Pressure)', value: 2, color: '#ffcc00' },
  { label: '两相流气相 (Bubbles)', value: 3, color: '#ffffff' },
  { label: '关闭流态显示 (Off)', value: 4, color: '#7a7a7a' }
]

onMounted(() => {
  scene = new ElectrolyzerScene(canvasHost.value)
  if (typeof window !== 'undefined') window.__scene__ = scene

  // 监听电解槽展开/折叠状态
  scene.on('cellOpening', () => { 
    phaseText.value = '零件爆炸分解' 
    // 展开零件时，若当前特效为关闭状态，自动开启默认物理流态，提供极佳的内部流线观感
    if (currentCfdMode.value === 4) {
      changeCfdMode(0)
    }
  })
  scene.on('cellExploded', () => { phaseText.value = '零件爆炸分解'; emit('cell-exploded', 0) })
  scene.on('cellCollapsed', () => { 
    phaseText.value = '整体浏览模式'
    emit('cell-collapsed', 0) 
  })
  scene.on('demoPhase', (info) => { phaseText.value = info.text || '自动演示'; emit('demo-phase', info) })

  // 初始化流体属性
  setTimeout(() => {
    scene?.setCFDAnalysisMode(currentCfdMode.value)
    scene?.setCFDVelocity(flowRateVal.value)
  }, 100)

  if (props.autoDemo) scene.startAutoDemo()

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('explode') !== null) {
      scene.stopAutoDemo()
      setTimeout(() => scene.triggerExplode(), 80)
    }
  } catch (e) { /* noop */ }
})

// 切换 CFD 分析模式
function changeCfdMode(mode) {
  currentCfdMode.value = mode
  scene?.setCFDAnalysisMode(mode)
}

// 拖动滑块调节流速
function changeCfdVelocity() {
  scene?.setCFDVelocity(parseFloat(flowRateVal.value))
}

defineExpose({
  explode:   () => scene?.triggerExplode(),
  reset:     () => scene?.resetAll(),
  startDemo: () => scene?.startAutoDemo(),
  stopDemo:  () => scene?.stopAutoDemo(),
  snapshot:  () => scene?.snapshot(),
  setCFDAnalysisMode: (mode) => {
    currentCfdMode.value = mode
    scene?.setCFDAnalysisMode(mode)
  },
  setCFDVelocity: (v) => {
    flowRateVal.value = v
    scene?.setCFDVelocity(v)
  },
  setExplosionScale: (scale) => {
    scene?.setExplosionScale(scale)
  }
})

onBeforeUnmount(() => {
  scene?.dispose()
  scene = null
})
</script>

<style scoped>
.electrolyzer-3d { position: relative; width: 100%; height: 100%; overflow: hidden; }
.canvas-host { position: absolute; inset: 0; }

.phase-pill {
  position: absolute; top: 14px; left: 14px;
  background: rgba(5, 25, 50, 0.78); border: 1px solid var(--border-cyan); border-radius: 999px;
  padding: 4px 12px; font-size: 12px; color: var(--text-accent);
  display: flex; align-items: center; gap: 8px; letter-spacing: 1px; z-index: 5;
  box-shadow: 0 0 12px rgba(50, 160, 255, 0.3);
}

.hint {
  position: absolute; top: 14px; right: 14px; font-size: 11px;
  color: var(--text-dim); background: rgba(5, 25, 50, 0.5);
  border: 1px dashed rgba(80, 180, 255, 0.25); padding: 4px 10px; border-radius: 2px; z-index: 5;
}

/* ─── CFD Flow Control Panel Glassmorphism ─── */
.cfd-panel {
  position: absolute;
  left: 14px;
  bottom: 80px; /* 避开主底部控制按钮 */
  width: 250px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: rgba(5, 22, 42, 0.72);
  backdrop-filter: blur(14px) saturate(180%);
  -webkit-backdrop-filter: blur(14px) saturate(180%);
  border: 1px solid rgba(80, 180, 255, 0.35);
  border-radius: 4px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 14px rgba(0, 120, 255, 0.2);
  transition: all 0.3s ease;
}

.cfd-title {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(80, 180, 255, 0.2);
  padding-bottom: 8px;
}

.cfd-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #00d8ff;
  box-shadow: 0 0 10px #00d8ff;
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 14px #00d8ff; }
  100% { transform: scale(0.9); opacity: 0.6; }
}

.cfd-title-text {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
  text-shadow: 0 0 8px rgba(0, 216, 255, 0.6);
}

.cfd-modes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cfd-mode-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: rgba(0, 40, 80, 0.22);
  border: 1px solid rgba(80, 180, 255, 0.15);
  border-radius: 3px;
  color: #b0d4f5;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.cfd-mode-btn:hover {
  background: rgba(0, 80, 160, 0.35);
  border-color: rgba(80, 180, 255, 0.4);
  color: #fff;
  transform: translateX(3px);
}

.cfd-mode-btn.active {
  background: rgba(0, 100, 200, 0.45);
  border-color: #00d8ff;
  color: #fff;
  box-shadow: 0 0 10px rgba(0, 216, 255, 0.25);
  font-weight: 600;
}

.btn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

/* 流量调节滑块 */
.cfd-slider-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #b0d4f5;
}

.slider-val {
  font-family: 'Consolas', monospace;
  font-weight: bold;
}

.cfd-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  background: rgba(0, 60, 120, 0.5);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.cfd-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #00d8ff;
  box-shadow: 0 0 8px #00d8ff;
  transition: transform 0.1s ease;
}

.cfd-slider::-webkit-slider-thumb:hover {
  transform: scale(1.25);
}

/* 实时 CFD 遥测参数 */
.cfd-telemetry {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px dashed rgba(80, 180, 255, 0.2);
  border-radius: 3px;
  margin-top: 4px;
}

.telem-row {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
}

.telem-label {
  color: var(--text-dim, #8ba8c2);
}

.telem-val {
  font-family: 'Consolas', monospace;
  font-weight: bold;
}

/* 颜色辅助类 */
.text-cyan { color: #00d8ff; text-shadow: 0 0 6px rgba(0, 216, 255, 0.35); }
.text-yellow { color: #ffcc00; text-shadow: 0 0 6px rgba(255, 204, 0, 0.35); }
.text-green { color: #00e676; text-shadow: 0 0 6px rgba(0, 230, 118, 0.35); }
.text-red { color: #ff3d00; text-shadow: 0 0 6px rgba(255, 61, 0, 0.35); }
.text-white { color: #ffffff; text-shadow: 0 0 6px rgba(255, 255, 255, 0.35); }
</style>
