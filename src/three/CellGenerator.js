import * as THREE from 'three'
import { MaterialPresets } from './Materials.js'

/**
 * 单个 Cell 电解槽组件尺寸配置 (单位 mm — 直接用作 Three.js 世界单位)
 *
 * 10 件 BOM (基于实物 5 张照片精确重建):
 *  1. 上铜端盖 (topCover)      — 紫铜 Ø80mm 15mm厚, 3 气液接头, 8螺栓孔, 两侧切平
 *  2. POM 垫片 (upperGasket)   — 白色 Ø76mm 5mm厚, 8孔, 四叶O-ring
 *  3. 阳极板 (anodePlate)      — 银色 Ø76mm 2mm厚, 18孔, 耳片 +X
 *  4. 中间复合件 (middleGasket)— Ø76mm白色POM盘 5mm厚 + 25×25mm 黑色MEA嵌入中心
 *  5. 阴极板 (cathodePlate)    — 同阳极板, 耳片 -X
 *  6. POM 垫片 (lowerGasket)   — 白色 Ø76mm 5mm厚, 8孔, 四叶O-ring
 *  7. 下铜端盖 (bottomCover)   — 同上端盖但无气液接头
 *  8. 平垫圈 ×8 (flatWashers) — 在顶盖上方螺柱上
 *  9. 六角螺母 ×8 (nuts)      — 垫圈上方
 * 10. 螺柱 ×8 (bolts)         — 贯穿全高
 *
 * 侧视图层叠 (从场景顶部 +Z 到底部 -Z):
 *   [螺母+垫圈]
 *   [上铜端盖 — 紫铜, 15mm, 含气液接头]
 *   [POM垫片上 — 白色, 5mm]
 *   [阳极板 — 银色, 2mm]
 *   [POM+MEA复合 — 白色, 5mm, 含黑色MEA]
 *   [阴极板 — 银色, 2mm]
 *   [POM垫片下 — 白色, 5mm]
 *   [下铜端盖 — 紫铜, 15mm]
 *
 * 场景方向: cellGroup.rotation.x = -Math.PI/2
 *   +Z = 场景上方 = 顶盖+螺母/垫圈端
 *   -Z = 场景下方 = 底盖端
 */
export const CELL_CONFIG = {
  diameter:      80,   // 铜端盖外径 mm
  innerDiameter: 76,   // POM 垫 / 极板外径 mm

  cover: {
    thickness: 15,     // 铜端盖厚度 mm
    segments:  48
  },
  gasket: {
    thickness:  5,     // POM 垫厚度 mm
    segments:  40
  },
  plate: {
    thickness:  2,     // 极板厚度 mm (照片: barely visible thin line)
    segments:  40
  },
  mea: {
    size:      25,     // MEA 边长 mm (正方形)
    thickness:  1.5    // MEA 厚度 mm (嵌入POM面)
  },
  middleGasket: {
    thickness: 6       // POM+MEA 复合件厚度 mm (比普通POM垫厚, 有凸台+MEA)
  },
  bolt: {
    count:     8,      // 8 根螺柱
    pcd:      58,      // 螺柱节圆直径 mm
    diameter:  4,      // 螺柱直径 mm (实物细于气液接头)
    length:   80,      // 螺柱名义长度 mm
    nutHeight: 3,      // 螺母高度 mm
    nutAF:     7       // 螺母对边距 mm
  },
  washer: {
    od:        8,      // 平垫圈外径 mm
    id:        4.5,    // 平垫圈内径 mm
    thickness: 1.5     // 平垫圈厚度 mm
  },
  gasPort: {
    count: 3
  },
  lug: {
    width:       10,   // 耳片宽度 (Y方向) mm
    length:      12,   // 耳片伸出长度 (X方向) mm
    thickness:    2,   // 耳片厚度 mm (与极板同厚)
    holeRadius:   2.5, // 耳片孔半径 mm
    holeCount:    1,   // 耳片孔数量 (单孔居中)
    holeSpacing:  8    // 两孔中心间距 mm (单孔时不使用)
  },

  // 兼容外部引用
  get width()  { return this.diameter },
  get height() { return this.diameter }
}

/**
 * 计算 Cell 核心层叠总厚度 (不含螺栓突出及螺母/垫圈):
 *   2×copper + 2×POM_outer + 2×plate + 1×middleGasket(=POM thickness)
 */
export function cellCoreThickness() {
  const c = CELL_CONFIG
  return (
    c.cover.thickness  * 2 +
    c.gasket.thickness * 2 +  // upper + lower
    c.middleGasket.thickness + // middle (POM+MEA)
    c.plate.thickness  * 2
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Z 坐标计算 (对称轴: middleGasket 中心 Z=0)
// +Z = 场景上方 = topCover + 螺母/垫圈
// -Z = 场景下方 = bottomCover
// ─────────────────────────────────────────────────────────────────────────────

function _layerZ(c) {
  const mgT = c.middleGasket.thickness  // 6 (POM+MEA复合件)
  const gT  = c.gasket.thickness    // 5
  const pT  = c.plate.thickness     // 2
  const cvT = c.cover.thickness     // 15
  const wT  = c.washer.thickness    // 1.5
  const nH  = c.bolt.nutHeight      // 5

  // middleGasket (POM+MEA 复合件) 居中 Z=0
  const middleGasket = 0

  // +Z 方向 (场景上方, topCover 端)
  const anodePlate  = +(mgT / 2 + pT / 2)
  const upperGasket = +(mgT / 2 + pT + gT / 2)
  const topCover    = +(mgT / 2 + pT + gT + cvT / 2)

  // 螺母/垫圈在顶盖外侧面上方
  const flatWashers = topCover + cvT / 2 + wT / 2
  const nuts        = flatWashers + wT / 2 + nH / 2
  const bolts       = 0   // 螺柱居中 (全高贯穿), offset 内部处理

  // -Z 方向 (场景下方, bottomCover 端)
  const cathodePlate = -(mgT / 2 + pT / 2)
  const lowerGasket  = -(mgT / 2 + pT + gT / 2)
  const bottomCover  = -(mgT / 2 + pT + gT + cvT / 2)

  return {
    bolts, nuts, flatWashers,
    topCover, upperGasket, anodePlate,
    middleGasket,
    cathodePlate, lowerGasket, bottomCover
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildCell(index) → THREE.Group
 *
 * 返回完整的单节电解槽装配组.
 * group.userData.layers            — 各层 Group 引用
 * group.userData.originalPositions — 各层初始 Z 坐标 (爆炸动画用)
 */
export function buildCell(index = 0) {
  const c = CELL_CONFIG
  const z = _layerZ(c)

  // 构建各层 (从 +Z 到 -Z 顺序)
  const topCover     = _makeCopper('topCover',     true,  z.topCover)
  const upperGasket  = _makePOMGasket('upperGasket',      z.upperGasket)
  const anodePlate   = _makeConductivePlate('anodePlate',   true,  z.anodePlate)
  const middleGasket = _makeMiddleGasket(z.middleGasket)
  const cathodePlate = _makeConductivePlate('cathodePlate', false, z.cathodePlate)
  const lowerGasket  = _makePOMGasket('lowerGasket',       z.lowerGasket)
  const bottomCover  = _makeCopper('bottomCover',  false, z.bottomCover)
  const flatWashers  = _makeFlatWashers(z)
  const nuts         = _makeNuts(z)
  const bolts        = _makeBolts(z)

  const group = new THREE.Group()
  group.name = `Cell_${index + 1}`
  group.userData.cellIndex = index
  group.userData.state = 'closed'

  group.add(
    topCover, upperGasket, anodePlate,
    middleGasket,
    cathodePlate, lowerGasket, bottomCover,
    flatWashers, nuts, bolts
  )

  const layers = {
    bolts, nuts, flatWashers,
    topCover, upperGasket, anodePlate,
    middleGasket,
    cathodePlate, lowerGasket, bottomCover
  }

  // 向后兼容: ExplosionAnimation.js 和 ElectrolyzerScene.js 引用 layers.mea
  layers.mea = middleGasket

  group.userData.layers = layers

  group.userData.originalPositions = {
    bolts:         z.bolts,
    nuts:          z.nuts,
    flatWashers:   z.flatWashers,
    topCover:      z.topCover,
    upperGasket:   z.upperGasket,
    anodePlate:    z.anodePlate,
    middleGasket:  z.middleGasket,
    mea:           z.middleGasket,   // 别名, 保持兼容
    cathodePlate:  z.cathodePlate,
    lowerGasket:   z.lowerGasket,
    bottomCover:   z.bottomCover
  }

  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 铜端盖  (topCover / bottomCover)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _makeCopper(name, isTopCover, zPos)
 *
 * Ø80mm 紫铜圆柱, 15mm 厚.
 * - 两侧切平 (±X): 各切入约 5mm, 宽度约 28mm (照片可见 "D形" 轮廓)
 * - 8 螺栓通孔 (PCD=58mm, 45° 间隔)
 * - isTopCover=true: 外侧面 (+Z 方向) 添加 3 气液接头 + 1 中心小口
 * - isTopCover=false: 平端盖 (螺柱从底部穿出, 无接头)
 */
function _makeCopper(name, isTopCover, zPos) {
  const c   = CELL_CONFIG
  const R   = c.diameter / 2        // 40
  const T   = c.cover.thickness     // 15
  const seg = c.cover.segments      // 48

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.endplate()

  // 主圆柱体
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, seg), mat)
  body.rotation.x = Math.PI / 2
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // 单侧切平 (-X): 同色铜盒盖住弧面
  const cutDepth = 4
  const cutW = 28
  const flat = new THREE.Mesh(new THREE.BoxGeometry(cutDepth, cutW, T), mat)
  flat.position.set(-(R - cutDepth / 2 + 0.3), 0, 0)
  flat.castShadow = true
  group.add(flat)

  // 8 螺栓通孔 (PCD=58mm)
  _addCopperBoltHoles(group, T)

  // 气液接头在外侧面 (+Z 方向 = 场景顶面)
  if (isTopCover) {
    _addGasPorts(group, T / 2)
  }

  group.position.z = zPos
  return group
}

/**
 * 8 个螺栓通孔, PCD=58mm, 均匀 45° 间隔.
 * 用深色圆柱穿透端盖, 两端加浅铜色倒角圆盘.
 */
function _addCopperBoltHoles(parent, thickness) {
  const bCfg    = CELL_CONFIG.bolt
  const pcdR    = bCfg.pcd / 2      // 29
  const hR      = bCfg.diameter / 2 // 3
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x060808, metalness: 0.15, roughness: 0.90
  })
  const chamMat = new THREE.MeshStandardMaterial({
    color: 0x8B5A1A, metalness: 0.80, roughness: 0.32
  })
  const holeGeo = new THREE.CylinderGeometry(hR, hR, thickness * 1.06, 12)
  const chamGeo = new THREE.CylinderGeometry(hR + 1.8, hR + 1.8, 1.4, 16)

  for (let i = 0; i < bCfg.count; i++) {
    const angle = (i / bCfg.count) * Math.PI * 2
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR

    const hole = new THREE.Mesh(holeGeo, holeMat)
    hole.rotation.x = Math.PI / 2
    hole.position.set(x, y, 0)
    parent.add(hole)

    // 两端倒角圆盘
    for (const side of [-1, 1]) {
      const cham = new THREE.Mesh(chamGeo, chamMat)
      cham.rotation.x = Math.PI / 2
      cham.position.set(x, y, side * (thickness / 2 - 0.4))
      parent.add(cham)
    }
  }
}

/**
 * 3 个气液接头 + 1 个中心小口, 从端盖外侧面 (+Z) 向外伸出.
 *
 * 非对称布局 (匹配照片 #50):
 *   接头尺寸各异 (不同管径), 模拟不锈钢快插接头外观.
 * portFaceZ = T/2 = 端盖外侧面的本地 Z 坐标.
 */
function _addGasPorts(parent, portFaceZ) {
  const mat     = MaterialPresets.gasPort()
  const boreMat = new THREE.MeshStandardMaterial({
    color: 0x050505, metalness: 0.1, roughness: 0.9
  })

  const layout = [
    { x: -14, y:  12, hexR: 5.5, bodyR: 3.5, bodyH: 8 },
    { x:  10, y:  12, hexR: 5.0, bodyR: 3.2, bodyH: 7 },
    { x:   0, y: -12, hexR: 6.0, bodyR: 4.0, bodyH: 9 }
  ]

  for (const p of layout) {
    const sub = new THREE.Group()

    // 法兰圆盘 (贴端盖面)
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(p.hexR + 1, p.hexR + 1, 2, 20), mat)
    flange.rotation.x = Math.PI / 2
    flange.position.z = portFaceZ + 1
    sub.add(flange)

    // 六角螺母头 (6边)
    const hexR = p.hexR / Math.cos(Math.PI / 6)
    const hex  = new THREE.Mesh(
      new THREE.CylinderGeometry(hexR, hexR, 4, 6), mat)
    hex.rotation.x = Math.PI / 2
    hex.position.z = portFaceZ + 3
    sub.add(hex)

    // 管身圆柱
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(p.bodyR, p.bodyR, p.bodyH, 16), mat)
    tube.rotation.x = Math.PI / 2
    tube.position.z = portFaceZ + 5 + p.bodyH / 2
    sub.add(tube)

    // 内孔
    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(p.bodyR * 0.6, p.bodyR * 0.6, p.bodyH + 8, 12), boreMat)
    bore.rotation.x = Math.PI / 2
    bore.position.z = portFaceZ + p.bodyH / 2 + 2
    sub.add(bore)

    sub.position.set(p.x, p.y, 0)
    parent.add(sub)
  }

  // 中心小口 (传感器/取样口)
  const cp = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 6, 16), mat)
  cp.rotation.x = Math.PI / 2
  cp.position.z = portFaceZ + 3
  parent.add(cp)

  const cb = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 8, 12), boreMat)
  cb.rotation.x = Math.PI / 2
  cb.position.z = portFaceZ + 3
  parent.add(cb)
}

// ─────────────────────────────────────────────────────────────────────────────
// POM 绝缘垫片 (upperGasket / lowerGasket)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _makePOMGasket(name, zPos)
 *
 * Ø76mm 白色 POM 圆盘, 5mm 厚.
 * - 8 螺栓通孔 (PCD=58mm, 45° 间隔)
 * - 四叶花形 O-ring (黑色橡胶) 在内面 (朝向极板侧)
 * - group.material 暴露给外部 (GLB 加载时替换)
 */
function _makePOMGasket(name, zPos) {
  const c   = CELL_CONFIG
  const R   = c.innerDiameter / 2   // 38
  const T   = c.gasket.thickness    // 5

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const pomMat = MaterialPresets.flowPlate()
  const disc   = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, T, c.gasket.segments), pomMat)
  disc.rotation.x = Math.PI / 2
  disc.castShadow = true
  disc.receiveShadow = true
  group.add(disc)

  // 暴露给外部 (GLB 扫描模型替换时保留引用)
  group.material = pomMat

  // 8 螺栓通孔 (PCD=58mm)
  _addGasketBoltHoles(group, T)

  // 四叶花形密封 O-ring (内面: 朝向极板)
  _addCloverOring(group, T)

  group.position.z = zPos
  return group
}

/**
 * 8 个螺栓通孔, PCD=58mm (R=29), 45° 均匀分布.
 */
function _addGasketBoltHoles(parent, thickness) {
  const count   = 8
  const pcdR    = CELL_CONFIG.bolt.pcd / 2   // 29
  const hR      = CELL_CONFIG.bolt.diameter / 2
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x060808, metalness: 0.15, roughness: 0.90
  })
  const holeGeo = new THREE.CylinderGeometry(hR, hR, thickness * 1.06, 12)

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR
    const hole = new THREE.Mesh(holeGeo, holeMat)
    hole.rotation.x = Math.PI / 2
    hole.position.set(x, y, 0)
    parent.add(hole)
  }
}

/**
 * 密封 O-ring — 竖向圆角矩形轮廓 (匹配实物照片 #98)
 *
 * 使用 THREE.TubeGeometry 沿 CatmullRomCurve3 闭合路径生成一根连续橡胶环.
 * 形状为竖向圆角矩形: 约 35mm 高 × 25mm 宽, 顶/底有半圆形耳状延伸,
 * 左右侧平缓鼓出, 无尖叶, 所有角落圆滑过渡.
 *
 * 控制点位于 XY 平面 (Z=0), 从顶部圆耳尖端顺时针绕一圈.
 * tension=0.5 保证曲线平滑, tubeRadius=1.8 匹配实物粗壮橡胶环.
 *
 * 放置位置: ring.position.z = gasketT/2 (朝向极板的内侧面)
 */
function _addCloverOring(parent, gasketT) {
  const mat = MaterialPresets.gasket()

  // 控制点: 四叶花型 — 4 个瓣(N/S/E/W) + 瓣间凹陷 + 上下窄通道
  // 严格匹配实物照片 Image #113
  // 四叶花型: 4 个瓣大小相同, 对称分布, 不超过螺丝孔PCD
  // 照片 #123: 竖向四叶花 — 上下窄通道 + 左右宽圆瓣 + 瓣间凹陷
  const pts = [
    // 上通道尖端 (窄颈)
    new THREE.Vector3(0, 22, 0),
    new THREE.Vector3(3, 19, 0),
    new THREE.Vector3(4, 15, 0),
    // 上右凹陷 (向中心收窄)
    new THREE.Vector3(6, 11, 0),
    new THREE.Vector3(7, 8, 0),
    // 右瓣 (宽圆弧)
    new THREE.Vector3(11, 6, 0),
    new THREE.Vector3(15, 3, 0),
    new THREE.Vector3(17, 0, 0),
    new THREE.Vector3(15, -3, 0),
    new THREE.Vector3(11, -6, 0),
    // 下右凹陷
    new THREE.Vector3(7, -8, 0),
    new THREE.Vector3(6, -11, 0),
    // 下通道 (窄颈)
    new THREE.Vector3(4, -15, 0),
    new THREE.Vector3(3, -19, 0),
    new THREE.Vector3(0, -22, 0),
    // 下左过渡
    new THREE.Vector3(-3, -19, 0),
    new THREE.Vector3(-4, -15, 0),
    // 下左凹陷
    new THREE.Vector3(-6, -11, 0),
    new THREE.Vector3(-7, -8, 0),
    // 左瓣 (宽圆弧)
    new THREE.Vector3(-11, -6, 0),
    new THREE.Vector3(-15, -3, 0),
    new THREE.Vector3(-17, 0, 0),
    new THREE.Vector3(-15, 3, 0),
    new THREE.Vector3(-11, 6, 0),
    // 上左凹陷
    new THREE.Vector3(-7, 8, 0),
    new THREE.Vector3(-6, 11, 0),
    // 回到上通道
    new THREE.Vector3(-4, 15, 0),
    new THREE.Vector3(-3, 19, 0),
  ]

  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.35)

  // TubeGeometry(path, tubularSegments, tubeRadius, radialSegments, closed)
  // tubeRadius=1.8 → 截面直径 3.6mm, 匹配实物粗壮橡胶环
  const geo  = new THREE.TubeGeometry(curve, 120, 1.8, 10, true)
  const ring = new THREE.Mesh(geo, mat)

  // 内侧面朝向极板 (+Z 方向)
  ring.position.z = gasketT / 2

  parent.add(ring)
}

/**
 * 星形放射流道 — 从 MEA 区域向外辐射 8 条浅槽 (照片 #7 清晰可见).
 * 模拟 POM 表面模压的液体分布通道.
 */
function _addFlowChannels(parent, gasketT, meaSize) {
  const channelMat = new THREE.MeshStandardMaterial({
    color: 0xd8d8d5, metalness: 0.0, roughness: 0.55
  })

  const innerR = meaSize / 2 + 3
  const outerR = 28
  const channelW = 1.5
  const channelD = 0.6
  const surfZ = gasketT / 2 + 0.05

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8
    const len = outerR - innerR
    const geo = new THREE.BoxGeometry(len, channelW, channelD)
    const mesh = new THREE.Mesh(geo, channelMat)
    const mx = Math.cos(angle) * (innerR + len / 2)
    const my = Math.sin(angle) * (innerR + len / 2)
    mesh.position.set(mx, my, surfZ)
    mesh.rotation.z = angle
    parent.add(mesh)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 中间 POM+MEA 复合件 (middleGasket)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _makeMiddleGasket(zPos)
 *
 * POM+MEA 复合件 — 装配中心 (Z=0):
 *   主体:  Ø76mm 白色 POM 圆盘, 5mm 厚 (与普通 POM 垫等厚)
 *   MEA:   25×25mm 黑色碳纸电极, 嵌入 +Z 侧面 flush (厚 1.5mm)
 *   O-ring: 四叶花形, 围绕 MEA (同 _addCloverOring, 但在 +Z 侧面)
 *   孔:    8 螺栓通孔 (PCD=58mm, 与其他层对齐)
 *   耳片:  金属安装耳, 从边缘伸出 (busLug 材质)
 *
 * 暴露引用 (爆炸动画):
 *   group.material        — gdlMat (emissive 脉冲驱动)
 *   group.userData.edge   — edgeMat (LineBasicMaterial, 边缘辉光)
 */
function _makeMiddleGasket(zPos) {
  const c      = CELL_CONFIG
  const meaCfg = c.mea
  const R      = c.innerDiameter / 2   // 38
  const T      = c.middleGasket.thickness  // 6 (POM+MEA 复合件)

  const group = new THREE.Group()
  group.name = 'middleGasket'
  group.userData.layer = 'middleGasket'

  // ── 主体: Ø76mm 白色 POM 圆盘 ────────────────────────────────────────────
  const pomMat  = MaterialPresets.flowPlate()
  const pomDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, T, 48), pomMat)
  pomDisc.rotation.x = Math.PI / 2
  pomDisc.name = 'middleGasket_pom'
  pomDisc.castShadow = true
  pomDisc.receiveShadow = true
  group.add(pomDisc)

  // ── 8 螺栓通孔 (PCD=58mm) ────────────────────────────────────────────────
  _addGasketBoltHoles(group, T)

  // ── 中心 MEA 电极 (25×25mm, 嵌入 +Z 侧面 flush) ────────────────────────
  const gdlMat  = MaterialPresets.gdl()
  const gdlGeo  = new THREE.BoxGeometry(
    meaCfg.size, meaCfg.size, meaCfg.thickness)
  const gdlMesh = new THREE.Mesh(gdlGeo, gdlMat)
  gdlMesh.name = 'middleGasket_mea'
  // flush 嵌入: MEA 外面与 POM 盘 +Z 面齐平
  gdlMesh.position.z = T / 2 - meaCfg.thickness / 2
  gdlMesh.castShadow = true
  group.add(gdlMesh)

  // MEA 边缘辉光 (EdgesGeometry)
  const edgeGeo  = new THREE.EdgesGeometry(gdlGeo)
  const edgeMat  = MaterialPresets.edgeGlow()
  const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat)
  edgeLine.name = 'middleGasket_edge'
  edgeLine.position.copy(gdlMesh.position)
  group.add(edgeLine)

  // ── 四叶花形 O-ring (围绕 MEA, +Z 侧面) ────────────────────────────────
  // 复用 _addCloverOring (lobes 位于 +T/2 侧面)
  _addCloverOring(group, T)

  // ── 星形放射流道 (MEA 周围, +Z 侧面, 匹配实物照片 #7) ───────────────────
  _addFlowChannels(group, T, meaCfg.size)

  // ── 暴露引用给爆炸动画 ───────────────────────────────────────────────────
  group.material      = gdlMat    // emissive 脉冲驱动 (emissiveIntensity)
  group.userData.edge = edgeMat   // 边缘辉光 opacity 动画

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 导电极板 (阳极板 / 阴极板)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _makeConductivePlate(name, isAnode, zPos)
 *
 * Ø76mm 银色圆盘, 2mm 厚 (照片: barely visible thin line).
 * - 8 孔外圈 (PCD=58mm, 与 POM 垫孔对齐)
 * - 10 孔内圈 (PCD=30mm, 流体分布)
 * - 安装耳片: isAnode=true → +X 侧; false → -X 侧
 */
function _makeConductivePlate(name, isAnode, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2   // 38
  const T = c.plate.thickness     // 2

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat  = MaterialPresets.conductive()
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, T, c.plate.segments), mat)
  disc.rotation.x = Math.PI / 2
  disc.castShadow = true
  disc.receiveShadow = true
  group.add(disc)

  // 8 孔外圈 (PCD=58mm)
  _addPlateOuterHoles(group, T)

  // 10 孔内圈 (PCD=30mm)
  _addPlateInnerHoles(group, T)

  // 安装耳片
  _addMountingLug(group, R, T, isAnode)

  // 内侧面细节 (照片 #76: O-ring 槽, 流场菱形网格, 竖向通道)
  _addPlateORing(group, T, isAnode)
  _addPlateFlowField(group, T, isAnode)
  _addPlateChannels(group, T, isAnode)

  group.position.z = zPos
  return group
}

/**
 * 8 个外圈孔, PCD=58mm (R=29), 45° 均匀分布.
 */
function _addPlateOuterHoles(parent, plateT) {
  const count   = 8
  const pcdR    = CELL_CONFIG.bolt.pcd / 2   // 29
  const hR      = CELL_CONFIG.bolt.diameter / 2
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x060808, metalness: 0.15, roughness: 0.90
  })
  const holeGeo = new THREE.CylinderGeometry(hR, hR, plateT * 1.06, 12)

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR
    const hole = new THREE.Mesh(holeGeo, holeMat)
    hole.rotation.x = Math.PI / 2
    hole.position.set(x, y, 0)
    parent.add(hole)
  }
}

/**
 * 10 个内圈孔, PCD=30mm (R=15), 均匀分布.
 */
function _addPlateInnerHoles(parent, plateT) {
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x060808, metalness: 0.15, roughness: 0.90
  })
  const holeGeo = new THREE.CylinderGeometry(1.8, 1.8, plateT * 1.06, 10)

  // 双环散布 ~18 孔 (匹配实物照片 #6/#7: 满盘穿孔)
  const rings = [
    { count: 6,  pcdR: 8,  offsetAngle: Math.PI / 6 },
    { count: 12, pcdR: 20, offsetAngle: 0 }
  ]
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + ring.offsetAngle
      const x = Math.cos(angle) * ring.pcdR
      const y = Math.sin(angle) * ring.pcdR
      const hole = new THREE.Mesh(holeGeo, holeMat)
      hole.rotation.x = Math.PI / 2
      hole.position.set(x, y, 0)
      parent.add(hole)
    }
  }
}

/**
 * 安装耳片: isAnode=true → +X 侧; false → -X 侧.
 * 尺寸: 14mm (Y宽) × 18mm (X伸出) × 2mm (Z厚)
 * 1 个 Ø6mm 固定孔 (居中).
 * 外端圆角: 半圆柱端盖 (半径=宽度/2), 模拟实物圆角冲压件.
 */
function _addMountingLug(parent, plateR, plateT, isAnode) {
  const lug = CELL_CONFIG.lug
  const mat = MaterialPresets.conductive()
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.3, roughness: 0.7 })
  const side = isAnode ? 1 : -1

  const lugMesh = new THREE.Mesh(
    new THREE.BoxGeometry(lug.length, lug.width, plateT), mat)
  lugMesh.position.set(side * (plateR + lug.length / 2 - 1), 0, 0)
  lugMesh.castShadow = true
  parent.add(lugMesh)

  const holeGeo = new THREE.CylinderGeometry(lug.holeRadius, lug.holeRadius, plateT * 1.3, 16)
  const hole = new THREE.Mesh(holeGeo, holeMat)
  hole.rotation.x = Math.PI / 2
  hole.position.set(side * (plateR + lug.length * 0.6), 0, 0)
  parent.add(hole)
}

// ─────────────────────────────────────────────────────────────────────────────
// 极板内侧面细节 (照片 #76)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _addPlateORing(parent, plateT, isAnode)
 *
 * 四叶花形 O-ring 槽内嵌黑色橡胶圈 — 与 POM 垫 _addCloverOring 相同路径,
 * 但控制点按 0.85 缩放 (略小), 管径 1.2mm.
 *
 * 放置在极板内侧面 (朝向 middleGasket 的那一面):
 *   阳极板 inner face Z = -plateT/2   (阳极在 +Z 侧, 内面朝 -Z)
 *   阴极板 inner face Z = +plateT/2   (阴极在 -Z 侧, 内面朝 +Z)
 */
function _addPlateORing(parent, plateT, isAnode) {
  const mat   = MaterialPresets.gasket()
  // 与 _addCloverOring 完全相同的控制点
  const pts = [
    new THREE.Vector3(0, 22, 0),
    new THREE.Vector3(3, 19, 0),
    new THREE.Vector3(4, 15, 0),
    new THREE.Vector3(6, 11, 0),
    new THREE.Vector3(7, 8, 0),
    new THREE.Vector3(11, 6, 0),
    new THREE.Vector3(15, 3, 0),
    new THREE.Vector3(17, 0, 0),
    new THREE.Vector3(15, -3, 0),
    new THREE.Vector3(11, -6, 0),
    new THREE.Vector3(7, -8, 0),
    new THREE.Vector3(6, -11, 0),
    new THREE.Vector3(4, -15, 0),
    new THREE.Vector3(3, -19, 0),
    new THREE.Vector3(0, -22, 0),
    new THREE.Vector3(-3, -19, 0),
    new THREE.Vector3(-4, -15, 0),
    new THREE.Vector3(-6, -11, 0),
    new THREE.Vector3(-7, -8, 0),
    new THREE.Vector3(-11, -6, 0),
    new THREE.Vector3(-15, -3, 0),
    new THREE.Vector3(-17, 0, 0),
    new THREE.Vector3(-15, 3, 0),
    new THREE.Vector3(-11, 6, 0),
    new THREE.Vector3(-7, 8, 0),
    new THREE.Vector3(-6, 11, 0),
    new THREE.Vector3(-4, 15, 0),
    new THREE.Vector3(-3, 19, 0),
  ]

  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.35)
  const geo   = new THREE.TubeGeometry(curve, 120, 1.5, 10, true)
  const ring  = new THREE.Mesh(geo, mat)

  ring.position.z = isAnode ? -(plateT / 2) : (plateT / 2)

  parent.add(ring)
}

/**
 * _addPlateFlowField(parent, plateT, isAnode)
 *
 * 菱形流场网格 — 中心区域 ~28×28mm (halfSize=14mm).
 * 交叉条带 +45° 和 -45°, 间距 2.5mm, 条宽 0.8mm, 高 0.5mm.
 *
 * 裁剪: 在本地 ±45° 坐标系中, 仅保留满足 |u|+|v| < halfSize 的条带段.
 * 实现方式: 按中心点在菱形内部 (旋转坐标系判断) 决定是否添加该段.
 *
 * 放置在极板内侧面: surfZ = isAnode ? -(plateT/2 - 0.1) : (plateT/2 - 0.1)
 */
function _addPlateFlowField(parent, plateT, isAnode) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xa8a0a0, metalness: 0.88, roughness: 0.40, envMapIntensity: 1.0
  })

  const halfSize    = 14    // 菱形半对角线 mm
  const spacing     = 2.5  // 条带间距 mm
  const stripW      = 0.8  // 条宽 mm
  const stripH      = 0.5  // 高出面 mm
  const surfZ       = isAnode ? -(plateT / 2 - 0.1) : (plateT / 2 - 0.1)

  // 生成 ±45° 两组条带
  // 对于 +45° 方向: 绕 Z 轴旋转 45°, 条带沿 X 方向
  // 对于 -45° 方向: 绕 Z 轴旋转 -45°, 条带沿 X 方向
  for (const sign of [1, -1]) {
    const rot = sign * Math.PI / 4   // ±45° in radians

    // 沿垂直于条带方向 (条带法线) 遍历: 范围 [-halfSize, halfSize]
    const startOff = -halfSize
    const endOff   = halfSize
    let offset = startOff

    while (offset <= endOff) {
      // 条带中心在旋转前坐标系: (localX 遍历全长, localY = offset)
      // 条带长度取菱形在该 offset 处的弦长
      // 菱形方程 (旋转后): |u| + |v| < halfSize
      // 当 |v| = |offset| 时, |u| < halfSize - |offset|
      const halfLen = halfSize - Math.abs(offset)
      if (halfLen > 0) {
        // BoxGeometry(length, width, height) — 条带沿 X 方向延伸
        const geo  = new THREE.BoxGeometry(halfLen * 2, stripW, stripH)
        const mesh = new THREE.Mesh(geo, mat)

        // 在旋转后坐标系中放置, 再旋转回来
        // 未旋转时: 条带中心 (0, offset, 0) 旋转 rot 后:
        const cx = -offset * Math.sin(rot)
        const cy =  offset * Math.cos(rot)
        mesh.position.set(cx, cy, surfZ)
        mesh.rotation.z = rot

        parent.add(mesh)
      }
      offset += spacing
    }
  }
}

/**
 * _addPlateChannels(parent, plateT, isAnode)
 *
 * 竖向通道脊线 — 菱形流场上方和下方各 5 根平行竖条.
 * 每根: 0.8mm 宽, 8mm 长, 高 0.5mm.
 * 5 根条带以 X=0 为中心, 间距 2mm.
 * Y 位置: 菱形边缘 ±halfSize 向外偏移 1mm 再加通道半长.
 */
function _addPlateChannels(parent, plateT, isAnode) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xa8a0a0, metalness: 0.88, roughness: 0.40, envMapIntensity: 1.0
  })

  const halfSize     = 14    // 菱形区域半径 mm (与流场一致)
  const channelCount = 5
  const channelW     = 0.8  // 宽 mm
  const channelL     = 8    // 长 mm
  const channelH     = 0.5  // 高 mm
  const channelSpac  = 2.0  // 中心间距 mm
  const surfZ        = isAnode ? -(plateT / 2 - 0.1) : (plateT / 2 - 0.1)

  // 5 根条带 X 坐标: 以 0 为中心, 间距 channelSpac
  const xs = []
  for (let i = 0; i < channelCount; i++) {
    xs.push((i - (channelCount - 1) / 2) * channelSpac)
  }

  const geo = new THREE.BoxGeometry(channelW, channelL, channelH)

  for (const sideSign of [1, -1]) {
    // 上方 (+Y) / 下方 (-Y): 菱形外边缘 + 1mm 间隙 + 通道半长
    const centerY = sideSign * (halfSize + 1 + channelL / 2)

    for (const cx of xs) {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(cx, centerY, surfZ)
      parent.add(mesh)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 螺柱 (×8)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _makeBolts(z)
 *
 * 8 根螺柱贯穿全高, 从底盖底面向 +Z 方向延伸, 顶端突出于顶盖上方.
 *
 * 定位原则:
 *   螺柱底端与 bottomCover 底面对齐:
 *     bottomFace = z.bottomCover - coverT/2
 *   螺柱中心 (rod.position.z) 相对于 group (group.position.z=0) 的偏移:
 *     rodCenterZ = bottomFace + rodLen/2
 *               = (z.bottomCover - coverT/2) + rodLen/2
 *
 * 这样螺柱底端 = bottomCover 底面, 顶端突出于 topCover 上方供螺母/垫圈使用.
 *
 * 示例数值 (mm): bottomCover=-17.5, coverT=15
 *   bottomFace = -17.5 - 7.5 = -25
 *   rodLen     = cellCoreThickness(50) + protrude(15) = 65
 *   rodCenterZ = -25 + 32.5 = +7.5  (螺柱顶端 = -25+65 = +40, 远超顶盖 +25 → 突出 15mm)
 */
function _makeBolts(z) {
  const c    = CELL_CONFIG
  const bCfg = c.bolt
  const pcdR = bCfg.pcd / 2   // 29

  const group = new THREE.Group()
  group.name = 'bolts'
  group.userData.layer = 'bolts'

  const coverT   = c.cover.thickness  // 15
  const protrude = 15
  const rodLen   = cellCoreThickness() + protrude

  const bottomFace  = z.bottomCover - coverT / 2
  const rodCenterZ  = bottomFace + rodLen / 2

  // 双色螺柱: 黑色氧化轴身 + 银色螺纹段 (匹配实物照片 #8)
  const shaftMat = MaterialPresets.boltShaft()
  const shaftGeo = new THREE.CylinderGeometry(
    bCfg.diameter / 2, bCfg.diameter / 2, rodLen, 14)

  const threadLen = protrude + 3
  const threadMat = MaterialPresets.bolt()
  const threadGeo = new THREE.CylinderGeometry(
    bCfg.diameter / 2 + 0.15, bCfg.diameter / 2 + 0.15, threadLen, 14)
  const topFace = z.topCover + coverT / 2
  const threadCenterZ = topFace - 2 + threadLen / 2

  for (let i = 0; i < bCfg.count; i++) {
    const angle = (i / bCfg.count) * Math.PI * 2
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR

    const shaft = new THREE.Mesh(shaftGeo, shaftMat)
    shaft.rotation.x = Math.PI / 2
    shaft.position.set(x, y, rodCenterZ)
    shaft.castShadow = true
    group.add(shaft)

    const thread = new THREE.Mesh(threadGeo, threadMat)
    thread.rotation.x = Math.PI / 2
    thread.position.set(x, y, threadCenterZ)
    group.add(thread)
  }

  group.position.z = z.bolts
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 六角螺母 (×8)
// ─────────────────────────────────────────────────────────────────────────────

function _makeNuts(z) {
  const c    = CELL_CONFIG
  const bCfg = c.bolt
  const pcdR = bCfg.pcd / 2

  const group = new THREE.Group()
  group.name = 'nuts'
  group.userData.layer = 'nuts'

  const nutMat = MaterialPresets.nut()

  // 六角螺母: Shape (六边形外轮廓 + 圆形中心孔) → ExtrudeGeometry
  const circumR = (bCfg.nutAF / 2) / Math.cos(Math.PI / 6)
  const holeR   = bCfg.diameter / 2   // 螺栓直径即螺纹孔径
  const hexShape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const hx = Math.cos(a) * circumR
    const hy = Math.sin(a) * circumR
    if (i === 0) hexShape.moveTo(hx, hy)
    else hexShape.lineTo(hx, hy)
  }
  hexShape.closePath()
  const holePath = new THREE.Path()
  holePath.absarc(0, 0, holeR, 0, Math.PI * 2, false)
  hexShape.holes.push(holePath)
  const nutGeo = new THREE.ExtrudeGeometry(hexShape, {
    depth: bCfg.nutHeight, bevelEnabled: false
  })
  nutGeo.translate(0, 0, -bCfg.nutHeight / 2)   // 居中

  for (let i = 0; i < bCfg.count; i++) {
    const angle = (i / bCfg.count) * Math.PI * 2
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR
    const nut = new THREE.Mesh(nutGeo, nutMat)
    nut.position.set(x, y, 0)
    nut.castShadow = true
    group.add(nut)
  }

  group.position.z = z.nuts
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 平垫圈 (×8)
// ─────────────────────────────────────────────────────────────────────────────

function _makeFlatWashers(z) {
  const c    = CELL_CONFIG
  const bCfg = c.bolt
  const wCfg = c.washer
  const pcdR = bCfg.pcd / 2

  const group = new THREE.Group()
  group.name = 'flatWashers'
  group.userData.layer = 'flatWashers'

  const mat     = MaterialPresets.bolt()
  const wasGeo  = new THREE.CylinderGeometry(
    wCfg.od / 2, wCfg.od / 2, wCfg.thickness, 20)
  const holeGeo = new THREE.CylinderGeometry(
    wCfg.id / 2, wCfg.id / 2, wCfg.thickness * 1.1, 14)
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x050505, metalness: 0.1, roughness: 0.9
  })

  for (let i = 0; i < bCfg.count; i++) {
    const angle = (i / bCfg.count) * Math.PI * 2
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR

    const washer = new THREE.Mesh(wasGeo, mat)
    washer.rotation.x = Math.PI / 2
    washer.position.set(x, y, 0)
    group.add(washer)

    const bore = new THREE.Mesh(holeGeo, holeMat)
    bore.rotation.x = Math.PI / 2
    bore.position.set(x, y, 0)
    group.add(bore)
  }

  group.position.z = z.flatWashers
  return group
}
