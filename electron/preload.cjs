/* eslint-disable */
/**
 * Electron Preload — 仅暴露白名单 API 给渲染端.
 *
 * 当前只暴露应用信息, 后续如需读写本地配置/日志/串口 — 在这里加白名单接口.
 * 严禁: 不要直接把 ipcRenderer 暴露出去, 否则任何渲染端代码都能调任意主进程 channel.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  // 查询主进程版本/平台 (调试 / 看板状态栏可显示)
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  // XLSX 实时记录器
  recorder: {
    start:     (opts) => ipcRenderer.invoke('recorder:start', opts),
    stop:      ()     => ipcRenderer.invoke('recorder:stop'),
    status:    ()     => ipcRenderer.invoke('recorder:status'),
    add:       (raw)  => ipcRenderer.send('recorder:add', raw),  // 高频, fire-and-forget
    chooseDir: ()     => ipcRenderer.invoke('recorder:choose-dir'),
    openDir:   ()     => ipcRenderer.invoke('recorder:open-dir')
  }
})
