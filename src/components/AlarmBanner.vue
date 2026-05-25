<template>
  <div class="alarm-banner" :class="bannerClass" v-show="show">
    <div class="alarm-icon">
      <span class="pulse"></span>
      <span class="ico">!</span>
    </div>
    <div class="alarm-summary">
      <div class="alarm-count">
        <b>{{ alarms.active }}</b> 条未确认 · 最高 <em>{{ levelText(alarms.highest) }}</em>
      </div>
      <div class="alarm-top" v-if="topAlarm">
        {{ topAlarm.label }}
        =
        <b>{{ fmt(topAlarm.value) }}<span>{{ topAlarm.unit }}</span></b>
        <i class="lvl" :class="'lvl-' + topAlarm.level">{{ topAlarm.level }}</i>
      </div>
    </div>
    <div class="alarm-actions">
      <button class="btn-sm" @click="toggleList">{{ open ? '收起' : '查看' }} ({{ alarms.list.length }})</button>
      <button class="btn-sm" @click="ackAll" :disabled="!alarms.active">全部确认</button>
    </div>

    <transition name="alarm-list">
      <ul v-if="open" class="alarm-list">
        <li v-for="a in alarms.list" :key="a.id"
            :class="['lvl-' + a.level, { acked: a.ack }]"
            @click="ack(a.id)">
          <span class="lvl-tag">{{ a.level }}</span>
          <span class="alarm-name">{{ a.label }}</span>
          <span class="alarm-val">{{ fmt(a.value) }}<i>{{ a.unit }}</i></span>
          <span class="alarm-since">{{ since(a.since) }}</span>
          <span class="ack-mark">{{ a.ack ? '✓' : '点击确认' }}</span>
        </li>
        <li v-if="!alarms.list.length" class="empty">无活动报警</li>
      </ul>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { alarms, ackAllAlarms, ackAlarm } from '../store/useTelemetry.js'

const open = ref(false)
const toggleList = () => { open.value = !open.value }
const ack = (id) => ackAlarm(id)
const ackAll = () => ackAllAlarms()

const show = computed(() => alarms.list.length > 0)
const topAlarm = computed(() => alarms.list[0] || null)

const bannerClass = computed(() => {
  const lvl = alarms.highest
  if (!lvl) return 'lvl-none'
  if (lvl === 'HH' || lvl === 'LL') return 'lvl-critical'
  return 'lvl-warn'
})

function levelText(lvl) {
  if (!lvl) return '—'
  if (lvl === 'HH') return '致命高 HH'
  if (lvl === 'LL') return '致命低 LL'
  if (lvl === 'H')  return '高 H'
  if (lvl === 'L')  return '低 L'
  return lvl
}
function fmt(v) { return (typeof v === 'number') ? v.toFixed(2) : v }
function since(t) {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s/60)}m`
  return `${Math.round(s/3600)}h`
}
</script>

<style scoped>
.alarm-banner {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 380px;
  max-width: 620px;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(80, 20, 30, 0.95), rgba(50, 10, 20, 0.95));
  border: 1px solid rgba(255, 90, 110, 0.6);
  box-shadow: 0 0 16px rgba(255, 80, 90, 0.45), inset 0 0 0 1px rgba(255, 120, 130, 0.2);
  color: #ffe1e6;
  font-size: 12px;
  flex-wrap: wrap;
}
.alarm-banner.lvl-warn {
  background: linear-gradient(90deg, rgba(80, 55, 15, 0.95), rgba(60, 40, 10, 0.95));
  border-color: rgba(255, 195, 90, 0.65);
  box-shadow: 0 0 14px rgba(255, 170, 60, 0.4);
  color: #fff3d3;
}
.alarm-icon {
  position: relative;
  width: 26px; height: 26px;
  border-radius: 50%;
  background: #ff5e7e;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.lvl-warn .alarm-icon { background: #ffae42; }
.alarm-icon .pulse {
  position: absolute; inset: -4px;
  border-radius: 50%;
  border: 2px solid currentColor;
  opacity: 0.5;
  animation: pulse 1.3s ease-out infinite;
}
@keyframes pulse {
  0%   { transform: scale(0.85); opacity: 0.8; }
  100% { transform: scale(1.6);  opacity: 0;   }
}
.alarm-summary { flex: 1; min-width: 0; line-height: 1.4; }
.alarm-count b { color: #fff; font-size: 14px; margin: 0 2px; }
.alarm-count em { font-style: normal; color: #fff; font-weight: 600; }
.alarm-top {
  margin-top: 2px;
  font-size: 11.5px;
  opacity: 0.95;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.alarm-top b { font-family: 'Consolas', monospace; color: #fff; margin-left: 4px; }
.alarm-top b span { font-size: 10px; opacity: 0.8; margin-left: 2px; }
.alarm-top .lvl { font-style: normal; margin-left: 8px; padding: 1px 6px; border-radius: 2px; font-size: 10px; font-weight: 700; }
.lvl-HH { background: #ff3550; color: #fff; }
.lvl-LL { background: #ff3550; color: #fff; }
.lvl-H  { background: #ffae42; color: #2a1500; }
.lvl-L  { background: #ffae42; color: #2a1500; }

.alarm-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.btn-sm {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 2px;
  cursor: pointer;
}
.btn-sm:hover { background: rgba(0, 0, 0, 0.55); }
.btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }

.alarm-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  width: 100%;
  max-height: 220px;
  overflow: auto;
  background: rgba(5, 25, 50, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.alarm-list li {
  display: grid;
  grid-template-columns: 36px 1fr 90px 60px 80px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 11.5px;
  border-bottom: 1px dotted rgba(255, 255, 255, 0.08);
  cursor: pointer;
}
.alarm-list li:hover { background: rgba(255,255,255,0.05); }
.alarm-list li.acked { opacity: 0.55; }
.alarm-list li.acked .ack-mark { color: #6effb5; }
.alarm-list .lvl-tag {
  font-family: 'Consolas', monospace;
  font-weight: 700;
  font-size: 11px;
  text-align: center;
  padding: 1px 0;
  border-radius: 2px;
}
.alarm-list .lvl-HH .lvl-tag, .alarm-list li.lvl-HH .lvl-tag { background: #ff3550; color: #fff; }
.alarm-list .lvl-LL .lvl-tag, .alarm-list li.lvl-LL .lvl-tag { background: #ff3550; color: #fff; }
.alarm-list .lvl-H  .lvl-tag, .alarm-list li.lvl-H  .lvl-tag { background: #ffae42; color: #2a1500; }
.alarm-list .lvl-L  .lvl-tag, .alarm-list li.lvl-L  .lvl-tag { background: #ffae42; color: #2a1500; }
.alarm-list .alarm-val { font-family: 'Consolas', monospace; color: #ffdf6c; text-align: right; }
.alarm-list .alarm-val i { font-style: normal; opacity: 0.7; margin-left: 3px; font-size: 10px; }
.alarm-list .alarm-since { font-family: 'Consolas', monospace; font-size: 10.5px; color: #9ec6ee; text-align: right; }
.alarm-list .ack-mark { font-size: 10px; color: #ffae42; text-align: right; }
.alarm-list .empty { text-align: center; padding: 10px; color: #9ec6ee; opacity: 0.7; }

.alarm-list-enter-active, .alarm-list-leave-active { transition: all .25s ease; }
.alarm-list-enter-from { opacity: 0; transform: translateY(-4px); }
.alarm-list-leave-to   { opacity: 0; transform: translateY(-4px); }
</style>
