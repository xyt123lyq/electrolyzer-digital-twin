import {
  telemetry, applyRawSample, stopMock, startMock,
  noteDropFrame, noteReconnect, startQualityMonitor
} from '../store/useTelemetry.js'
import { scanFrames } from './protocol.js'

/**
 * 工业级 WebSocket 客户端
 *
 * 特性:
 *   - JSON / 二进制双模式 (binaryType='arraybuffer', 二进制走 protocol.scanFrames)
 *   - 指数退避重连 (1s -> 2 -> 4 -> 8 -> 16 -> 30s 上限)
 *   - 应用层心跳 (10s 发送 'ping', 25s 无任何响应判定为僵尸连接, 强制重连)
 *   - 主动断线检测 (onclose / onerror / heartbeat timeout 三路兜底)
 *   - 数据落地后由 useTelemetry 统一标记时效与质量, 不依赖 onmessage 自身的"流量"判定
 *   - 显式与 mock 数据源切换, 避免 UI 误读
 *
 * 用法:
 *   const ws = new TelemetryWebSocket('ws://10.0.0.5:8080')
 *   ws.connect()
 *   ws.disconnect({ fallbackToMock: true })
 */

const HEARTBEAT_INTERVAL = 10_000       // 10s 发 ping
const HEARTBEAT_TIMEOUT  = 25_000       // 25s 无数据 / pong -> 重连
const RECONNECT_BASE     = 1_000        // 1s 起步
const RECONNECT_MAX      = 30_000       // 30s 封顶

export class TelemetryWebSocket {
  constructor(url = 'ws://localhost:8080') {
    this.url = url
    this.ws = null
    this.shouldReconnect = true
    this.reconnectAttempt = 0
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.heartbeatTimeoutTimer = null
    this.lastRxTime = 0
    this._binBuf = new Uint8Array(0)
  }

  connect() {
    this.shouldReconnect = true
    this._clearReconnect()
    telemetry.status = 'connecting'
    try {
      this.ws = new WebSocket(this.url)
      this.ws.binaryType = 'arraybuffer'
    } catch (e) {
      console.warn('[WS] construct failed:', e)
      telemetry.status = 'disconnected'
      this._scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      stopMock()
      telemetry.status = 'connected'
      this.reconnectAttempt = 0
      this.lastRxTime = Date.now()
      this._startHeartbeat()
      startQualityMonitor()
      console.info('[WS] connected', this.url)
    }

    this.ws.onmessage = (ev) => {
      this.lastRxTime = Date.now()
      if (typeof ev.data === 'string') this._handleText(ev.data)
      else if (ev.data instanceof ArrayBuffer) this._handleBinary(new Uint8Array(ev.data))
      else if (ev.data instanceof Blob) {
        ev.data.arrayBuffer().then(buf => this._handleBinary(new Uint8Array(buf)))
      }
    }

    this.ws.onerror = (e) => {
      console.warn('[WS] error', e?.message || '')
      // 不在这里改 status — onclose 会触发, 避免双次状态翻转
    }

    this.ws.onclose = (ev) => {
      telemetry.status = 'disconnected'
      this._stopHeartbeat()
      console.warn('[WS] closed', ev.code, ev.reason)
      if (this.shouldReconnect) this._scheduleReconnect()
    }
  }

  // --- JSON 模式 ---
  _handleText(text) {
    // 心跳/控制消息直接吃掉
    if (text === 'pong' || text === 'ping') return
    try {
      const data = JSON.parse(text)
      // 控制类
      if (data?.type === 'pong' || data?.type === 'ping') return
      applyRawSample({
        timestamp:    typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
        load_voltage: data.load_voltage ?? null,
        ch0_voltage:  data.ch0_voltage  ?? data.cell1_voltage,
        ch1_voltage:  data.ch1_voltage  ?? data.cell2_voltage,
        load_current: data.load_current ?? data.current,
        temperature:  data.temperature,
        h2_flow:      data.h2_flow      ?? data.flow,
        h2_purity:    data.h2_purity    ?? data.purity
      }, { source: 'ws-json' })
    } catch (e) {
      console.warn('[WS] bad JSON payload:', e?.message)
    }
  }

  // --- 二进制帧模式 ---
  _handleBinary(chunk) {
    // 防止 buffer 无限增长 (异常时):
    if (this._binBuf.length + chunk.length > 1_000_000) {
      console.warn('[WS] bin buffer overflow, reset')
      this._binBuf = new Uint8Array(0)
    }
    const merged = new Uint8Array(this._binBuf.length + chunk.length)
    merged.set(this._binBuf, 0)
    merged.set(chunk, this._binBuf.length)
    const { frames, remainder } = scanFrames(merged)
    this._binBuf = remainder
    for (const f of frames) {
      if (f._crc?.valid === false) {
        noteDropFrame()
        continue
      }
      applyRawSample(f, { source: 'ws-binary' })
    }
  }

  // ---------- 心跳 ----------
  _startHeartbeat() {
    this._stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this._sendPing()
      // 超时判定: 上次接收 > HEARTBEAT_TIMEOUT
      const idle = Date.now() - this.lastRxTime
      if (idle > HEARTBEAT_TIMEOUT) {
        console.warn(`[WS] heartbeat timeout (${idle} ms), forcing reconnect`)
        this._forceReconnect()
      }
    }, HEARTBEAT_INTERVAL)
  }
  _stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }
  _sendPing() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try { this.ws.send('ping') } catch (e) { /* noop */ }
  }

  _forceReconnect() {
    if (this.ws) {
      try { this.ws.close() } catch (e) { /* noop */ }
      this.ws = null
    }
    // onclose 不一定会触发 (浏览器实现差异), 直接调度
    telemetry.status = 'disconnected'
    this._stopHeartbeat()
    if (this.shouldReconnect) this._scheduleReconnect()
  }

  // ---------- 重连 ----------
  _scheduleReconnect() {
    if (!this.shouldReconnect) return
    this._clearReconnect()
    const delay = Math.min(RECONNECT_BASE * (2 ** this.reconnectAttempt), RECONNECT_MAX)
    this.reconnectAttempt++
    noteReconnect()
    console.info(`[WS] reconnect in ${Math.round(delay)} ms (attempt #${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }
  _clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  disconnect({ fallbackToMock = true } = {}) {
    this.shouldReconnect = false
    this._clearReconnect()
    this._stopHeartbeat()
    if (this.ws) {
      try { this.ws.close(1000, 'client disconnect') } catch (e) { /* noop */ }
      this.ws = null
    }
    this._binBuf = new Uint8Array(0)
    if (fallbackToMock) startMock()
  }
}
