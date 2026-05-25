<template>
  <div class="data-connector" :class="qualityClass">
    <div class="conn-block">
      <span class="conn-tag">数据源</span>
      <span class="conn-status">
        <span class="dot" :class="statusDot"></span>
        {{ statusText }}
      </span>
    </div>

    <div class="conn-block age">
      <span class="age-label">延迟</span>
      <span class="age-value">{{ ageText }}</span>
      <span class="quality-pill" :class="qualityClass">{{ qualityText }}</span>
    </div>

    <div class="conn-block stats">
      RX <b>{{ telemetry.rxFrames }}</b>
      <span v-if="telemetry.dropFrames" class="drop">DROP {{ telemetry.dropFrames }}</span>
      <span v-if="telemetry.reconnects" class="re">RC {{ telemetry.reconnects }}</span>
    </div>

    <div class="conn-block conn-control">
      <input
        v-model="wsUrl"
        class="ws-input"
        placeholder="ws://host:port"
        :disabled="telemetry.status === 'connected' || telemetry.status === 'connecting'"
        @keydown.enter="connect"
      />
      <button v-if="telemetry.status !== 'connected' && telemetry.status !== 'connecting'" class="btn" @click="connect">接入</button>
      <button v-else class="btn" @click="disconnect">断开</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { telemetry, startMock, stopMock } from '../store/useTelemetry.js'
import { TelemetryWebSocket } from '../api/websocket.js'

const LS_KEY = 'electrolyzer.wsUrl'

const wsUrl = ref(localStorage.getItem(LS_KEY) || 'ws://localhost:8080')
let client = null
let tickTimer = null
const tick = ref(0)

// 1 Hz 触发 computed 重算 age (lastUpdate 不变化时 computed 不会自动重算)
onMounted(() => {
  startMock(500)
  tickTimer = setInterval(() => { tick.value++ }, 500)
})
onBeforeUnmount(() => {
  if (client) client.disconnect({ fallbackToMock: false })
  if (tickTimer) clearInterval(tickTimer)
  stopMock()
})

const ageMs = computed(() => {
  // 让 tick 参与依赖
  void tick.value
  return Date.now() - telemetry.lastUpdate
})

const ageText = computed(() => {
  const a = ageMs.value
  if (a < 1000) return a + ' ms'
  return (a / 1000).toFixed(1) + ' s'
})

const qualityClass = computed(() => 'q-' + telemetry.quality)
const qualityText = computed(() => {
  if (telemetry.quality === 'good') return 'LIVE'
  if (telemetry.quality === 'stale') return 'STALE'
  return 'NO DATA'
})

const statusDot = computed(() => {
  if (telemetry.status === 'connected')   return 'ok'
  if (telemetry.status === 'connecting')  return 'warn'
  if (telemetry.status === 'mock')        return 'mock'
  return 'bad'
})

const statusText = computed(() => {
  if (telemetry.status === 'connected')  return '已连接 ' + telemetry.source.toUpperCase()
  if (telemetry.status === 'connecting') return '连接中…'
  if (telemetry.status === 'mock')       return '模拟数据'
  return '已断开 · 自动重连'
})

function connect() {
  localStorage.setItem(LS_KEY, wsUrl.value)
  if (client) client.disconnect({ fallbackToMock: false })
  client = new TelemetryWebSocket(wsUrl.value)
  client.connect()
}
function disconnect() {
  client && client.disconnect({ fallbackToMock: true })
}
</script>

<style scoped>
.data-connector {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: rgba(5, 25, 50, 0.55);
  border: 1px solid var(--border-cyan);
  border-radius: 2px;
  font-size: 12px;
  transition: border-color .3s;
}
.data-connector.q-stale { border-color: rgba(255, 170, 60, 0.55); }
.data-connector.q-bad   { border-color: rgba(255, 90, 110, 0.65); }

.conn-block {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.conn-tag { color: var(--text-dim); letter-spacing: 1px; }
.conn-status { display: flex; align-items: center; gap: 6px; color: var(--text-accent); min-width: 160px; }

.age-label { color: var(--text-dim); letter-spacing: 0.5px; }
.age-value {
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: #fff;
  min-width: 55px;
  text-align: right;
}
.quality-pill {
  font-family: 'Consolas', monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 2px;
  letter-spacing: 1px;
}
.quality-pill.q-good  { background: rgba(110, 255, 181, 0.18); color: #6effb5; border: 1px solid rgba(110, 255, 181, 0.45); }
.quality-pill.q-stale { background: rgba(255, 174, 66, 0.18); color: #ffae42; border: 1px solid rgba(255, 174, 66, 0.45); }
.quality-pill.q-bad   { background: rgba(255, 94, 126, 0.18); color: #ff5e7e; border: 1px solid rgba(255, 94, 126, 0.45); }

.stats {
  font-family: 'Consolas', monospace;
  font-size: 11px;
  color: var(--text-dim);
}
.stats b { color: var(--text-main); margin: 0 2px; }
.stats .drop { color: #ff5e7e; margin-left: 6px; }
.stats .re   { color: #ffae42; margin-left: 6px; }

.conn-control { gap: 6px; }
.ws-input {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-cyan);
  color: var(--text-main);
  padding: 4px 8px;
  border-radius: 2px;
  width: 170px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  outline: none;
}
.ws-input:focus { border-color: var(--accent); }
.ws-input:disabled { opacity: 0.6; }

@media (max-width: 1500px) {
  .stats { display: none; }
  .ws-input { width: 130px; }
}
@media (max-width: 1300px) {
  .conn-block.age .age-label { display: none; }
}
</style>
