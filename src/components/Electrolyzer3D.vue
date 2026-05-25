<template>
  <div class="electrolyzer-3d" ref="hostRef">
    <div ref="canvasHost" class="canvas-host"></div>

    <div class="phase-pill">
      <span class="dot mock"></span>
      <span>{{ phaseText }}</span>
    </div>
    <div class="hint">点击电解槽查看拆解 · 再次点击复位 · 鼠标拖动旋转 · 滚轮缩放</div>
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

onMounted(() => {
  scene = new ElectrolyzerScene(canvasHost.value)
  if (typeof window !== 'undefined') window.__scene__ = scene

  scene.on('cellOpening', () => { phaseText.value = '零件爆炸分解' })
  scene.on('cellExploded', () => { phaseText.value = '零件爆炸分解'; emit('cell-exploded', 0) })
  scene.on('cellCollapsed', () => { phaseText.value = '整体浏览模式'; emit('cell-collapsed', 0) })
  scene.on('demoPhase', (info) => { phaseText.value = info.text || '自动演示'; emit('demo-phase', info) })

  if (props.autoDemo) scene.startAutoDemo()

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('explode') !== null) {
      scene.stopAutoDemo()
      setTimeout(() => scene.triggerExplode(), 80)
    }
  } catch (e) { /* noop */ }
})

defineExpose({
  explode:   () => scene?.triggerExplode(),
  reset:     () => scene?.resetAll(),
  startDemo: () => scene?.startAutoDemo(),
  stopDemo:  () => scene?.stopAutoDemo(),
  snapshot:  () => scene?.snapshot()
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
  background: rgba(5, 25, 50, 0.75); border: 1px solid var(--border-cyan); border-radius: 999px;
  padding: 4px 12px; font-size: 12px; color: var(--text-accent);
  display: flex; align-items: center; gap: 8px; letter-spacing: 1px; z-index: 5;
  box-shadow: 0 0 12px rgba(50, 160, 255, 0.3);
}
.hint {
  position: absolute; top: 14px; right: 14px; font-size: 11px;
  color: var(--text-dim); background: rgba(5, 25, 50, 0.5);
  border: 1px dashed rgba(80, 180, 255, 0.25); padding: 4px 10px; border-radius: 2px; z-index: 5;
}
</style>
