import { createApp } from 'vue'
import App from './App.vue'
import { startMock } from './store/useTelemetry.js'
import './styles/global.css'

// 启动模拟数据流 (原由 DataConnector 组件负责, 该组件已下线后转到 app 启动阶段)
startMock(500)

createApp(App).mount('#app')
