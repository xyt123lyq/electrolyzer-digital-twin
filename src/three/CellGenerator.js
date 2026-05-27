import * as THREE from 'three'
import { MaterialPresets } from './Materials.js'

/**
 * 电解槽完整结构 (从上到下):
 *
 * 1. 粉色端盖板 (topCover)
 * 2. 白色5cm厚垫片 (upperGasket) - 正反面都有垫圈纹路
 * 3. 银色阳极板 (anodePlate)
 *    - 正面(上): 无纹路
 *    - 背面(下): 有垫圈纹路 + 黑色垫圈 + 方形凹槽(有流道)
 * 4. 两层薄白色垫片 (thinWhite1, thinWhite2)
 *    - 有垫圈纹路
 *    - 中间方窗内有质子膜1和质子膜2
 * 5. 银色阴极板 (cathodePlate)
 *    - 正面(下): 有垫圈纹路 + 黑色垫圈 + 方形凹槽(有流道) + 两片拉伸网
 *    - 反面(上): 无纹路
 * 6. 两层薄白色垫片 (thinWhite3, thinWhite4) - 反面无纹路
 * 7. 白色5cm厚垫片 (lowerGasket) - 正面(下)有纹路，黑色垫圈在纹路上面
 * 8. 底板 (bottomCover)
 */
export const CELL_CONFIG = {
  diameter:      80,
  innerDiameter: 76,

  cover: {
    thickness: 15,
    segments:  48
  },
  gasket: {
    thickness: 5,     // 白色5cm厚垫片
    segments: 40
  },
  plate: {
    thickness: 3,     // 极板厚度
    segments: 40
  },
  thinWhite: {
    thickness: 1.0,  // 薄垫片厚度
    segments: 40
  },
  blackGasket: {
    thickness: 1.0,  // 黑色垫圈厚度
    width: 50,
    height: 40
  },
  mea: {
    size: 25,         // 质子膜边长
    thickness: 0.3    // 质子膜厚度
  },
  mesh: {
    size: 30,        // 拉伸网边长
    thickness: 0.3, // 拉伸网厚度（薄金属丝）
    diamondSize: 6  // 菱形对角线尺寸
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
    grooveWidth: 1.0,   // 流道宽度
    grooveDepth: 0.3,     // 流道深度
    recessSize: 26        // 方形凹槽尺寸
  },

  get width()  { return this.diameter },
  get height() { return this.diameter }
}

function _layerZ(c) {
  const gT = c.gasket.thickness    // 5
  const pT = c.plate.thickness     // 3
  const cvT = c.cover.thickness    // 15
  const wT = c.washer.thickness    // 1.5
  const nH = c.bolt.nutHeight      // 4
  const twT = c.thinWhite.thickness // 1.0
  const bgT = c.blackGasket.thickness
  const meaT = c.mea.thickness
  const meshT = c.mesh.thickness

  // 计算各层位置
  // 顶层
  const topCover = +(pT + twT * 2 + bgT + meaT * 2 + meshT * 2 + gT + cvT / 2)

  // 阳极侧
  const upperGasket = +(pT + twT * 2 + bgT + meaT * 2 + meshT * 2 + gT / 2)
  const anodePlate = +(twT * 2 + bgT + meaT * 2 + meshT * 2 + pT / 2)
  const thinWhite1 = +(twT / 2 + bgT + meaT * 2 + meshT * 2 + twT / 2)
  const blackGasket1 = +(meaT * 2 + meshT * 2 + bgT / 2)
  const thinWhite2 = +(meaT * 2 + meshT * 2 + twT / 2)
  const mea1 = +(meaT + meshT * 2 + meaT / 2)
  const mea2 = +(meshT * 2 + meaT / 2)
  const mesh1 = +(meshT / 2)
  const mesh2 = -(meshT / 2)
  const mea3 = -(meaT / 2)
  const mea4 = -(meaT + meaT / 2)
  const thinWhite3 = -(meshT * 2 + meaT * 2 + twT / 2)
  const blackGasket2 = -(meaT * 2 + meshT * 2 + bgT / 2)
  const thinWhite4 = -(twT / 2 + bgT + meaT * 2 + meshT * 2 + twT / 2)
  const cathodePlate = -(pT / 2)

  // 底层
  const lowerGasket = -(pT + twT * 2 + bgT + meaT * 2 + meshT * 2 + gT / 2)
  const bottomCover = -(pT + twT * 2 + bgT + meaT * 2 + meshT * 2 + gT + cvT / 2)

  // 螺栓
  const flatWashers = topCover + cvT / 2 + wT / 2
  const nuts = flatWashers + wT / 2 + nH / 2
  const bolts = 0

  return {
    bolts, nuts, flatWashers,
    topCover, upperGasket, anodePlate,
    thinWhite1, blackGasket1, thinWhite2,
    mea1, mea2, mesh1, mesh2, mea3, mea4,
    thinWhite3, blackGasket2, thinWhite4,
    cathodePlate, lowerGasket, bottomCover
  }
}

export function cellCoreThickness() {
  const c = CELL_CONFIG
  return (
    c.cover.thickness * 2 +
    c.gasket.thickness * 2 +
    c.plate.thickness * 2 +
    c.thinWhite.thickness * 4 +
    c.blackGasket.thickness * 2 +
    c.mea.thickness * 2 +
    c.mesh.thickness * 2
  )
}

export function buildCell(index = 0) {
  const c = CELL_CONFIG
  const z = _layerZ(c)

  const topCover = _makePinkCover('topCover', true, z.topCover)
  const upperGasket = _makeWhiteGasketWithPattern('upperGasket', z.upperGasket)
  const anodePlate = _makeAnodePlate('anodePlate', z.anodePlate)
  const thinWhite1 = _makeThinWhiteWithPattern('thinWhite1', z.thinWhite1)
  const blackGasket1 = _makeBlackGasket('blackGasket1', z.blackGasket1)
  const thinWhite2 = _makeThinWhiteWithMEA('thinWhite2', z.thinWhite2)
  const mea1 = _makeMEA('mea1', z.mea1, 'mea1')
  const mea2 = _makeMEA('mea2', z.mea2, 'mea2')
  const mesh1 = _makeExpandedMesh('mesh1', z.mesh1)
  const mesh2 = _makeExpandedMesh('mesh2', z.mesh2)
  const mea3 = _makeMEA('mea3', z.mea3, 'mea3')
  const mea4 = _makeMEA('mea4', z.mea4, 'mea4')
  const thinWhite3 = _makeThinWhitePlain('thinWhite3', z.thinWhite3)
  const blackGasket2 = _makeBlackGasket('blackGasket2', z.blackGasket2)
  const thinWhite4 = _makeThinWhitePlain('thinWhite4', z.thinWhite4)
  const cathodePlate = _makeCathodePlate('cathodePlate', z.cathodePlate)
  const lowerGasket = _makeWhiteGasketWithPatternBottom('lowerGasket', z.lowerGasket)
  const bottomCover = _makePinkCover('bottomCover', false, z.bottomCover)
  const flatWashers = _makeFlatWashers(z)
  const nuts = _makeNuts(z)
  const bolts = _makeBolts(z)

  const group = new THREE.Group()
  group.name = `Cell_${index + 1}`
  group.userData.cellIndex = index
  group.userData.state = 'closed'

  group.add(
    topCover, upperGasket, anodePlate,
    thinWhite1, blackGasket1, thinWhite2,
    mea1, mea2, mesh1, mesh2, mea3, mea4,
    thinWhite3, blackGasket2, thinWhite4,
    cathodePlate, lowerGasket, bottomCover,
    flatWashers, nuts, bolts
  )

  const layers = {
    bolts, nuts, flatWashers,
    topCover, upperGasket, anodePlate,
    thinWhite1, blackGasket1, thinWhite2,
    mea1, mea2, mesh1, mesh2, mea3, mea4,
    thinWhite3, blackGasket2, thinWhite4,
    cathodePlate, lowerGasket, bottomCover
  }

  group.userData.layers = layers

  group.userData.originalPositions = {
    bolts: z.bolts, nuts: z.nuts, flatWashers: z.flatWashers,
    topCover: z.topCover, upperGasket: z.upperGasket, anodePlate: z.anodePlate,
    thinWhite1: z.thinWhite1, blackGasket1: z.blackGasket1, thinWhite2: z.thinWhite2,
    mea1: z.mea1, mea2: z.mea2, mesh1: z.mesh1, mesh2: z.mesh2, mea3: z.mea3, mea4: z.mea4,
    thinWhite3: z.thinWhite3, blackGasket2: z.blackGasket2, thinWhite4: z.thinWhite4,
    cathodePlate: z.cathodePlate, lowerGasket: z.lowerGasket, bottomCover: z.bottomCover
  }

  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 粉色端盖板
// ─────────────────────────────────────────────────────────────────────────────
function _makePinkCover(name, isTop, zPos) {
  const c = CELL_CONFIG
  const R = c.diameter / 2
  const T = c.cover.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.endplate()

  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, c.cover.segments), mat)
  body.rotation.x = Math.PI / 2
  body.castShadow = true
  group.add(body)

  // 切平
  const cutW = 28
  const flat = new THREE.Mesh(new THREE.BoxGeometry(4, cutW, T), mat)
  flat.position.set(-(R - 2 + 0.3), 0, 0)
  group.add(flat)

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
  const R = c.innerDiameter / 2
  const T = c.gasket.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, c.gasket.segments), mat)
  disc.rotation.x = Math.PI / 2
  group.add(disc)

  // 双面垫圈纹路
  _addGasketPattern(group, T / 2, true)
  _addGasketPattern(group, -T / 2, false)

  _addBoltHoles(group, T, 8)
  _addCloverOring(group, T)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 白色5cm厚垫片（正面有纹路，背面无纹路）
// ─────────────────────────────────────────────────────────────────────────────
function _makeWhiteGasketWithPatternBottom(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.gasket.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, c.gasket.segments), mat)
  disc.rotation.x = Math.PI / 2
  group.add(disc)

  // 背面有纹路
  _addGasketPattern(group, -T / 2, true)

  // 黑色垫圈在纹路上
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

  // 椭圆形黑色垫圈 - 圆角矩形样式
  const rx = c.blackGasket.width / 2
  const ry = c.blackGasket.height / 2
  const radius = 5 // 圆角半径

  const shape = new THREE.Shape()
  // 使用圆角矩形（椭圆形轮廓）
  shape.moveTo(-rx + radius, -ry)
  shape.lineTo(rx - radius, -ry)
  shape.quadraticCurveTo(rx, -ry, rx, -ry + radius)
  shape.lineTo(rx, ry - radius)
  shape.quadraticCurveTo(rx, ry, rx - radius, ry)
  shape.lineTo(-rx + radius, ry)
  shape.quadraticCurveTo(-rx, ry, -rx, ry - radius)
  shape.lineTo(-rx, -ry + radius)
  shape.quadraticCurveTo(-rx, -ry, -rx + radius, -ry)

  // 内部方孔
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
// 阳极板（正面无纹路，背面有纹路+流道）
// ─────────────────────────────────────────────────────────────────────────────
function _makeAnodePlate(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.plate.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.conductive()

  // 主体
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
// 阴极板（正面有纹路+流道+拉伸网，反面无纹路）
// ─────────────────────────────────────────────────────────────────────────────
function _makeCathodePlate(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.plate.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.conductive()

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, c.plate.segments), mat)
  disc.rotation.x = Math.PI / 2
  disc.castShadow = true
  group.add(disc)

  // 正面(下)垫圈纹路 - 阴极板正面朝上连接MEA
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

  // 使用GDL材质 - 深色金属质感
  const meshMat = MaterialPresets.gdl()
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x505050,
    metalness: 0.85,
    roughness: 0.35,
    side: THREE.DoubleSide
  })

  const size = c.mesh.size
  const diamondSize = c.mesh.diamondSize || 5
  const halfD = diamondSize / 2

  // 创建两片拉伸网
  for (let meshIdx = 0; meshIdx < 2; meshIdx++) {
    const zOffset = meshIdx === 0 ? c.mesh.thickness / 2 : -c.mesh.thickness / 2

    // 菱形网格
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
// 流道凹槽
// ─────────────────────────────────────────────────────────────────────────────
function _addFlowChannelGroove(parent, surfZ) {
  const c = CELL_CONFIG
  const grooveDepth = 0.3
  const grooveSize = c.flowChannel.recessSize
  const channelW = c.flowChannel.grooveWidth

  // 方形凹槽边框
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

  // 蛇形流道
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

    // 水平通道
    const segLen = grooveSize - rowSpacing
    const segGeo = new THREE.BoxGeometry(segLen, channelW, grooveDepth)
    const seg = new THREE.Mesh(segGeo, channelMat)
    seg.position.set(goingRight ? 0 : 0, y, surfZ + grooveDepth / 2)
    parent.add(seg)

    // 转弯
    if (row < numRows - 1) {
      const turnX = goingRight ? grooveSize / 2 - rowSpacing / 2 : -grooveSize / 2 + rowSpacing / 2
      const turnGeo = new THREE.BoxGeometry(channelW, rowSpacing, grooveDepth)
      const turn = new THREE.Mesh(turnGeo, channelMat)
      turn.position.set(turnX, y + rowSpacing / 2, surfZ + grooveDepth / 2)
      parent.add(turn)
    }
  }

  // 进液口和出液口
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

  // 椭圆形黑色垫圈 - 圆角矩形样式
  const rx = c.blackGasket.width / 2
  const ry = c.blackGasket.height / 2
  const radius = 5 // 圆角半径

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

  // 内部圆孔
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
// 薄白色垫片（双面纹路+方窗MEA）
// ─────────────────────────────────────────────────────────────────────────────
function _makeThinWhiteWithPattern(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.thinWhite.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  // 带方窗的形状
  const shape = new THREE.Shape()
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const x = Math.cos(a) * R
    const y = Math.sin(a) * R
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }

  const windowSize = c.mea.size + 10
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

  // 双面纹路
  _addGasketPattern(group, T / 2, true)
  _addGasketPattern(group, -T / 2, false)

  _addBoltHoles(group, T, 8)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 薄白色垫片（方窗内含MEA）
// ─────────────────────────────────────────────────────────────────────────────
function _makeThinWhiteWithMEA(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.thinWhite.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  const shape = new THREE.Shape()
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const x = Math.cos(a) * R
    const y = Math.sin(a) * R
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }

  const windowSize = c.mea.size + 8
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

  _addBoltHoles(group, T, 8)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 薄白色垫片（无纹路）
// ─────────────────────────────────────────────────────────────────────────────
function _makeThinWhitePlain(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.thinWhite.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, c.thinWhite.segments), mat)
  disc.rotation.x = Math.PI / 2
  group.add(disc)

  _addBoltHoles(group, T, 8)

  group.position.z = zPos
  return group
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

  // 使用GDL材质 - 深色金属质感
  const mat = MaterialPresets.gdl()

  // 创建菱形拉伸网 - 使用线框表示
  // 菱形拉伸网的特征：金属丝交叉形成菱形孔洞
  const diamondSize = c.mesh.diamondSize || 5 // 菱形对角线长度
  const halfD = diamondSize / 2

  // 创建菱形图案的线条
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x505050,
    metalness: 0.85,
    roughness: 0.35,
    side: THREE.DoubleSide
  })

  // 创建菱形网格 - 交错排列形成拉伸网效果
  // 行偏移：奇数行偏移半个菱形宽度
  for (let row = -size / 2; row <= size / 2; row += diamondSize) {
    const offset = 0 // 行内不偏移
    for (let col = -size / 2; col <= size / 2; col += diamondSize) {
      const cx = col
      const cy = row

      // 菱形顶点 (平行四边形形状)
      // 形状:  /\
      //        /  \
      //        \  /
      //         \/
      const points = [
        new THREE.Vector3(cx - halfD, cy, 0),           // 左
        new THREE.Vector3(cx, cy + halfD, 0),          // 上
        new THREE.Vector3(cx + halfD, cy, 0),          // 右
        new THREE.Vector3(cx, cy - halfD, 0),          // 下
      ]

      // 绘制菱形边框
      for (let i = 0; i < 4; i++) {
        const p1 = points[i]
        const p2 = points[(i + 1) % 4]
        const lineGeo = new THREE.BoxGeometry(
          Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)),
          0.4,
          T + 0.1
        )
        const line = new THREE.Mesh(lineGeo, lineMat)

        // 计算中点和角度
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        line.position.set(midX, midY, 0)

        // 旋转到正确方向
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
        line.rotation.z = angle

        group.add(line)
      }
    }
  }

  // 添加斜向交叉线条增强拉伸网效果
  const diagMat = new THREE.MeshStandardMaterial({
    color: 0x404040,
    metalness: 0.9,
    roughness: 0.3,
    side: THREE.DoubleSide
  })

  // 45度斜向线条
  for (let i = -size; i <= size; i += diamondSize * 1.5) {
    // 正斜向
    const diagLen = size * 1.4
    const diagGeo = new THREE.BoxGeometry(Math.sqrt(2) * diamondSize * 0.5, 0.35, T + 0.1)
    const diag1 = new THREE.Mesh(diagGeo, diagMat)
    diag1.position.set(i + diamondSize * 0.3, 0, 0)
    diag1.rotation.z = Math.PI / 4
    group.add(diag1)

    // 反斜向
    const diag2 = new THREE.Mesh(diagGeo.clone(), diagMat)
    diag2.position.set(i - diamondSize * 0.3, 0, 0)
    diag2.rotation.z = -Math.PI / 4
    group.add(diag2)
  }

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 垫圈纹路
// ─────────────────────────────────────────────────────────────────────────────
function _addGasketPattern(parent, surfZ, front) {
  const c = CELL_CONFIG
  const grooveDepth = 0.2
  const outerR = c.innerDiameter / 2 - 5

  const grooveMat = new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    metalness: 0.1,
    roughness: 0.6
  })

  // 同心圆纹路
  for (let r = 15; r <= outerR - 5; r += 5) {
    const tubeGeo = new THREE.TorusGeometry(r, 0.3, 8, 32)
    const tube = new THREE.Mesh(tubeGeo, grooveMat)
    tube.rotation.x = Math.PI / 2
    // Z位置与径向线保持一致：front=true → surfZ下方，front=false → surfZ上方
    tube.position.z = surfZ + (front ? -grooveDepth / 2 : grooveDepth / 2)
    parent.add(tube)
  }

  // 径向纹路
  const numLines = 24
  for (let i = 0; i < numLines; i++) {
    const angle = (i / numLines) * Math.PI * 2
    const lineLen = outerR - 12
    const lineGeo = new THREE.BoxGeometry(lineLen, 0.3, grooveDepth)
    const line = new THREE.Mesh(lineGeo, grooveMat)
    line.rotation.z = angle
    line.position.x = Math.cos(angle) * (lineLen / 2 + 10)
    line.position.y = Math.sin(angle) * (lineLen / 2 + 10)
    line.position.z = surfZ + (front ? -grooveDepth / 2 : grooveDepth / 2)
    parent.add(line)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 黑色垫圈
// ─────────────────────────────────────────────────────────────────────────────
function _makeBlackGasket(name, zPos) {
  const c = CELL_CONFIG
  const bgT = c.blackGasket.thickness
  const rx = c.blackGasket.width / 2
  const ry = c.blackGasket.height / 2

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.gasket()

  const shape = new THREE.Shape()
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const x = Math.cos(a) * rx
    const y = Math.sin(a) * ry
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }

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
  const disc = new THREE.Mesh(geo, mat)
  disc.castShadow = true
  group.add(disc)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 四叶形O-ring
// ─────────────────────────────────────────────────────────────────────────────
function _addCloverOring(parent, gasketT) {
  const mat = MaterialPresets.gasket()
  const tubeR = 2.0
  const outerR = 20

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

  const geo = new THREE.ExtrudeGeometry(outer, { depth: 1.5, bevelEnabled: false })
  geo.translate(0, 0, -0.75)
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

  const layout = [
    { x: 0, y: 16, hexR: 5.5, bodyR: 3.5, bodyH: 8 },
    { x: -15, y: 2, hexR: 5.0, bodyR: 3.2, bodyH: 7 },
    { x: 14, y: -6, hexR: 6.0, bodyR: 4.0, bodyH: 9 }
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
