/**
 * TCP 数据采集系统通讯协议 (V1.0, 2026-02-13)
 * — 浏览器侧的解码器/编码器实现.
 *
 * 帧结构:  0xAA 0x55  | CMD(1) | DATA(N) | CRC8(1)    (大端字节序)
 *
 * 命令字:
 *   0xA1  传感器数据帧 (固定 20 字节)
 *   0xA2  文件命令帧 (可变, 6 + N 字节)
 *   0xA3  关闭文件帧 (固定 4 字节)
 *
 * 注意: 浏览器无法直接发起 TCP 连接.
 *      生产环境需要 TCP↔WebSocket 网关 (如 Node.js net 模块 + ws 库 转发),
 *      网关将原始 TCP 字节流原样通过 WebSocket (binaryType='arraybuffer') 转发给前端.
 *      或网关侧已经解析并以 JSON 推送 — 见 websocket.js 双模式支持.
 */

export const PROTOCOL_VERSION = 'V1.0'

export const FRAME_HEADER_B0 = 0xAA
export const FRAME_HEADER_B1 = 0x55

export const CMD = {
  SENSOR: 0xA1,
  FILE:   0xA2,
  CLOSE:  0xA3
}

export const FRAME_LEN = {
  SENSOR: 20,
  CLOSE:  4
}

// ---------- CRC-8 (poly 0x07, init 0x00) — 严格按协议文档实现 ----------
export function crc8(bytes, start = 0, end = bytes.length) {
  let crc = 0x00
  for (let i = start; i < end; i++) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80) crc = ((crc << 1) ^ 0x07) & 0xFF
      else            crc = (crc << 1) & 0xFF
    }
  }
  return crc
}

// ---------- 传感器数据帧 0xA1 ----------
/**
 * @param {Uint8Array} bytes  完整 20 字节帧
 * @returns 解析后字段, 含原始 7 个量 + 校验信息
 */
export function parseSensorFrame(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes)
  if (bytes.length !== FRAME_LEN.SENSOR) throw new Error(`sensor frame must be ${FRAME_LEN.SENSOR} bytes, got ${bytes.length}`)
  if (bytes[0] !== FRAME_HEADER_B0 || bytes[1] !== FRAME_HEADER_B1) throw new Error('bad frame header')
  if (bytes[2] !== CMD.SENSOR) throw new Error(`expect cmd 0xA1, got 0x${bytes[2].toString(16)}`)

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const load_voltage = dv.getUint16(3,  false) / 1000   // V
  const ch0_voltage  = dv.getUint16(5,  false) / 1000   // V
  const ch1_voltage  = dv.getUint16(7,  false) / 1000   // V
  const load_current = dv.getUint32(9,  false) / 1000   // A
  const temperature  = dv.getUint16(13, false) / 10     // ℃
  const h2_flow      = dv.getUint16(15, false) / 100    // L/min
  const h2_purity    = dv.getUint16(17, false) / 10     // %

  const rxCrc       = bytes[19]
  const expectedCrc = crc8(bytes, 0, 19)
  const crcValid    = (rxCrc === expectedCrc)

  return {
    timestamp:    Date.now(),
    load_voltage, ch0_voltage, ch1_voltage,
    load_current, temperature, h2_flow, h2_purity,
    _crc: { received: rxCrc, expected: expectedCrc, valid: crcValid }
  }
}

/**
 * 构造一帧 0xA1 (测试 / 网关推流用).
 * @param {object} data 见 parseSensorFrame 返回字段
 */
export function buildSensorFrame(data) {
  const frame = new Uint8Array(FRAME_LEN.SENSOR)
  const dv = new DataView(frame.buffer)
  frame[0] = FRAME_HEADER_B0
  frame[1] = FRAME_HEADER_B1
  frame[2] = CMD.SENSOR
  dv.setUint16(3,  Math.round(clamp(data.load_voltage, 0, 65.535) * 1000), false)
  dv.setUint16(5,  Math.round(clamp(data.ch0_voltage,  0, 65.535) * 1000), false)
  dv.setUint16(7,  Math.round(clamp(data.ch1_voltage,  0, 65.535) * 1000), false)
  dv.setUint32(9,  Math.round(clamp(data.load_current, 0, 4294967.295) * 1000), false)
  dv.setUint16(13, Math.round(clamp(data.temperature, -3276.8, 6553.5) * 10),   false)
  dv.setUint16(15, Math.round(clamp(data.h2_flow,     0, 655.35) * 100),        false)
  dv.setUint16(17, Math.round(clamp(data.h2_purity,   0, 6553.5) * 10),         false)
  frame[19] = crc8(frame, 0, 19)
  return frame
}

// ---------- 关闭文件帧 0xA3 ----------
export function buildCloseFrame() {
  const frame = new Uint8Array(FRAME_LEN.CLOSE)
  frame[0] = FRAME_HEADER_B0
  frame[1] = FRAME_HEADER_B1
  frame[2] = CMD.CLOSE
  frame[3] = crc8(frame, 0, 3)
  return frame
}

// ---------- 文件命令帧 0xA2 ----------
export function buildFileFrame(dirName) {
  const utf8 = new TextEncoder().encode(dirName)
  const N    = utf8.length
  const len  = 6 + N
  const frame = new Uint8Array(len)
  const dv = new DataView(frame.buffer)
  frame[0] = FRAME_HEADER_B0
  frame[1] = FRAME_HEADER_B1
  frame[2] = CMD.FILE
  dv.setUint16(3, N, false)
  frame.set(utf8, 5)
  frame[len - 1] = crc8(frame, 0, len - 1)
  return frame
}

/**
 * 在一段 ArrayBuffer 流中扫描出所有完整帧.
 * 用于网关直接转发 TCP 字节流时, 前端需要"找帧头 → 校验 → 解析"的场景.
 * 返回 { frames: [...解析对象], remainder: Uint8Array (未消费的剩余字节) }
 */
export function scanFrames(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const frames = []
  let i = 0
  while (i < bytes.length - 3) {
    if (bytes[i] === FRAME_HEADER_B0 && bytes[i + 1] === FRAME_HEADER_B1) {
      const cmd = bytes[i + 2]
      let frameLen = -1
      if (cmd === CMD.SENSOR) frameLen = FRAME_LEN.SENSOR
      else if (cmd === CMD.CLOSE) frameLen = FRAME_LEN.CLOSE
      else if (cmd === CMD.FILE && i + 5 <= bytes.length) {
        const N = (bytes[i + 3] << 8) | bytes[i + 4]
        frameLen = 6 + N
      }
      if (frameLen > 0 && i + frameLen <= bytes.length) {
        const frame = bytes.subarray(i, i + frameLen)
        if (cmd === CMD.SENSOR) {
          try { frames.push(parseSensorFrame(frame)) } catch (e) { /* 校验失败 - 跳过 */ }
        }
        i += frameLen
        continue
      } else if (frameLen > 0) {
        // 帧不完整, 等下次
        break
      }
    }
    i++ // 帧头错位 — 丢弃当前字节
  }
  return { frames, remainder: bytes.subarray(i) }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
