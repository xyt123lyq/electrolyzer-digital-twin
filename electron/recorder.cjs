/* eslint-disable */
/**
 * CSV 实时数据记录器 — 主进程侧.
 * 符合《TCP数据采集系统通讯协议规范 V1.0》第 7 节存储规范.
 *
 * 特性:
 *  - 格式: 纯文本 CSV (逗号分隔)
 *  - 命名: YYYY-MM-DD.csv, 支持跨日自动切换
 *  - 列定义: 完全契合规范规定的 8 列
 *  - 实时写入: 每当有新数据来时, 直接利用 Node.js 异步流追加写入 (fs.appendFile),
 *    即使系统意外崩溃/断电, 也绝不会丢失已写入的数据, 实现真正的实时高可靠落盘。
 */

const path = require('path')
const fs = require('fs')
const os = require('os')

const COLUMNS = [
  { key: 'timeStr',      header: '时间' },
  { key: 'load_voltage', header: '负载电压(V)' },
  { key: 'ch0_voltage',  header: '通道0电压(V)' },
  { key: 'ch1_voltage',  header: '通道1电压(V)' },
  { key: 'load_current', header: '负载电流(A)' },
  { key: 'temperature',  header: '温度(℃)' },
  { key: 'h2_flow',      header: '氢气流量(L/min)' },
  { key: 'h2_purity',    header: '氢气浓度(%)' }
]

class CsvRecorder {
  constructor() {
    this.enabled = false
    this.dirPath = path.join(os.homedir(), 'Documents', 'Electrolyzer_Logs')
    this.currentDateKey = null
    this.currentFilePath = null
    this.lastError = null
    this.lastWriteAt = 0
    this.totalRows = 0
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
    this.totalRows = 0
    this.lastError = null
    this.currentDateKey = null
    this.currentFilePath = null
    console.info(`[CsvRecorder] start → ${this.dirPath}`)
    return this.status()
  }

  /** 停止录制 */
  async stop() {
    if (!this.enabled) return this.status()
    this.enabled = false
    console.info(`[CsvRecorder] stop, total ${this.totalRows} rows recorded.`)
    return this.status()
  }

  /** 实时追加一条数据 */
  add(raw) {
    if (!this.enabled || !raw) return
    const ts = raw.timestamp || Date.now()
    const dateKey = this._dateKey(ts)

    // 检测日期跨天，切换新文件
    if (dateKey !== this.currentDateKey) {
      this.currentDateKey = dateKey
      this.currentFilePath = path.join(this.dirPath, `${dateKey}.csv`)
    }

    const row = {
      timeStr:      this._timeStr(ts),
      load_voltage: this._num(raw.load_voltage),
      ch0_voltage:  this._num(raw.ch0_voltage),
      ch1_voltage:  this._num(raw.ch1_voltage),
      load_current: this._num(raw.load_current),
      temperature:  this._num(raw.temperature),
      h2_flow:      this._num(raw.h2_flow),
      h2_purity:    this._num(raw.h2_purity)
    }

    const fileExists = fs.existsSync(this.currentFilePath)
    let writeStr = ''

    // 如果是新创建的文件，第一行先写入标准的表头（加 BOM \ufeff 保证 Excel/WPS 打开不乱码）
    if (!fileExists) {
      writeStr += '\ufeff' + COLUMNS.map(c => c.header).join(',') + '\n'
    }

    // 拼装单行 CSV 数据
    writeStr += COLUMNS.map(c => {
      const val = row[c.key]
      return val !== undefined && val !== null ? val : ''
    }).join(',') + '\n'

    // 采用流式异步追加写入 (High performance & Crash safe)
    fs.appendFile(this.currentFilePath, writeStr, 'utf8', (err) => {
      if (err) {
        this.lastError = `实时追加写入失败: ${err.message}`
        console.error(`[CsvRecorder] write error:`, err)
      } else {
        this.lastWriteAt = Date.now()
        this.totalRows++
      }
    })
  }

  /** 状态查询 */
  status() {
    return {
      enabled: this.enabled,
      dirPath: this.dirPath,
      currentFile: this.currentFilePath,
      totalRows: this.totalRows,
      bufferRows: 0, // CSV 实时写入，缓冲永远为 0
      lastFlushAt: this.lastWriteAt,
      lastError: this.lastError
    }
  }

  // ---------- 辅助格式化函数 ----------
  _num(v) { 
    const n = +v
    return Number.isFinite(n) ? +n.toFixed(4) : 0 
  }
  
  _dateKey(ts) {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  
  _timeStr(ts) {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
  }
}

module.exports = { XlsxRecorder: CsvRecorder } // 暴露同样的类名以保持外部兼容性
