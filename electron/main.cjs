/* eslint-disable */
/**
 * Electron 主进程 — 工业三层电解槽监测系统
 *
 * 兼容性目标:
 *   - Windows 7 SP1 (x64) 及以上
 *   - 老旧 GPU 驱动 (XP 升级机/SCADA 工控机) — ANGLE D3D9 回退
 *   - 离线环境 (不依赖 CDN / 远端 API)
 *
 * 启动模式:
 *   - 开发 (electron:dev): 加载 Vite Dev Server (http://localhost:5173)
 *   - 生产 (打包后):       加载 file:// 协议下的 dist/index.html
 */

const { app, BrowserWindow, Menu, shell, ipcMain, screen, dialog } = require('electron')
const path = require('path')
const { XlsxRecorder } = require('./recorder.cjs')

// XLSX 实时数据记录器 (单例)
const recorder = new XlsxRecorder()

// ----------------------------------------------------------------------------
// Windows 7 / 旧 GPU 兼容性命令行开关 (必须在 app.whenReady 之前调用)
// ----------------------------------------------------------------------------
// 1. Win7 上 GPU sandbox 在部分驱动下崩溃 — 禁用之
// 2. ANGLE: 强制 D3D9 后端, 兼容老 Intel HD / NVIDIA Quadro K 系
//    (默认 D3D11 在某些 Win7 显卡驱动上失败导致白屏)
// 3. 关闭 backgroundThrottling 避免最小化后停帧
// 4. ignore-gpu-blocklist: 即使 Chromium 觉得驱动太老也强行启用 WebGL
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')
// Win7 上若环境变量指定 ANGLE_BACKEND=d3d9 则覆盖
if ((process.env.ANGLE_BACKEND || '').toLowerCase() === 'd3d9') {
  app.commandLine.appendSwitch('use-angle', 'd3d9')
} else {
  app.commandLine.appendSwitch('use-angle', 'd3d11')
}
// 单实例锁: 防止双开导致 WebSocket 端口/串口冲突
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

const isDev = !!process.env.VITE_DEV_SERVER_URL
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

let mainWindow = null

function getPreferredWindowSize() {
  try {
    const display = screen.getPrimaryDisplay()
    const wa = display.workAreaSize
    // 工控机分辨率常见 1366x768 / 1440x900 / 1920x1080 — 启动时占 92% 可用面积
    return {
      width: Math.max(1280, Math.min(1920, Math.floor(wa.width * 0.92))),
      height: Math.max(720, Math.min(1080, Math.floor(wa.height * 0.92)))
    }
  } catch (e) {
    return { width: 1366, height: 768 }
  }
}

function createMainWindow() {
  const size = getPreferredWindowSize()
  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#02101e',
    autoHideMenuBar: true,
    title: '电解槽膜电极运行状态监测系统',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,            // Win7 sandbox 不可靠, 关掉避免黑屏
      webgl: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  })

  // 隐藏菜单栏 (工业看板不需要 File/Edit/View 菜单)
  Menu.setApplicationMenu(null)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  // 外链统一交给默认浏览器打开, 不在 Electron 内嵌
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 渲染进程崩溃日志 (Win7 老驱动下偶发)
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Electron] render-process-gone:', details)
  })

  // 加载页面
  if (isDev) {
    mainWindow.loadURL(DEV_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // F11 全屏 / F12 DevTools (工业看板常用)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen())
      event.preventDefault()
    } else if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools()
      event.preventDefault()
    } else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reload()
      event.preventDefault()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// 单实例: 第二实例启动时聚焦已有窗口
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
  // 自动启动 XLSX 录制 — 工业看板默认全程记录, 不用人去手动点
  try {
    recorder.start()
  } catch (e) {
    console.error('[Recorder] auto-start failed:', e)
  }
})

app.on('window-all-closed', () => {
  // 工业看板: 所有窗口关闭即退出, 不保留 dock (Mac 例外)
  if (process.platform !== 'darwin') app.quit()
})

// 简易 IPC: 渲染端可通过 preload 暴露的 API 查询应用版本 / 平台
ipcMain.handle('app:get-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node
}))

// ---------- XLSX 录制器 IPC ----------
ipcMain.handle('recorder:start',   (_e, opts) => recorder.start(opts || {}))
ipcMain.handle('recorder:stop',    () => recorder.stop())
ipcMain.handle('recorder:status',  () => recorder.status())
ipcMain.on(    'recorder:add',     (_e, raw) => recorder.add(raw))   // 高频, 用 send 而非 invoke 避免 IPC 阻塞
ipcMain.handle('recorder:choose-dir', async () => {
  if (!mainWindow) return null
  const r = await dialog.showOpenDialog(mainWindow, {
    title: '选择 XLSX 记录目录',
    properties: ['openDirectory', 'createDirectory']
  })
  if (r.canceled || !r.filePaths?.length) return null
  return r.filePaths[0]
})
ipcMain.handle('recorder:open-dir', () => {
  const s = recorder.status()
  if (s.dirPath) {
    // 兜底: 哪怕还没开始录制, 目录也可能不存在 — 先创建再打开, 避免 Windows shell 弹"找不到文件"
    try { require('fs').mkdirSync(s.dirPath, { recursive: true }) } catch (e) { /* noop */ }
    shell.openPath(s.dirPath)
  }
  return s
})

// 进程退出时强制 flush 一次 (崩溃/Ctrl+C/正常退出都覆盖)
app.on('before-quit', async (e) => {
  if (recorder.enabled || recorder.status().bufferRows > 0) {
    e.preventDefault()
    try { await recorder.stop() } catch (err) { console.error('[Recorder] stop on quit failed:', err) }
    app.quit()
  }
})
