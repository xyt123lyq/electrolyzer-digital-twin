import { reactive, computed } from 'vue'

/**
 * 全局响应式遥测数据 — 工业看板单一数据源.
 *
 * 协议字段 (与 TCP V1.0 协议对齐, 见 src/api/protocol.js):
 *   load_voltage  V    ch0_voltage V    ch1_voltage V    load_current A
 *   temperature   ℃   h2_flow     L/min  h2_purity   %
 *
 * UI 派生字段 (3-cell 显示用):
 *   cell1_voltage = ch0_voltage
 *   cell2_voltage = ch1_voltage
 *   cell3_voltage = load_voltage - ch0 - ch1
 *   current/flow/purity/temperature 直接映射
 *
 * 工业增强:
 *   - quality:     'good' | 'stale' | 'bad'      数据质量, 由 age 与 connection 派生
 *   - lastUpdate:  毫秒时间戳                     上一帧到达时间
 *   - age:         computed                       距上一帧 ms
 *   - dropFrames:  累计丢帧数 (CRC 错误)
 *   - rxFrames:    累计接收帧数
 *   - source:      'mock' | 'ws-json' | 'ws-binary' | 'none'
 *   - status:      'mock' | 'connected' | 'connecting' | 'disconnected'
 */

const MAX_HISTORY = 600   // 600 * 500ms = 5 min, 足够 1 分钟窗口 + 缓冲
const STALE_MS = 3000     // 3s 无新数据 -> stale
const BAD_MS   = 8000     // 8s 无新数据 -> bad (基本断线)

export const telemetry = reactive({
  current: {
    load_voltage: 0, ch0_voltage: 0, ch1_voltage: 0,
    load_current: 0, temperature: 0, h2_flow: 0, h2_purity: 0,
    cell1_voltage: 0, cell2_voltage: 0, cell3_voltage: 0,
    current: 0, flow: 0, purity: 0,
    timestamp: Date.now()
  },
  history: [],
  status:     'mock',     // 'mock' | 'connecting' | 'connected' | 'disconnected'
  source:     'mock',     // 'mock' | 'ws-json' | 'ws-binary' | 'none'
  quality:    'good',     // 'good' | 'stale' | 'bad'
  lastUpdate: Date.now(),
  rxFrames:   0,
  dropFrames: 0,
  reconnects: 0
})

/* ---------- 报警阈值 (HH/H/L/LL) ---------- */
/** 单位 / 触发等级:
 *  level: 'HH' 致命高, 'H' 高警告, 'L' 低警告, 'LL' 致命低
 */
export const thresholds = reactive({
  cell1_voltage: { LL: 1.65, L: 1.80, H: 2.00, HH: 2.10, unit: 'V',     label: 'Cell 1 电压' },
  cell2_voltage: { LL: 1.65, L: 1.80, H: 2.00, HH: 2.10, unit: 'V',     label: 'Cell 2 电压' },
  cell3_voltage: { LL: 1.65, L: 1.80, H: 2.00, HH: 2.10, unit: 'V',     label: 'Cell 3 电压' },
  current:       { LL: 5,    L: 8,    H: 14,   HH: 16,   unit: 'A',     label: '负载电流'  },
  temperature:   { LL: 20,   L: 35,   H: 65,   HH: 80,   unit: '℃',    label: '电堆温度'  },
  flow:          { LL: 0.5,  L: 1.0,  H: 5.0,  HH: 6.0,  unit: 'L/min', label: '氢气流量'  },
  purity:        { LL: 95,   L: 98,   H: 100,  HH: 100,  unit: '%',     label: '氢气纯度'  }
})

/** 活动报警 (acknowledged 与否) — 持续存在直到恢复 */
export const alarms = reactive({
  list: [],          // { id, key, level, value, label, since, ack }
  active: 0,         // 未确认报警数
  highest: null      // 最高等级 'HH' / 'H' / 'L' / 'LL' / null
})

/* ---------- 数据进入入口 ---------- */
export function applyRawSample(raw, meta = {}) {
  if (!raw) return
  const ts = raw.timestamp || Date.now()
  const ch0 = safeNum(raw.ch0_voltage)
  const ch1 = safeNum(raw.ch1_voltage)
  const load = raw.load_voltage != null ? safeNum(raw.load_voltage) : (ch0 + ch1)
  const cell3 = Math.max(0, load - ch0 - ch1)

  const sample = {
    timestamp: ts,
    load_voltage: load,
    ch0_voltage:  ch0,
    ch1_voltage:  ch1,
    load_current: safeNum(raw.load_current),
    temperature:  safeNum(raw.temperature),
    h2_flow:      safeNum(raw.h2_flow),
    h2_purity:    safeNum(raw.h2_purity),
    cell1_voltage: ch0,
    cell2_voltage: ch1,
    cell3_voltage: cell3,
    current: safeNum(raw.load_current),
    flow:    safeNum(raw.h2_flow),
    purity:  safeNum(raw.h2_purity)
  }

  Object.assign(telemetry.current, sample)
  telemetry.history.push(sample)
  while (telemetry.history.length > MAX_HISTORY) telemetry.history.shift()

  telemetry.lastUpdate = Date.now()
  telemetry.rxFrames++
  if (meta.source) telemetry.source = meta.source
  recomputeQuality()
  evaluateAlarms(sample)

  // 转发到 Electron 主进程的 XLSX 录制器 (只送 TCP 协议原始字段)
  if (typeof window !== 'undefined' && window.electronAPI?.recorder) {
    window.electronAPI.recorder.add({
      timestamp: ts,
      load_voltage: load, ch0_voltage: ch0, ch1_voltage: ch1,
      load_current: sample.load_current,
      temperature:  sample.temperature,
      h2_flow:      sample.h2_flow,
      h2_purity:    sample.h2_purity
    })
  }
}

/** @deprecated 旧 API — 兼容 */
export function pushSample(sample) {
  applyRawSample({
    timestamp: sample.timestamp,
    load_voltage: sample.load_voltage ?? ((+sample.cell1_voltage || 0) + (+sample.cell2_voltage || 0) + (+sample.cell3_voltage || 0)),
    ch0_voltage:  sample.ch0_voltage  ?? sample.cell1_voltage,
    ch1_voltage:  sample.ch1_voltage  ?? sample.cell2_voltage,
    load_current: sample.load_current ?? sample.current,
    temperature:  sample.temperature,
    h2_flow:      sample.h2_flow      ?? sample.flow,
    h2_purity:    sample.h2_purity    ?? sample.purity
  })
}

export function noteDropFrame() {
  telemetry.dropFrames++
}

export function noteReconnect() {
  telemetry.reconnects++
}

/* ---------- 数据时效 / 质量 ---------- */
function recomputeQuality() {
  const age = Date.now() - telemetry.lastUpdate
  if (telemetry.status === 'disconnected' || age > BAD_MS) telemetry.quality = 'bad'
  else if (age > STALE_MS) telemetry.quality = 'stale'
  else telemetry.quality = 'good'
}

// 周期性刷 quality (即使没数据流入)
let qualityTimer = null
export function startQualityMonitor() {
  if (qualityTimer) return
  qualityTimer = setInterval(recomputeQuality, 500)
}
export function stopQualityMonitor() {
  if (qualityTimer) clearInterval(qualityTimer)
  qualityTimer = null
}

/* ---------- 报警评估 ---------- */
const LEVEL_RANK = { HH: 4, LL: 3, H: 2, L: 1, null: 0 }

function classify(value, t) {
  if (t == null || value == null || Number.isNaN(value)) return null
  if (value >= t.HH) return 'HH'
  if (value <= t.LL) return 'LL'
  if (value >= t.H)  return 'H'
  if (value <= t.L)  return 'L'
  return null
}

function evaluateAlarms(sample) {
  const now = Date.now()
  const keys = Object.keys(thresholds)
  const seen = new Set()
  for (const k of keys) {
    const level = classify(sample[k], thresholds[k])
    if (level) {
      seen.add(k)
      const existing = alarms.list.find(a => a.key === k)
      if (existing) {
        // 等级升降时更新, 但保留首次发生时间
        existing.level = level
        existing.value = sample[k]
        if (level !== existing.level) existing.ack = false
      } else {
        alarms.list.unshift({
          id:    `${k}-${now}`,
          key:   k,
          label: thresholds[k].label,
          unit:  thresholds[k].unit,
          level,
          value: sample[k],
          since: now,
          ack:   false
        })
      }
    }
  }
  // 移除已经恢复正常的报警
  for (let i = alarms.list.length - 1; i >= 0; i--) {
    if (!seen.has(alarms.list[i].key)) alarms.list.splice(i, 1)
  }
  // 截断到 50 条
  if (alarms.list.length > 50) alarms.list.length = 50

  alarms.active = alarms.list.filter(a => !a.ack).length
  let highest = null
  for (const a of alarms.list) {
    if (LEVEL_RANK[a.level] > LEVEL_RANK[highest]) highest = a.level
  }
  alarms.highest = highest
}

export function ackAlarm(id) {
  const a = alarms.list.find(x => x.id === id)
  if (a) a.ack = true
  alarms.active = alarms.list.filter(x => !x.ack).length
}
export function ackAllAlarms() {
  alarms.list.forEach(a => { a.ack = true })
  alarms.active = 0
}

/* ---------- 数据年龄 (computed export) ---------- */
export const dataAge = computed(() => Date.now() - telemetry.lastUpdate)

/* ---------- Mock 数据 ---------- */
let mockTimer = null
let mockState = null

export function startMock(intervalMs = 500) {
  stopMock()
  telemetry.status = 'mock'
  telemetry.source = 'mock'
  mockState = { ch0: 1.91, ch1: 1.88, ch2: 1.94, cur: 12.0, temp: 52.0, flow: 2.4, pur: 99.2 }
  mockTimer = setInterval(() => {
    mockState.ch0  = clamp(mockState.ch0  + jitter(0.02), 1.80, 2.00)
    mockState.ch1  = clamp(mockState.ch1  + jitter(0.02), 1.80, 2.00)
    mockState.ch2  = clamp(mockState.ch2  + jitter(0.02), 1.80, 2.00)
    mockState.cur  = clamp(mockState.cur  + jitter(0.3),  10,   15)
    mockState.temp = clamp(mockState.temp + jitter(0.4),  40,   60)
    mockState.flow = clamp(mockState.flow + jitter(0.12), 1,    5)
    mockState.pur  = clamp(mockState.pur  + jitter(0.15), 98,   100)
    applyRawSample({
      timestamp:    Date.now(),
      load_voltage: +(mockState.ch0 + mockState.ch1 + mockState.ch2).toFixed(3),
      ch0_voltage:  +mockState.ch0.toFixed(3),
      ch1_voltage:  +mockState.ch1.toFixed(3),
      load_current: +mockState.cur.toFixed(2),
      temperature:  +mockState.temp.toFixed(2),
      h2_flow:      +mockState.flow.toFixed(2),
      h2_purity:    +mockState.pur.toFixed(2)
    }, { source: 'mock' })
  }, intervalMs)
  startQualityMonitor()
}

export function stopMock() {
  if (mockTimer) clearInterval(mockTimer)
  mockTimer = null
}

function jitter(amp) { return (Math.random() - 0.5) * 2 * amp }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
function safeNum(v) { const n = +v; return Number.isFinite(n) ? n : 0 }
