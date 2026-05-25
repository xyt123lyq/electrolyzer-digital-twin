# 电解槽膜电极运行状态监测系统

工业级三层电解槽 **三维数字孪生展示** 页面 — Vue 3 + Vite + Three.js + GSAP + ECharts。
可交互、可拆解、可显示实时参数、可后续接入 TCP / WebSocket。

> 风格定位：工业数字孪生大屏 / 科技蓝 / 深色背景 / 类似工业控制室。
> **不是**完整数字孪生平台、**不是**后台管理系统、**不是** CAD 软件。

---

## 快速开始

```bash
npm install
npm run dev
```

启动后访问 `http://localhost:5173`。建议在 1080P 大屏 / 浏览器全屏下查看。

```bash
npm run build      # 构建 dist
npm run preview    # 本地预览构建产物
```

---

## 功能一览

| 区域           | 能力                                                                       |
|----------------|----------------------------------------------------------------------------|
| 3D 区 (60%)    | 三个独立 Cell · 导电板/流道板/膜/流道板/导电板 五层结构 · 鼠标拖拽 / 滚轮缩放 / 触屏支持 |
| 交互           | 点击 Cell — 爆炸拆解 (GSAP, 1.2s) · 再次点击 — 展示蛇形流道 + 蓝色粒子流体           |
| HUD            | 拆解后箭头指向膜, 显示 Cell N · 膜电压 / 电流 / 温度                                  |
| 实时面板       | 三个 Cell 参数卡 · 总电压 / 总电流 / 总功率 / 流量 / 氢气纯度                          |
| 图表           | V-T 三色折线 (60s 窗口滚动) · I-T 单线 · I-V 极化曲线 + 实时工作点 + 历史散点         |
| 仪表           | 流量 / 纯度 / 温度 三仪表盘                                                          |
| 数据源         | 默认模拟数据 (500ms 刷新, 随机游走) · 顶部可一键切换为 WebSocket                       |
| 自动演示模式   | 0s 旋转 → 3s Cell1 拆解 → 9s 流道粒子 → 12s Cell2 → 15s Cell3 → 20s 复位 (循环)        |

---

## 数据接入

> 当前默认运行**模拟数据** (500ms 刷新, 随机游走)。
> 真实接入支持两种模式，可在顶部"数据源"栏切换。

### 模式一：JSON over WebSocket (开发/调试推荐)

默认地址 `ws://localhost:8080`。后端推协议字段格式 JSON：

```json
{
  "timestamp":   1700000000000,
  "load_voltage": 5.73,
  "ch0_voltage":  1.91,
  "ch1_voltage":  1.88,
  "load_current": 12.345,
  "temperature":  52.1,
  "h2_flow":      2.40,
  "h2_purity":    99.2
}
```

也兼容旧的 `cell1_voltage / current / flow / purity` 字段名。

### 模式二：原始二进制帧 (生产部署)

完整对接 **TCP 数据采集系统通讯协议 V1.0** (`docProps/TCP数据采集系统通讯协议规范.docx`)。
浏览器无法直接连接 TCP，需要一层 **TCP↔WebSocket 网关** (Node.js / Go / Python 任选)。网关把设备 TCP 字节流原样通过 WebSocket 转发：

```javascript
// 网关示例 (Node.js)
const net = require('net');  const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', ws => {
  const tcp = net.createConnection(5001, '192.168.1.100');
  tcp.on('data', chunk => ws.readyState === 1 && ws.send(chunk));
  ws.on('close', () => tcp.destroy());
});
```

前端 `WebSocket.binaryType = 'arraybuffer'`，`src/api/protocol.js::scanFrames()` 自动完成"找帧头 0xAA 0x55 → CRC-8 校验 → 解析"，校验失败的帧自动丢弃，未对齐尾巴留到下一次拼接。

### 协议字段 → UI 字段映射

| 协议字段 | 单位 | UI 字段 |
|---|---|---|
| `load_voltage` | V | 总电压 / Cell3 = load − ch0 − ch1 |
| `ch0_voltage`  | V | Cell 1 电压 |
| `ch1_voltage`  | V | Cell 2 电压 |
| `load_current` | A | 总电流 (3 cell 串联共用) |
| `temperature`  | ℃ | 显示在 MEA HUD / 仪表 |
| `h2_flow`      | L/min | 流量仪表 |
| `h2_purity`    | % | 纯度仪表 |

### 帧格式速查 (0xA1 传感器帧, 20 字节)

```
[0..1]  0xAA 0x55         帧头
[2]     0xA1              命令字
[3..4]  UInt16 BE / 1000  负载电压 (V)
[5..6]  UInt16 BE / 1000  通道 0 电压 (V)
[7..8]  UInt16 BE / 1000  通道 1 电压 (V)
[9..12] UInt32 BE / 1000  负载电流 (A)
[13..14]UInt16 BE / 10    温度 (℃)
[15..16]UInt16 BE / 100   氢气流量 (L/min)
[17..18]UInt16 BE / 10    氢气浓度 (%)
[19]    CRC-8 (poly 0x07) 校验
```

---

## 目录结构

```
src/
├── views/
│   └── Electrolyzer.vue            主视图 (布局 / 顶部 / 自动演示)
├── components/
│   ├── Electrolyzer3D.vue          3D 容器 + HUD 标签
│   ├── CellModel.vue               单个 Cell 状态卡
│   ├── ExplosionController.vue     拆解 / 复位 / 演示开关
│   ├── WaveChart.vue               V-T / I-T 通用波形
│   ├── IVChart.vue                 I-V 极化曲线
│   ├── StatusPanel.vue             实时参数总览
│   ├── GaugePanel.vue              流量/纯度/温度仪表盘
│   └── DataConnector.vue           数据源状态 + WebSocket 接入
├── three/
│   ├── ElectrolyzerScene.js        Scene / Camera / Controls / 主循环 / 自动演示
│   ├── CellGenerator.js            五层 Cell 建模
│   ├── FlowChannel.js              蛇形流道 + 粒子流
│   ├── ExplosionAnimation.js       GSAP 爆炸 / 复位 timeline
│   └── Materials.js                工业风材质 (拉丝金属 / 半透明膜 / 加性粒子)
├── api/
│   └── websocket.js                WebSocket 客户端 (自动重连)
├── store/
│   └── useTelemetry.js             响应式遥测 state + mock 数据生成
├── styles/global.css               全局深色科技蓝主题
├── App.vue
└── main.js
```

---

## 关键参数 (均集中在 `src/three/CellGenerator.js` / `ExplosionAnimation.js`)

```js
CELL_CONFIG = {
  width: 120, height: 100, thickness: 18,
  layers: { conductive: 4, flowPlate: 3, membrane: 0.2 }
}
ExplosionConfig = { distance: 25, duration: 1.2, ease: 'power3.out' }
```

修改这些参数可即时改变三维尺寸 / 展开距离 / 动画曲线，无需改其他文件。

---

## 性能与适配

- WebGL 渲染，pixelRatio 限制到 2，可在 1080P 大屏稳定 60 FPS。
- 使用 `ResizeObserver` 自适应窗口与栅格布局变化。
- OrbitControls 已配置触摸手势(单指旋转、双指缩放/平移)，支持触摸屏。
