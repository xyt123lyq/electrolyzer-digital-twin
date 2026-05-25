import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 构建配置 — 同时支持浏览器部署 + Electron 打包.
 *
 * 关键点:
 *   - base: './' — Electron 通过 file:// 加载 dist/index.html, 必须用相对路径
 *   - target: es2017 — Electron 22 = Chromium 108 (ES2022 已 ok), 但浏览器部署
 *                      还要兼容工控机老 Chrome, 保守用 es2017
 *   - 三大重 vendor 分包: three / echarts / gsap 各自独立 chunk
 *   - 生产 drop console.* + debugger
 */
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    open: false,           // Electron 模式自己起窗口, 不再调系统默认浏览器
    strictPort: false
  },
  build: {
    target: 'es2017',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1500,
    sourcemap: mode !== 'production',
    minify: 'esbuild',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'vendor-three'
            if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts'
            if (id.includes('gsap')) return 'vendor-gsap'
            return 'vendor'
          }
        }
      }
    }
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
  }
}))
