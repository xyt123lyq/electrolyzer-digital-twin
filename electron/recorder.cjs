/* eslint-disable */
/**
 * XLSX 实时数据记录器 — 主进程侧.
 *
 * 设计:
 *  - 每帧追到内存 buffer (~500ms 一帧, 1 小时约 7200 帧)
 *  - 每 5s 把累积 buffer 写入当前小时的 .xlsx (覆盖式 — xlsx 不支持流式追加, 但单小时文件 < 1MB 写入耗时 < 100ms)
 *  - 文件按小时滚动: `electrolyzer_2026-05-23_14.xlsx`, 避免单文件无限增长
 *  - 默认目录: `~/Documents/Electrolyzer_Logs/`, 可通过 IPC 改
 *  - 字段: 按 TCP 协议 V1.0 原始字段 (8 列 + 序号)
 *  - 崩溃保护: process exit / SIGTERM 时强制 flush 一次
 */

const path = require('path')
const fs = require('fs')
const os = require('os')
const XLSX = require('xlsx')

const COLUMNS = [
  { key: 'seq',          header: '序号' },
  { key: 'timestamp',    header: '时间戳(ms)' },
  { key: 'timeStr',      header: '时间' },
  { key: 'load_voltage', header: '负载电压(V)' },
  { key: 'ch0_voltage',  header: 'CH0 电压(V)' },
  { key: 'ch1_voltage',  header: 'CH1 电压(V)' },
  { key: 'load_current', header: '负载电流(A)' },
  { key: 'temperature',  header: '温度(℃)' },
  { key: 'h2_flow',      header: 'H2 流量(L/min)' },
  { key: 'h2_purity',    header: 'H2 纯度(%)' }
]

const FLUSH_INTERVAL_MS = 5000

class XlsxRecorder {
  constructor() {
    this.enabled = false
    this.dirPath = path.join(os.homedir(), 'Documents', 'Electrolyzer_Logs')
    this.buffer = []                  // 累积的行, 5s flush 一次
    this.persistedRows = []           // 当前小时已经写入的所有行 (内存镜像, 用于覆盖式写入)
    this.currentHourKey = null        // YYYY-MM-DD_HH, 切换时滚动文件
    this.currentFilePath = null
    this.flushTimer = null
    this.seq = 0                      // 当前 session 累计序号
    this.lastError = null
    this.lastFlushAt = 0
    this.totalRows = 0                // session 累计写入条数 (含已 flush + buffer)
  }

  /** 开始录制 */
  start(opts = {}) {
    if (this.enabled) return this.status()
    if (opts.dirPath && typeof opts.dirPath === 'string') {
      this.dirPath = opts.dirPath
    }
    try {
      fs.mkdirSync(this.dirPath, { recursive: true })
    } catch (e) {
      this.lastError = `创建目录失败: ${e.message}`
      return this.status()
    }
    this.enabled = true
    this.seq = 0
    this.totalRows = 0
    this.lastError = null
    this.buffer = []
    this.persistedRows = []
    this.currentHourKey = null
    this.currentFilePath = null
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => { this.lastError = err.message })
    }, FLUSH_INTERVAL_MS)
    console.info(`[Recorder] start → ${this.dirPath}`)
    return this.status()
  }

  /** 停止录制, 强制最后一次 flush */
  async stop() {
    if (!this.enabled) return this.status()
    this.enabled = false
    if (this.flushTimer) { clearInterval(this.flushTimer); this.flushTimer = null }
    try { await this.flush() } catch (e) { this.lastError = e.message }
    console.info(`[Recorder] stop, total ${this.totalRows} rows`)
    return this.status()
  }

  /** 添加一帧数据 — 渲染端每来一个 sample 调一次 */
  add(raw) {
    if (!this.enabled || !raw) return
    const ts = raw.timestamp || Date.now()
    const hourKey = this._hourKey(ts)
    // 切到新一小时 → 先把当前累积 flush 完, 然后切文件
    if (this.currentHourKey && hourKey !== this.currentHourKey) {
      this.flush().catch(err => { this.lastError = err.message })
      this.persistedRows = []
      this.seq = 0
    }
    this.currentHourKey = hourKey
    this.currentFilePath = path.join(this.dirPath, `electrolyzer_${hourKey}.xlsx`)

    this.seq++
    this.totalRows++
    this.buffer.push({
      seq:          this.seq,
      timestamp:    ts,
      timeStr:      this._timeStr(ts),
      load_voltage: this._num(raw.load_voltage),
      ch0_voltage:  this._num(raw.ch0_voltage),
      ch1_voltage:  this._num(raw.ch1_voltage),
      load_current: this._num(raw.load_current),
      temperature:  this._num(raw.temperature),
      h2_flow:      this._num(raw.h2_flow),
      h2_purity:    this._num(raw.h2_purity)
    })
  }

  /** 把当前 buffer 合并到 persistedRows + 覆盖写文件 */
  async flush() {
    if (this.buffer.length === 0 || !this.currentFilePath) return
    const toAppend = this.buffer
    this.buffer = []
    this.persistedRows.push(...toAppend)

    // 拼成 AOA (array of arrays) — 表头 + 数据行
    const aoa = [COLUMNS.map(c => c.header)]
    for (const r of this.persistedRows) {
      aoa.push(COLUMNS.map(c => r[c.key] != null ? r[c.key] : ''))
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // 设列宽 (字符数), 让 Excel 打开后视觉舒服
    ws['!cols'] = [
      { wch: 8 }, { wch: 14 }, { wch: 20 },
      { wch: 12 }, { wch: 11 }, { wch: 11 },
      { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Telemetry')

    // 同步写 (XLSX 库的 writeFile 是同步的) — 在小文件 (<1MB) 上 < 100ms 可接受
    XLSX.writeFile(wb, this.currentFilePath, { bookType: 'xlsx' })
    this.lastFlushAt = Date.now()
  }

  /** 给渲染端的状态查询 */
  status() {
    return {
      enabled: this.enabled,
      dirPath: this.dirPath,
      currentFile: this.currentFilePath,
      totalRows: this.totalRows,
      bufferRows: this.buffer.length,
      lastFlushAt: this.lastFlushAt,
      lastError: this.lastError
    }
  }

  // ---------- helpers ----------
  _num(v) { const n = +v; return Number.isFinite(n) ? +n.toFixed(4) : 0 }
  _hourKey(ts) {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}`
  }
  _timeStr(ts) {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
  }
}

module.exports = { XlsxRecorder }
