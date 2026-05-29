<template>
  <div class="explosion-controller">
    <button class="btn" @click="emit('explode')" title="E">爆炸拆解</button>
    <button class="btn" @click="emit('reset')" title="R">复位</button>
    <span class="divider"></span>
    <button class="btn" :class="{ active: demoOn }" @click="emit('toggleDemo')" title="D">{{ demoOn ? '停演示' : '自动演示' }}</button>
    <button class="btn" @click="emit('fullscreen')" title="F">{{ isFullscreen ? '退出全屏' : '全屏' }}</button>
    
    <span class="divider"></span>
    <div class="slider-group">
      <span class="slider-label">爆炸间距</span>
      <input 
        type="range" 
        :min="0.0" 
        :max="2.5" 
        :step="0.05" 
        v-model="spacingScale" 
        class="spacing-slider"
        @input="onSliderInput"
      />
      <span class="slider-val">{{ (spacingScale * 100).toFixed(0) }}%</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  demoOn: { type: Boolean, default: true }
})
const emit = defineEmits(['explode', 'reset', 'toggleDemo', 'fullscreen', 'updateSpacing'])

const isFullscreen = ref(false)
const spacingScale = ref(1.0)

function onSliderInput() {
  emit('updateSpacing', parseFloat(spacingScale.value))
}

function onKey(e) {
  if (e.target?.tagName === 'INPUT' || e.target?.isContentEditable) return
  const k = e.key.toLowerCase()
  if (k === 'e') emit('explode')
  else if (k === 'r') emit('reset')
  else if (k === 'd') emit('toggleDemo')
  else if (k === 'f') emit('fullscreen')
}
function onFSChange() { isFullscreen.value = !!document.fullscreenElement }

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', onFSChange)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', onFSChange)
})
</script>

<style scoped>
.explosion-controller {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: rgba(5, 25, 50, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-cyan); border-radius: 2px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 8px rgba(0, 216, 255, 0.15);
  transition: all 0.3s ease;
}
.divider { width: 1px; height: 20px; background: rgba(80, 180, 255, 0.3); margin: 0 2px; }
.btn { position: relative; }
.btn[title]::after {
  content: attr(title); position: absolute; top: -8px; right: -4px;
  font-size: 9px; background: rgba(0, 0, 0, 0.7); padding: 0 4px; border-radius: 2px;
  color: #ffdf6c; font-family: 'Consolas', monospace; pointer-events: none;
}

/* Spacing Slider Premium Styles */
.slider-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 4px;
}
.slider-label {
  font-size: 11px;
  font-weight: 600;
  color: #b0d4f5;
  white-space: nowrap;
  letter-spacing: 0.5px;
  text-shadow: 0 0 6px rgba(176, 212, 245, 0.2);
}
.spacing-slider {
  -webkit-appearance: none;
  width: 100px;
  height: 4px;
  background: rgba(0, 60, 120, 0.5);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  border: none;
  transition: background 0.3s ease;
}
.spacing-slider:hover {
  background: rgba(0, 80, 160, 0.6);
}
.spacing-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffcc00;
  box-shadow: 0 0 8px rgba(255, 204, 0, 0.8);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease;
}
.spacing-slider::-webkit-slider-thumb:hover {
  transform: scale(1.35);
  background: #ffdf6c;
  box-shadow: 0 0 12px rgba(255, 223, 108, 0.9);
}
.spacing-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffcc00;
  border: none;
  box-shadow: 0 0 8px rgba(255, 204, 0, 0.8);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease;
  cursor: pointer;
}
.spacing-slider::-moz-range-thumb:hover {
  transform: scale(1.35);
  background: #ffdf6c;
  box-shadow: 0 0 12px rgba(255, 223, 108, 0.9);
}
.slider-val {
  font-family: 'Consolas', monospace;
  font-size: 11px;
  color: #ffdf6c;
  width: 32px;
  text-align: right;
  font-weight: bold;
  text-shadow: 0 0 6px rgba(255, 223, 108, 0.4);
}
</style>
