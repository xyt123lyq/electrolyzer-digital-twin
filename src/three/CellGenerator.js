import * as THREE from 'three'
import { MaterialPresets } from './Materials.js'

/**
 * 电解槽完整结构 (从上到下):
 *
 * 1. 粉色端盖板 (topCover) - 圆角方形
 * 2. 白色5cm厚垫片 (upperGasket) - 正反面都有垫圈纹路(交叉线)
 * 3. 银色阳极板 (anodePlate)
 *    - 背面(下): 垫圈纹路 + 黑色垫圈 + 方形凹槽(有流道)
 * 4. 薄白色垫片 (thinWhite1) - 双面交叉线纹路 + 方窗 + 方形O-ring
 * 5. 薄白色垫片 (thinWhite2) - 双面交叉线纹路 + 方窗内含MEA + 方形O-ring
 * 6. 银色阴极板 (cathodePlate)
 *    - 正面(上): 垫圈纹路 + 黑色垫圈 + 方形凹槽(有流道) + 两片拉伸网
 * 7. 白色5cm厚垫片 (lowerGasket) - 背面(下)有纹路 + 黑色垫圈
 * 8. 底板 (bottomCover) - 圆角方形
 */
export const CELL_CONFIG = {
  diameter:      80,
  innerDiameter: 76,

  cover: {
    thickness: 15,
    segments:  48
  },
  gasket: {
    thickness: 5,
    segments: 40
  },
  plate: {
    thickness: 3,
    segments: 40
  },
  thinWhite: {
    thickness: 1.0,
    segments: 40
  },
  blackGasket: {
    thickness: 1.0,
    width: 50,
    height: 40
  },
  mea: {
    size: 25,
    thickness: 0.3
  },
  mesh: {
    size: 30,
    thickness: 0.3,
    diamondSize: 3  // 菱形对角线尺寸(加密)
  },
  bolt: {
    count: 8,
    pcd: 58,
    diameter: 4,
    length: 80,
    nutHeight: 4,
    nutAF: 7
  },
  washer: {
    od: 8,
    id: 4.5,
    thickness: 1.5
  },
  lug: {
    width: 10,
    length: 12,
    thickness: 2,
    holeRadius: 2.5
  },
  flowChannel: {
    grooveWidth: 1.0,
    grooveDepth: 0.3,
    recessSize: 26
  },

  get width()  { return this.diameter },
  get height() { return this.diameter }
}

// ─────────────────────────────────────────────────────────────────────────────
// Z位置计算（从中心对称向外）
// ─────────────────────────────────────────────────────────────────────────────
function _layerZ(c) {
  const gT  = c.gasket.thickness     // 5
  const pT  = c.plate.thickness      // 3
  const cvT = c.cover.thickness      // 15
  const wT  = c.washer.thickness     // 1.5
  const nH  = c.bolt.nutHeight       // 4
  const twT = c.thinWhite.thickness  // 1.0
  const meaT = c.mea.thickness       // 0.3

  // 极板：间距 gT，两板之间是膜/网
  const anodePlate   = +(gT / 2 + pT / 2)   // +4.0, span +2.5 to +5.5
  const cathodePlate = -(gT / 2 + pT / 2)   // -4.0, span -5.5 to -2.5

  // 阳极侧内层（从阳极板顶面向外堆叠）
  const anodeTop = anodePlate + pT / 2       // +5.5
  const thinWhite1 = anodeTop + twT / 2      // +6.0, span +5.5 to +6.5
  const thinWhite2 = thinWhite1 + twT / 2 + twT / 2  // +7.0, span +6.5 to +7.5
  const tw2Top = thinWhite2 + twT / 2        // +7.5
  const mea3  = tw2Top + 0.2 + meaT / 2     // +7.85, span +7.7 to +8.0
  const mea4  = mea3 + meaT / 2 + meaT / 2  // +8.15, span +8.0 to +8.3
  const mesh1 = mea4 + meaT / 2 + 0.15      // +8.45, span ~+8.3 to +8.6
  const mesh1Top = mesh1 + 0.15             // +8.6

  // 厚垫片：底面贴合最外层内层的顶面
  const upperGasket = mesh1Top + gT / 2      // +11.1, span +8.6 to +13.6
  const topCover    = upperGasket + gT / 2 + cvT / 2  // +21.1, span +13.6 to +28.6

  // 阴极侧厚垫片：顶面贴合阴极板底面
  const cathodeBottom = cathodePlate - pT / 2  // -5.5
  const lowerGasket  = cathodeBottom - gT / 2  // -8.0, span -10.5 to -5.5
  const bottomCover  = lowerGasket - gT / 2 - cvT / 2  // -18.0, span -25.5 to -10.5

  // 螺栓
  const flatWashers = topCover + cvT / 2 + wT / 2
  const nuts = flatWashers + wT / 2 + nH / 2
  const bolts = 0

  return {
    bolts, nuts, flatWashers,
    topCover, upperGasket, anodePlate,
    thinWhite1, thinWhite2,
    mesh1, mea3, mea4,
    cathodePlate, lowerGasket, bottomCover
  }
}

export function cellCoreThickness() {
  // 螺栓杆跨度：从底盖底面到顶盖顶面
  // topCover upper face = 21.1 + 7.5 = 28.6
  // bottomCover lower face = -18.0 - 7.5 = -25.5
  // span = 54.1
  return 54.1
}

export function buildCell(index = 0) {
  const c = CELL_CONFIG
  const z = _layerZ(c)

  const topCover     = _makePinkCover('topCover', true, z.topCover)
  const upperGasket  = _makeWhiteGasketWithPattern('upperGasket', z.upperGasket)
  const anodePlate   = _makeAnodePlate('anodePlate', z.anodePlate)
  const thinWhite1   = _makeThinWhite('thinWhite1', z.thinWhite1)
  const thinWhite2   = _makeThinWhite('thinWhite2', z.thinWhite2)
  const mesh1        = _makeExpandedMesh('mesh1', z.mesh1)
  const mea3         = _makeMEA('mea3', z.mea3, 'mea3')
  const mea4         = _makeMEA('mea4', z.mea4, 'mea4')
  const cathodePlate = _makeCathodePlate('cathodePlate', z.cathodePlate)
  const lowerGasket  = _makeWhiteGasketWithPatternBottom('lowerGasket', z.lowerGasket)
  const bottomCover  = _makePinkCover('bottomCover', false, z.bottomCover)
  const flatWashers  = _makeFlatWashers(z)
  const nuts         = _makeNuts(z)
  const bolts        = _makeBolts(z)

  const group = new THREE.Group()
  group.name = `Cell_${index + 1}`
  group.userData.cellIndex = index
  group.userData.state = 'closed'

  group.add(
    topCover, upperGasket, anodePlate,
    thinWhite1, thinWhite2,
    mesh1, mea3, mea4,
    cathodePlate, lowerGasket, bottomCover,
    flatWashers, nuts, bolts
  )

  const layers = {
    bolts, nuts, flatWashers,
    topCover, upperGasket, anodePlate,
    thinWhite1, thinWhite2,
    mesh1, mea3, mea4,
    cathodePlate, lowerGasket, bottomCover
  }

  group.userData.layers = layers

  group.userData.originalPositions = {}
  for (const key of Object.keys(layers)) {
    if (key === 'bolts' || key === 'nuts' || key === 'flatWashers') continue
    group.userData.originalPositions[key] = layers[key].position.z
  }
  group.userData.originalPositions.bolts = z.bolts
  group.userData.originalPositions.nuts = z.nuts
  group.userData.originalPositions.flatWashers = z.flatWashers

  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 圆角方形 (Squircle) 形状生成
// ─────────────────────────────────────────────────────────────────────────────
function _makeSquircleShape(flatR, cornerR) {
  const shape = new THREE.Shape()
  const r = Math.min(cornerR, flatR)
  shape.moveTo(-flatR + r, flatR)
  shape.lineTo(flatR - r, flatR)
  shape.quadraticCurveTo(flatR, flatR, flatR, flatR - r)
  shape.lineTo(flatR, -flatR + r)
  shape.quadraticCurveTo(flatR, -flatR, flatR - r, -flatR)
  shape.lineTo(-flatR + r, -flatR)
  shape.quadraticCurveTo(-flatR, -flatR, -flatR, -flatR + r)
  shape.lineTo(-flatR, flatR - r)
  shape.quadraticCurveTo(-flatR, flatR, -flatR + r, flatR)
  shape.closePath()
  return shape
}

// ─────────────────────────────────────────────────────────────────────────────
// 粉色端盖板（圆角方形）
// ─────────────────────────────────────────────────────────────────────────────
function _makePinkCover(name, isTop, zPos) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2
  const cornerR = 5
  const T = c.cover.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.endplate()

  const shape = _makeSquircleShape(flatR, cornerR)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: T,
    bevelEnabled: false
  })
  geo.translate(0, 0, -T / 2)

  const body = new THREE.Mesh(geo, mat)
  body.castShadow = true
  group.add(body)

  _addBoltHoles(group, T, 8)

  if (isTop) {
    _addGasPorts(group, T / 2)
  }

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 白色5cm厚垫片（双面纹路）
// ─────────────────────────────────────────────────────────────────────────────
function _makeWhiteGasketWithPattern(name, zPos) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2
  const cornerR = 5
  const T = c.gasket.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  const shape = _makeSquircleShape(flatR, cornerR)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  geo.translate(0, 0, -T / 2)
  const body = new THREE.Mesh(geo, mat)
  body.castShadow = true
  group.add(body)

  _addGasketPattern(group, T / 2, true)
  _addGasketPattern(group, -T / 2, false)

  _addBoltHoles(group, T, 8)
  _addCloverOring(group, T)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 白色5cm厚垫片（背面有纹路+黑色垫圈）
// ─────────────────────────────────────────────────────────────────────────────
function _makeWhiteGasketWithPatternBottom(name, zPos) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2
  const cornerR = 5
  const T = c.gasket.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  const shape = _makeSquircleShape(flatR, cornerR)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  geo.translate(0, 0, -T / 2)
  const body = new THREE.Mesh(geo, mat)
  body.castShadow = true
  group.add(body)

  _addGasketPattern(group, -T / 2, true)
  _addBlackGasketOnPattern(group, -T / 2)

  _addBoltHoles(group, T, 8)
  _addCloverOring(group, T)

  group.position.z = zPos
  return group
}

function _addBlackGasketOnPattern(parent, zPos) {
  const c = CELL_CONFIG
  const bgT = c.blackGasket.thickness

  const mat = MaterialPresets.gasket()

  const rx = c.blackGasket.width / 2
  const ry = c.blackGasket.height / 2
  const radius = 5

  const shape = new THREE.Shape()
  shape.moveTo(-rx + radius, -ry)
  shape.lineTo(rx - radius, -ry)
  shape.quadraticCurveTo(rx, -ry, rx, -ry + radius)
  shape.lineTo(rx, ry - radius)
  shape.quadraticCurveTo(rx, ry, rx - radius, ry)
  shape.lineTo(-rx + radius, ry)
  shape.quadraticCurveTo(-rx, ry, -rx, ry - radius)
  shape.lineTo(-rx, -ry + radius)
  shape.quadraticCurveTo(-rx, -ry, -rx + radius, -ry)

  const holeW = 30
  const holeH = 22
  const holeRadius = 3
  const hole = new THREE.Path()
  hole.moveTo(-holeW / 2 + holeRadius, -holeH / 2)
  hole.lineTo(holeW / 2 - holeRadius, -holeH / 2)
  hole.quadraticCurveTo(holeW / 2, -holeH / 2, holeW / 2, -holeH / 2 + holeRadius)
  hole.lineTo(holeW / 2, holeH / 2 - holeRadius)
  hole.quadraticCurveTo(holeW / 2, holeH / 2, holeW / 2 - holeRadius, holeH / 2)
  hole.lineTo(-holeW / 2 + holeRadius, holeH / 2)
  hole.quadraticCurveTo(-holeW / 2, holeH / 2, -holeW / 2, holeH / 2 - holeRadius)
  hole.lineTo(-holeW / 2, -holeH / 2 + holeRadius)
  hole.quadraticCurveTo(-holeW / 2, -holeH / 2, -holeW / 2 + holeRadius, -holeH / 2)
  shape.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(shape, { depth: bgT, bevelEnabled: false })
  geo.translate(0, 0, -bgT / 2)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = zPos - bgT / 2
  parent.add(mesh)
}

// ─────────────────────────────────────────────────────────────────────────────
// 阳极板
// ─────────────────────────────────────────────────────────────────────────────
function _makeAnodePlate(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.plate.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.conductive()

  // 圆形极板（实物照片确认为圆形）
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, c.plate.segments), mat)
  disc.rotation.x = Math.PI / 2
  disc.castShadow = true
  group.add(disc)

  // 背面(下)垫圈纹路
  _addGasketPattern(group, -T / 2, true)

  // 背面黑色垫圈
  _addPlateBlackGasket(group, -T / 2)

  // 背面方形凹槽+流道
  _addFlowChannelGroove(group, -T / 2)

  _addPlateBoltHoles(group, T)
  _addMountingLug(group, R, T, true)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 阴极板（正面有纹路+流道+拉伸网）
// ─────────────────────────────────────────────────────────────────────────────
function _makeCathodePlate(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.plate.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.conductive()

  // 圆形极板（实物照片确认为圆形）
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, c.plate.segments), mat)
  disc.rotation.x = Math.PI / 2
  disc.castShadow = true
  group.add(disc)

  // 正面(上)垫圈纹路
  _addGasketPattern(group, +T / 2, true)

  // 正面黑色垫圈
  _addPlateBlackGasket(group, +T / 2)

  // 正面方形凹槽+流道
  _addFlowChannelGroove(group, +T / 2)

  // 两片拉伸网 - 在阴极板正面（流道上方）
  const meshGroup = _makeDoubleMeshStack()
  meshGroup.position.z = +T / 2 + 0.5
  group.add(meshGroup)

  _addPlateBoltHoles(group, T)
  _addMountingLug(group, R, T, false)

  group.position.z = zPos
  return group
}

function _makeDoubleMeshStack() {
  const c = CELL_CONFIG
  const group = new THREE.Group()
  group.name = 'meshStack'

  const meshMat = MaterialPresets.gdl()
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x505050,
    metalness: 0.85,
    roughness: 0.35,
    side: THREE.DoubleSide
  })

  const size = c.mesh.size
  const diamondSize = c.mesh.diamondSize || 3
  const halfD = diamondSize / 2

  for (let meshIdx = 0; meshIdx < 2; meshIdx++) {
    const zOffset = meshIdx === 0 ? c.mesh.thickness / 2 : -c.mesh.thickness / 2

    for (let row = -size / 2; row <= size / 2; row += diamondSize) {
      for (let col = -size / 2; col <= size / 2; col += diamondSize) {
        const cx = col
        const cy = row

        const points = [
          new THREE.Vector3(cx - halfD, cy, 0),
          new THREE.Vector3(cx, cy + halfD, 0),
          new THREE.Vector3(cx + halfD, cy, 0),
          new THREE.Vector3(cx, cy - halfD, 0),
        ]

        for (let i = 0; i < 4; i++) {
          const p1 = points[i]
          const p2 = points[(i + 1) % 4]
          const lineGeo = new THREE.BoxGeometry(
            Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)),
            0.4,
            c.mesh.thickness + 0.1
          )
          const line = new THREE.Mesh(lineGeo, lineMat)

          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2
          line.position.set(midX, midY, zOffset)

          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
          line.rotation.z = angle

          group.add(line)
        }
      }
    }
  }

  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 薄白色垫片（交叉线纹路 + 方窗 + 方形O-ring）
// hasMEA: true = 方窗内含MEA
// ─────────────────────────────────────────────────────────────────────────────
function _makeThinWhite(name, zPos) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2
  const cornerR = 5
  const T = c.thinWhite.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.thinGasket()

  // 带方窗的圆角方形垫片
  const shape = _makeSquircleShape(flatR, cornerR)

  const windowSize = c.mea.size + 6
  const window = new THREE.Path()
  window.moveTo(-windowSize, -windowSize)
  window.lineTo(windowSize, -windowSize)
  window.lineTo(windowSize, windowSize)
  window.lineTo(-windowSize, windowSize)
  window.closePath()
  shape.holes.push(window)

  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  geo.translate(0, 0, -T / 2)
  const disc = new THREE.Mesh(geo, mat)
  group.add(disc)

  // MEA由buildCell创建为独立层（mea3/mea4），不嵌入thinWhite2
  // 这样爆炸动画可以独立移动MEA

  // 双面交叉线纹路
  _addCrosshatchTexture(group, T / 2, true)
  _addCrosshatchTexture(group, -T / 2, false)

  // 方形O-ring围绕方窗
  _addSquareOring(group, windowSize, T)

  _addBoltHoles(group, T, 8)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 薄垫片交叉线纹路（细微CNC加工痕迹）
// ─────────────────────────────────────────────────────────────────────────────
function _addCrosshatchTexture(parent, surfZ, front) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2 - 3
  const cornerR = 5
  const spacing = 2.5
  const lineW = 0.25
  const lineH = 0.35
  const zOff = front ? -lineH / 2 : lineH / 2

  const mat = new THREE.MeshStandardMaterial({
    color: 0xB8B4A8,
    metalness: 0.1,
    roughness: 0.5
  })

  // 水平方向平行线，裁剪到圆角方形边界
  for (let y = -flatR; y <= flatR; y += spacing) {
    const xExt = _squircleXExtent(flatR, cornerR, y)
    if (xExt < 2) continue
    const lineGeo = new THREE.BoxGeometry(xExt * 2, lineW, lineH)
    const line = new THREE.Mesh(lineGeo, mat)
    line.position.set(0, y, surfZ + zOff)
    parent.add(line)
  }

  // 垂直方向平行线（真交叉纹路）
  for (let x = -flatR; x <= flatR; x += spacing) {
    const yExt = _squircleXExtent(flatR, cornerR, x)
    if (yExt < 2) continue
    const lineGeo = new THREE.BoxGeometry(lineW, yExt * 2, lineH)
    const line = new THREE.Mesh(lineGeo, mat)
    line.position.set(x, 0, surfZ + zOff)
    parent.add(line)
  }
}

// 计算圆角方形在给定y值处的x范围
function _squircleXExtent(flatR, cornerR, y) {
  const ay = Math.abs(y)
  const r = Math.min(cornerR, flatR)
  if (ay <= flatR - r) return flatR
  if (ay >= flatR) return 0
  return flatR - r + Math.sqrt(Math.max(0, r * r - (ay - flatR + r) * (ay - flatR + r)))
}

// ─────────────────────────────────────────────────────────────────────────────
// 方形O-ring（围绕方窗的矩形框架）
// ─────────────────────────────────────────────────────────────────────────────
function _addSquareOring(parent, windowSize, gasketT) {
  const mat = MaterialPresets.oRing()
  const padding = 3
  const oringW = 2.5
  const oringH = 2.0
  const half = windowSize + padding

  // 外框
  const outer = new THREE.Shape()
  outer.moveTo(-half, -half)
  outer.lineTo(half, -half)
  outer.lineTo(half, half)
  outer.lineTo(-half, half)
  outer.closePath()

  // 内框
  const inner = half - oringW
  const hole = new THREE.Path()
  hole.moveTo(-inner, -inner)
  hole.lineTo(inner, -inner)
  hole.lineTo(inner, inner)
  hole.lineTo(-inner, inner)
  hole.closePath()
  outer.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(outer, { depth: oringH, bevelEnabled: false })
  geo.translate(0, 0, -oringH / 2)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = gasketT / 2 + oringH / 2
  parent.add(mesh)
}

// ─────────────────────────────────────────────────────────────────────────────
// 厚垫片纹路（细微CNC加工痕迹，单方向平行线）
// ─────────────────────────────────────────────────────────────────────────────
function _addGasketPattern(parent, surfZ, front) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2 - 3
  const cornerR = 5
  const spacing = 2.5
  const lineW = 0.25
  const lineH = 0.35
  const zOff = front ? -lineH / 2 : lineH / 2

  const mat = new THREE.MeshStandardMaterial({
    color: 0xB0ACA0,
    metalness: 0.1,
    roughness: 0.5
  })

  // 水平方向平行线，裁剪到圆角方形边界
  for (let y = -flatR; y <= flatR; y += spacing) {
    const xExt = _squircleXExtent(flatR, cornerR, y)
    if (xExt < 2) continue
    const lineGeo = new THREE.BoxGeometry(xExt * 2, lineW, lineH)
    const line = new THREE.Mesh(lineGeo, mat)
    line.position.set(0, y, surfZ + zOff)
    parent.add(line)
  }

  // 垂直方向平行线（真交叉纹路）
  for (let x = -flatR; x <= flatR; x += spacing) {
    const yExt = _squircleXExtent(flatR, cornerR, x)
    if (yExt < 2) continue
    const lineGeo = new THREE.BoxGeometry(lineW, yExt * 2, lineH)
    const line = new THREE.Mesh(lineGeo, mat)
    line.position.set(x, 0, surfZ + zOff)
    parent.add(line)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 流道凹槽
// ─────────────────────────────────────────────────────────────────────────────
function _addFlowChannelGroove(parent, surfZ) {
  const c = CELL_CONFIG
  const grooveDepth = 0.3
  const grooveSize = c.flowChannel.recessSize
  const channelW = c.flowChannel.grooveWidth

  const borderMat = new THREE.MeshStandardMaterial({
    color: 0x808080,
    metalness: 0.85,
    roughness: 0.3
  })

  const borderH = 0.5
  const borders = [
    { w: grooveSize + 2, h: 1.5, x: 0, y: grooveSize / 2 + 1 },
    { w: grooveSize + 2, h: 1.5, x: 0, y: -grooveSize / 2 - 1 },
    { w: 1.5, h: grooveSize + 2, x: -grooveSize / 2 - 1, y: 0 },
    { w: 1.5, h: grooveSize + 2, x: grooveSize / 2 + 1, y: 0 },
  ]

  for (const b of borders) {
    const geo = new THREE.BoxGeometry(b.w, b.h, grooveDepth + borderH)
    const mesh = new THREE.Mesh(geo, borderMat)
    mesh.position.set(b.x, b.y, surfZ + grooveDepth / 2 + borderH / 2)
    parent.add(mesh)
  }

  const channelMat = new THREE.MeshStandardMaterial({
    color: 0x303030,
    metalness: 0.7,
    roughness: 0.4
  })

  const numRows = 6
  const rowSpacing = grooveSize / (numRows + 1)

  for (let row = 0; row < numRows; row++) {
    const y = -grooveSize / 2 + rowSpacing * (row + 1)
    const goingRight = row % 2 === 0

    const segLen = grooveSize - rowSpacing
    const segGeo = new THREE.BoxGeometry(segLen, channelW, grooveDepth)
    const seg = new THREE.Mesh(segGeo, channelMat)
    seg.position.set(goingRight ? 0 : 0, y, surfZ + grooveDepth / 2)
    parent.add(seg)

    if (row < numRows - 1) {
      const turnX = goingRight ? grooveSize / 2 - rowSpacing / 2 : -grooveSize / 2 + rowSpacing / 2
      const turnGeo = new THREE.BoxGeometry(channelW, rowSpacing, grooveDepth)
      const turn = new THREE.Mesh(turnGeo, channelMat)
      turn.position.set(turnX, y + rowSpacing / 2, surfZ + grooveDepth / 2)
      parent.add(turn)
    }
  }

  const portMat = new THREE.MeshStandardMaterial({
    color: 0x202020,
    metalness: 0.5,
    roughness: 0.5
  })

  const portGeo = new THREE.CylinderGeometry(1.5, 1.5, grooveDepth, 12)
  const port1 = new THREE.Mesh(portGeo, portMat)
  port1.rotation.x = Math.PI / 2
  port1.position.set(0, grooveSize / 2 + 3, surfZ + grooveDepth / 2)
  parent.add(port1)

  const port2 = new THREE.Mesh(portGeo, portMat)
  port2.rotation.x = Math.PI / 2
  port2.position.set(0, -grooveSize / 2 - 3, surfZ + grooveDepth / 2)
  parent.add(port2)
}

// ─────────────────────────────────────────────────────────────────────────────
// 极板上的黑色垫圈
// ─────────────────────────────────────────────────────────────────────────────
function _addPlateBlackGasket(parent, surfZ) {
  const c = CELL_CONFIG
  const bgT = c.blackGasket.thickness

  const mat = MaterialPresets.gasket()

  const rx = c.blackGasket.width / 2
  const ry = c.blackGasket.height / 2
  const radius = 5

  const shape = new THREE.Shape()
  shape.moveTo(-rx + radius, -ry)
  shape.lineTo(rx - radius, -ry)
  shape.quadraticCurveTo(rx, -ry, rx, -ry + radius)
  shape.lineTo(rx, ry - radius)
  shape.quadraticCurveTo(rx, ry, rx - radius, ry)
  shape.lineTo(-rx + radius, ry)
  shape.quadraticCurveTo(-rx, ry, -rx, ry - radius)
  shape.lineTo(-rx, -ry + radius)
  shape.quadraticCurveTo(-rx, -ry, -rx + radius, -ry)

  const holeR = 15
  const hole = new THREE.Path()
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const x = Math.cos(a) * holeR
    const y = Math.sin(a) * holeR
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  shape.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(shape, { depth: bgT, bevelEnabled: false })
  geo.translate(0, 0, -bgT / 2)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = surfZ + bgT / 2
  parent.add(mesh)
}

// ─────────────────────────────────────────────────────────────────────────────
// 质子膜
// ─────────────────────────────────────────────────────────────────────────────
function _makeMEA(name, zPos, id) {
  const c = CELL_CONFIG
  const size = c.mea.size
  const T = c.mea.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.membrane()

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, T), mat)
  group.add(mesh)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 拉伸网 - 菱形膨胀金属网
// ─────────────────────────────────────────────────────────────────────────────
function _makeExpandedMesh(name, zPos) {
  const c = CELL_CONFIG
  const size = c.mesh.size
  const T = c.mesh.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.gdl()

  const diamondSize = c.mesh.diamondSize || 3
  const halfD = diamondSize / 2

  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x505050,
    metalness: 0.85,
    roughness: 0.35,
    side: THREE.DoubleSide
  })

  for (let row = -size / 2; row <= size / 2; row += diamondSize) {
    for (let col = -size / 2; col <= size / 2; col += diamondSize) {
      const cx = col
      const cy = row

      const points = [
        new THREE.Vector3(cx - halfD, cy, 0),
        new THREE.Vector3(cx, cy + halfD, 0),
        new THREE.Vector3(cx + halfD, cy, 0),
        new THREE.Vector3(cx, cy - halfD, 0),
      ]

      for (let i = 0; i < 4; i++) {
        const p1 = points[i]
        const p2 = points[(i + 1) % 4]
        const lineGeo = new THREE.BoxGeometry(
          Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)),
          0.4,
          T + 0.1
        )
        const line = new THREE.Mesh(lineGeo, lineMat)

        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        line.position.set(midX, midY, 0)

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
        line.rotation.z = angle

        group.add(line)
      }
    }
  }

  // 斜向交叉线条
  const diagMat = new THREE.MeshStandardMaterial({
    color: 0x404040,
    metalness: 0.9,
    roughness: 0.3,
    side: THREE.DoubleSide
  })

  for (let i = -size; i <= size; i += diamondSize * 1.5) {
    const diagGeo = new THREE.BoxGeometry(Math.sqrt(2) * diamondSize * 0.5, 0.35, T + 0.1)
    const diag1 = new THREE.Mesh(diagGeo, diagMat)
    diag1.position.set(i + diamondSize * 0.3, 0, 0)
    diag1.rotation.z = Math.PI / 4
    group.add(diag1)

    const diag2 = new THREE.Mesh(diagGeo.clone(), diagMat)
    diag2.position.set(i - diamondSize * 0.3, 0, 0)
    diag2.rotation.z = -Math.PI / 4
    group.add(diag2)
  }

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 四叶形O-ring
// ─────────────────────────────────────────────────────────────────────────────
function _addCloverOring(parent, gasketT) {
  const mat = MaterialPresets.oRing()
  const tubeR = 2.0
  const outerR = 26

  const outer = new THREE.Shape()
  const pts = [
    [0, outerR], [4, outerR - 4], [8, outerR - 8],
    [outerR - 8, 8], [outerR - 4, 4], [outerR, 0],
    [outerR - 4, -4], [outerR - 8, -8],
    [8, -outerR + 8], [4, -outerR + 4], [0, -outerR],
    [-4, -outerR + 4], [-8, -outerR + 8],
    [-outerR + 8, -8], [-outerR + 4, -4], [-outerR, 0],
    [-outerR + 4, 4], [-outerR + 8, 8], [-4, outerR - 4],
  ]

  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    if (i === 0) outer.moveTo(x, y)
    else outer.lineTo(x, y)
  }
  outer.closePath()

  const hole = new THREE.Path()
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const x = Math.cos(a) * (outerR - tubeR * 2)
    const y = Math.sin(a) * (outerR - tubeR * 2)
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  outer.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(outer, { depth: 2.5, bevelEnabled: false })
  geo.translate(0, 0, -1.25)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = gasketT / 2
  parent.add(mesh)
}

// ─────────────────────────────────────────────────────────────────────────────
// 螺栓通孔
// ─────────────────────────────────────────────────────────────────────────────
function _addBoltHoles(parent, thickness, count) {
  const c = CELL_CONFIG
  const pcdR = c.bolt.pcd / 2
  const hR = c.bolt.diameter / 2

  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x101010, metalness: 0.1, roughness: 0.9
  })
  const holeGeo = new THREE.CylinderGeometry(hR, hR, thickness * 1.1, 12)

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

// ─────────────────────────────────────────────────────────────────────────────
// 极板螺栓孔
// ─────────────────────────────────────────────────────────────────────────────
function _addPlateBoltHoles(parent, plateT) {
  const c = CELL_CONFIG
  const pcdR = c.bolt.pcd / 2
  const hR = c.bolt.diameter / 2

  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x101010, metalness: 0.1, roughness: 0.9
  })
  const holeGeo = new THREE.CylinderGeometry(hR, hR, plateT * 1.1, 12)

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR
    const hole = new THREE.Mesh(holeGeo, holeMat)
    hole.rotation.x = Math.PI / 2
    hole.position.set(x, y, 0)
    parent.add(hole)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 耳片
// ─────────────────────────────────────────────────────────────────────────────
function _addMountingLug(parent, plateR, plateT, isAnode) {
  const c = CELL_CONFIG
  const mat = MaterialPresets.conductive()
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.3, roughness: 0.7 })

  const lugW = c.lug.width
  const lugL = c.lug.length
  const lugMesh = new THREE.Mesh(
    new THREE.BoxGeometry(lugW, lugL, plateT), mat)
  lugMesh.position.set(0, -(plateR + lugL / 2 - 1), 0)
  lugMesh.castShadow = true
  parent.add(lugMesh)

  const holeGeo = new THREE.CylinderGeometry(2.5, 2.5, plateT * 1.3, 16)
  const hole = new THREE.Mesh(holeGeo, holeMat)
  hole.rotation.x = Math.PI / 2
  hole.position.set(0, -(plateR + lugL * 0.55), 0)
  parent.add(hole)
}

// ─────────────────────────────────────────────────────────────────────────────
// 气液接头
// ─────────────────────────────────────────────────────────────────────────────
function _addGasPorts(parent, portFaceZ) {
  const mat = MaterialPresets.gasPort()
  const boreMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.1, roughness: 0.9 })

  // 2个气液接头：对角线位置，带凸台和颜色区分
  const layout = [
    { x: -12, y: 12, hexR: 5.5, bodyR: 3.5, bodyH: 10, capColor: 0xdd5566 },  // 粉红色
    { x: 12, y: -12, hexR: 5.5, bodyR: 3.5, bodyH: 10, capColor: 0x4477bb },  // 蓝色
  ]

  for (const p of layout) {
    const sub = new THREE.Group()
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(p.hexR + 1, p.hexR + 1, 2, 20), mat)
    flange.rotation.x = Math.PI / 2
    flange.position.z = portFaceZ + 1
    sub.add(flange)

    const hexR = p.hexR / Math.cos(Math.PI / 6)
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(hexR, hexR, 7, 6), mat)
    hex.rotation.x = Math.PI / 2
    hex.position.z = portFaceZ + 4.5
    sub.add(hex)

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(p.bodyR, p.bodyR, p.bodyH, 16), mat)
    tube.rotation.x = Math.PI / 2
    tube.position.z = portFaceZ + 5 + p.bodyH / 2
    sub.add(tube)

    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(p.bodyR * 0.6, p.bodyR * 0.6, p.bodyH + 8, 12), boreMat)
    bore.rotation.x = Math.PI / 2
    bore.position.z = portFaceZ + p.bodyH / 2 + 2
    sub.add(bore)

    // 颜色区分盖帽
    const capMat = new THREE.MeshStandardMaterial({ color: p.capColor, metalness: 0.3, roughness: 0.6 })
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(p.bodyR + 0.5, p.bodyR + 0.5, 2, 16), capMat)
    cap.rotation.x = Math.PI / 2
    cap.position.z = portFaceZ + 5 + p.bodyH + 1
    sub.add(cap)

    sub.position.set(p.x, p.y, 0)
    parent.add(sub)
  }

  const cp = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6, 16), mat)
  cp.rotation.x = Math.PI / 2
  cp.position.z = portFaceZ + 3
  parent.add(cp)

  const cb = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 8, 12), boreMat)
  cb.rotation.x = Math.PI / 2
  cb.position.z = portFaceZ + 3
  parent.add(cb)
}

// ─────────────────────────────────────────────────────────────────────────────
// 螺柱
// ─────────────────────────────────────────────────────────────────────────────
function _makeBolts(z) {
  const c = CELL_CONFIG
  const bCfg = c.bolt
  const pcdR = bCfg.pcd / 2

  const group = new THREE.Group()
  group.name = 'bolts'
  group.userData.layer = 'bolts'

  const coverT = c.cover.thickness
  const protrude = 15
  const rodLen = cellCoreThickness() + protrude

  const bottomFace = z.bottomCover - coverT / 2
  const rodCenterZ = bottomFace + rodLen / 2

  const shaftMat = MaterialPresets.boltShaft()
  const shaftGeo = new THREE.CylinderGeometry(bCfg.diameter / 2, bCfg.diameter / 2, rodLen, 14)

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
// 螺母
// ─────────────────────────────────────────────────────────────────────────────
function _makeNuts(z) {
  const c = CELL_CONFIG
  const bCfg = c.bolt
  const pcdR = bCfg.pcd / 2

  const group = new THREE.Group()
  group.name = 'nuts'
  group.userData.layer = 'nuts'

  const nutMat = MaterialPresets.nut()

  const circumR = (bCfg.nutAF / 2) / Math.cos(Math.PI / 6)
  const holeR = bCfg.diameter / 2
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
  nutGeo.translate(0, 0, -bCfg.nutHeight / 2)

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
// 平垫圈
// ─────────────────────────────────────────────────────────────────────────────
function _makeFlatWashers(z) {
  const c = CELL_CONFIG
  const bCfg = c.bolt
  const wCfg = c.washer
  const pcdR = bCfg.pcd / 2

  const group = new THREE.Group()
  group.name = 'flatWashers'
  group.userData.layer = 'flatWashers'

  const mat = MaterialPresets.nut()
  const wasGeo = new THREE.CylinderGeometry(wCfg.od / 2, wCfg.od / 2, wCfg.thickness, 20)
  const holeGeo = new THREE.CylinderGeometry(wCfg.id / 2, wCfg.id / 2, wCfg.thickness * 1.1, 14)
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x101010, metalness: 0.1, roughness: 0.9
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
