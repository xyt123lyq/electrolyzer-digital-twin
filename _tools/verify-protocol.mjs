/**
 * 协议一致性验证 — 跑一遍规范 V1.0 §9 全部三个案例, 字节级对照.
 *
 * 用法: node _tools/verify-protocol.mjs
 */
import {
  buildSensorFrame, parseSensorFrame,
  buildFileFrame, buildCloseFrame,
  scanFrames, crc8,
  CMD, FRAME_LEN, PROTOCOL_VERSION
} from '../src/api/protocol.js'

const ANSI = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`
}

let pass = 0, fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ${ANSI.green('✓')} ${name} ${detail && ANSI.dim('· ' + detail)}`) }
  else    { fail++; console.log(`  ${ANSI.red('✗')} ${name} ${ANSI.red(detail)}`) }
}
function hex(b) {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

console.log(ANSI.bold(`\n=== TCP 数据采集协议一致性验证 (${PROTOCOL_VERSION}) ===\n`))

/* ---------- §5 CRC-8 算法 ---------- */
console.log(ANSI.cyan('§5  CRC-8 (poly=0x07, init=0x00)'))
// 已知向量: 单字节 0x00 -> 0x00
check('crc8([0x00]) === 0x00', crc8(new Uint8Array([0x00])) === 0x00)
// 单字节 0x01 -> 0x07 (一次异或 0x07)
check('crc8([0x01]) === 0x07', crc8(new Uint8Array([0x01])) === 0x07)
// 简单序列, 用规范 C 代码独立计算: 0xAA 0x55 0xA3 -> 0x97
{
  const expected = referenceCrc8([0xAA, 0x55, 0xA3])
  const got = crc8(new Uint8Array([0xAA, 0x55, 0xA3]))
  check('crc8([0xAA 0x55 0xA3]) === reference impl', got === expected,
        `expected=0x${expected.toString(16)} got=0x${got.toString(16)}`)
}

/* ---------- §4.1 / §9.2 案例二: 传感器数据帧 (0xA1) ---------- */
console.log(ANSI.cyan('\n§4.1 / §9.2  传感器数据帧 (0xA1)'))
const sample = {
  load_voltage: 12.345,   // 0x3039 = 12345 -> /1000
  ch0_voltage:  5.678,    // 0x162E = 5678
  ch1_voltage:  3.210,    // 0x0C8A = 3210
  load_current: 1.234,    // 0x000004D2 = 1234
  temperature:  25.6,     // 0x0100 = 256 -> /10
  h2_flow:      16.80,    // 0x0690 = 1680 -> /100
  h2_purity:    85.2      // 0x0354 = 852 -> /10
}
const frame = buildSensorFrame(sample)
const expectedHex = 'AA 55 A1 30 39 16 2E 0C 8A 00 00 04 D2 01 00 06 90 03 54'  // 19 bytes (without CRC)
const expectedCrc = referenceCrc8(parseHex(expectedHex))

check('Total length = 20', frame.length === 20, `got ${frame.length}`)
check('Header[0..1] = AA 55', frame[0] === 0xAA && frame[1] === 0x55)
check('CMD[2] = A1', frame[2] === 0xA1)
check('Bytes[0..18] match spec §9.2 example',
      hex(frame.subarray(0, 19)) === expectedHex,
      `\n      expect ${expectedHex}\n      got    ${hex(frame.subarray(0, 19))}`)
check('CRC[19] matches reference impl', frame[19] === expectedCrc,
      `expected=0x${expectedCrc.toString(16).toUpperCase()} got=0x${frame[19].toString(16).toUpperCase()}`)

// 解析回来
const parsed = parseSensorFrame(frame)
check('parsed.load_voltage = 12.345', Math.abs(parsed.load_voltage - 12.345) < 1e-6)
check('parsed.ch0_voltage  = 5.678',  Math.abs(parsed.ch0_voltage  - 5.678)  < 1e-6)
check('parsed.ch1_voltage  = 3.210',  Math.abs(parsed.ch1_voltage  - 3.210)  < 1e-6)
check('parsed.load_current = 1.234',  Math.abs(parsed.load_current - 1.234)  < 1e-6)
check('parsed.temperature  = 25.6',   Math.abs(parsed.temperature  - 25.6)   < 1e-6)
check('parsed.h2_flow      = 16.80',  Math.abs(parsed.h2_flow      - 16.80)  < 1e-6)
check('parsed.h2_purity    = 85.2',   Math.abs(parsed.h2_purity    - 85.2)   < 1e-6)
check('parsed._crc.valid === true',   parsed._crc.valid === true)

/* ---------- §4.2 / §9.1 案例一: 文件命令帧 (0xA2) ---------- */
console.log(ANSI.cyan('\n§4.2 / §9.1  文件命令帧 (0xA2)'))
// 注: 规范 §9.1 文字写 "目录名长度为17字节" 但例子里的 "Experiment_20260213" 实际是 19 字节
//     hex 段也是 19 字节, 这是规范文档的内部笔误 (0x0011 应为 0x0013).
//     实现按字符串真实 UTF-8 字节长度处理 — 这是正确行为.
const dirName = 'Experiment_20260213'
const dirBytes = new TextEncoder().encode(dirName)
const N = dirBytes.length
const fileFrame = buildFileFrame(dirName)
check(`Total length = 6 + N`, fileFrame.length === 6 + N,
      `N=${N} ("${dirName}" UTF-8), 期望 ${6+N}, got ${fileFrame.length}`)
check('Header[0..1] = AA 55', fileFrame[0] === 0xAA && fileFrame[1] === 0x55)
check('CMD[2] = A2', fileFrame[2] === 0xA2)
check(`DataLen[3..4] = 0x${N.toString(16).padStart(4,'0').toUpperCase()} (UInt16 BE)`,
      fileFrame[3] === ((N >> 8) & 0xFF) && fileFrame[4] === (N & 0xFF),
      `got ${fileFrame[3].toString(16)} ${fileFrame[4].toString(16)}`)
check(`Payload[5..${4+N}] = UTF-8 "${dirName}"`,
      new TextDecoder().decode(fileFrame.subarray(5, 5+N)) === dirName)
const fileCrcExpected = referenceCrc8(fileFrame.subarray(0, fileFrame.length - 1))
check(`CRC[${fileFrame.length-1}] matches reference impl`,
      fileFrame[fileFrame.length - 1] === fileCrcExpected,
      `expected=0x${fileCrcExpected.toString(16).toUpperCase()} got=0x${fileFrame[fileFrame.length-1].toString(16).toUpperCase()}`)

// 短目录名 (匹配规范 §9.1 "17 字节" 文字描述, 用一个实际 17 字节的 ASCII 字符串验证)
{
  const shortName = '01234567890123456'  // 17 ASCII bytes
  const f = buildFileFrame(shortName)
  check('短目录名 (17 字节) Total length = 23',
        f.length === 23, `got ${f.length}`)
  check('短目录名 DataLen = 0x0011', f[3] === 0x00 && f[4] === 0x11)
}

/* ---------- §4.3 / §9.3 案例三: 关闭文件帧 (0xA3) ---------- */
console.log(ANSI.cyan('\n§4.3 / §9.3  关闭文件帧 (0xA3)'))
const closeFrame = buildCloseFrame()
check('Total length = 4', closeFrame.length === 4)
check('Header[0..1] = AA 55', closeFrame[0] === 0xAA && closeFrame[1] === 0x55)
check('CMD[2] = A3', closeFrame[2] === 0xA3)
check('CRC[3] matches reference impl',
      closeFrame[3] === referenceCrc8(closeFrame.subarray(0, 3)))

/* ---------- §8 异常处理: 帧头错位重新对齐 ---------- */
console.log(ANSI.cyan('\n§8  异常处理'))
{
  // 故意在前面塞 3 个垃圾字节, 然后 1 个完整 0xA1, 然后又 2 个垃圾
  const noise = new Uint8Array([0xFF, 0x00, 0x12])
  const tail  = new Uint8Array([0xCC, 0xCC])
  const stream = new Uint8Array(noise.length + frame.length + tail.length)
  stream.set(noise, 0)
  stream.set(frame, noise.length)
  stream.set(tail, noise.length + frame.length)
  const { frames, remainder } = scanFrames(stream)
  check('从噪声中能找回一帧 0xA1', frames.length === 1)
  check('找回帧的 CRC 校验通过', frames[0]?._crc?.valid === true)
  check('剩余字节保留 (尾部 2 字节噪声)', remainder.length === tail.length,
        `remainder.length=${remainder.length}`)
}
{
  // CRC 失败的帧 — scanFrames 仍会返回, 但标记 _crc.valid = false
  // (设计: 由上层 WebSocket 客户端再过滤, 见 websocket.js _handleBinary)
  const bad = new Uint8Array(frame)
  bad[19] = (bad[19] + 1) & 0xFF
  const { frames } = scanFrames(bad)
  check('CRC 错误帧仍返回但标记 _crc.valid = false',
        frames.length === 1 && frames[0]._crc.valid === false,
        `frames=${frames.length}, valid=${frames[0]?._crc?.valid}`)
}

/* ---------- §6 字节序确认 ---------- */
console.log(ANSI.cyan('\n§6  字节序 (大端)'))
{
  // 0x3039 BE = 12345 -> /1000 = 12.345
  // 如果错用小端, 0x3930 = 14640 -> /1000 = 14.640
  const f = buildSensorFrame({ load_voltage: 12.345, ch0_voltage: 0, ch1_voltage: 0, load_current: 0, temperature: 0, h2_flow: 0, h2_purity: 0 })
  check('load_voltage 12.345 → bytes[3..4] = 30 39 (大端)',
        f[3] === 0x30 && f[4] === 0x39,
        `got ${f[3].toString(16)} ${f[4].toString(16)}`)
}

/* ---------- 总结 ---------- */
console.log(ANSI.bold(`\n${'='.repeat(60)}`))
if (fail === 0) {
  console.log(ANSI.bold(ANSI.green(`✓ 全部 ${pass} 项通过 — protocol.js 与规范 V1.0 一致.`)))
  process.exit(0)
} else {
  console.log(ANSI.bold(ANSI.red(`✗ ${fail} 项失败 / ${pass} 项通过`)))
  process.exit(1)
}

/* ============== 工具: 独立 reference CRC-8 (直接照抄规范 C 代码) ============== */
function referenceCrc8(bytes) {
  let crc = 0x00
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x80) !== 0) crc = ((crc << 1) ^ 0x07) & 0xFF
      else                     crc = (crc << 1) & 0xFF
    }
  }
  return crc
}

function parseHex(s) {
  return new Uint8Array(s.replace(/\s+/g, '').match(/.{2}/g).map(x => parseInt(x, 16)))
}
