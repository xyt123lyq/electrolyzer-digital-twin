<template>
  <div class="explosion-controller">
    <button class="btn" @click="emit('explode')" title="E">爆炸拆解</button>
    <button class="btn" @click="emit('reset')" title="R">复位</button>
    <span class="divider"></span>
    <button class="btn" :class="{ active: demoOn }" @click="emit('toggleDemo')" title="D">{{ demoOn ? '停演示' : '自动演示' }}</button>
    <button class="btn" @click="emit('fullscreen')" title="F">{{ isFullscreen ? '退出全屏' : '全屏' }}</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  demoOn: { type: Boolean, default: true }
})
const emit = defineEmits(['explode', 'reset', 'toggleDemo', 'fullscreen'])

const isFullscreen = ref(false)

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
  padding: 8px 12px; background: rgba(5, 25, 50, 0.7);
  border: 1px solid var(--border-cyan); border-radius: 2px;
}
.divider { width: 1px; height: 20px; background: rgba(80, 180, 255, 0.3); margin: 0 2px; }
.btn { position: relative; }
.btn[title]::after {
  content: attr(title); position: absolute; top: -8px; right: -4px;
  font-size: 9px; background: rgba(0, 0, 0, 0.7); padding: 0 4px; border-radius: 2px;
  color: #ffdf6c; font-family: 'Consolas', monospace; pointer-events: none;
}
</style>
