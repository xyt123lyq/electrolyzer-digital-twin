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
  diameter:      90,
  innerDiameter: 82,

  cover: {
    thickness: 14,
    segments:  72,
    earExtend: 12,
    earHalfWidth: 10
  },
  gasket: {
    thickness: 4.5,
    segments: 64
  },
  plate: {
    thickness: 3,
    segments: 64
  },
  thinWhite: {
    thickness: 1.0,
    segments: 40
  },
  blackGasket: {
    thickness: 0.9,
    width: 50,
    height: 38
  },
  mea: {
    size: 25,
    thickness: 0.3
  },
  mesh: {
    size: 26,
    thickness: 0.25,
    diamondSize: 3.1  // 菱形对角线尺寸(加密)
  },
  bolt: {
    count: 8,
    pcd: 68,
    diameter: 4.2,
    length: 82,
    nutHeight: 4,
    nutAF: 8
  },
  washer: {
    od: 9.5,
    id: 4.8,
    thickness: 1.2
  },
  lug: {
    width: 15,
    length: 25,
    thickness: 2,
    holeRadius: 3.4
  },
  flowChannel: {
    grooveWidth: 1.05,
    grooveDepth: 0.35,
    recessSize: 30
  },

  get width()  { return this.diameter },
  get height() { return this.diameter }
}

// ─────────────────────────────────────────────────────────────────────────────
// Z位置计算（从中心对称向外）
// ─────────────────────────────────────────────────────────────────────────────
function _layerZ(c) {
  const cvT = c.cover.thickness      // 15
  const wT  = c.washer.thickness     // 1.5
  const nH  = c.bolt.nutHeight       // 4

  // Symmetric stack around Z = 0
  const mea3 = 0
  const mea4 = 0
  const mesh1 = 0
  
  const thinWhite1 = 0.7
  const thinWhite2 = -0.7
  
  const anodePlate = 2.9
  const cathodePlate = -2.9
  
  const upperGasket = 6.65
  const lowerGasket = -6.65
  
  const topCover = 16.2
  const bottomCover = -16.2
  
  // Hardware
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
  return 46.4
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
// 圆角方形 (Squircle) 形状生成 — 保留兼容
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

// 圆形形状生成
function _makeCircleShape(radius) {
  const shape = new THREE.Shape()
  shape.moveTo(radius, 0)
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false)
  shape.closePath()
  return shape
}

// 带侧耳的圆形端盖形状生成 (左右各一个半圆耳)
function _makeCoverShape(radius, earExtend, earHalfH) {
  // Main disc arc + two rectangular ears on left/right
  const shape = new THREE.Shape()
  const ex = radius + earExtend     // ear outer X
  const ey = earHalfH               // ear half height
  // Bottom of right ear → arc around top → bottom of left ear → arc back
  shape.moveTo(radius * 0.85, -ey)
  shape.lineTo(ex - ey, -ey)
  shape.absarc(ex - ey, 0, ey, -Math.PI / 2, Math.PI / 2, false)
  shape.lineTo(radius * 0.85, ey)
  shape.absarc(0, 0, radius, Math.atan2(ey, radius * 0.85), Math.PI - Math.atan2(ey, radius * 0.85), true)
  shape.lineTo(-(ex - ey), ey)
  shape.absarc(-(ex - ey), 0, ey, Math.PI / 2, -Math.PI / 2, false)
  shape.lineTo(-radius * 0.85, -ey)
  shape.absarc(0, 0, radius, Math.PI + Math.atan2(ey, radius * 0.85), Math.PI * 2 - Math.atan2(ey, radius * 0.85), true)
  shape.closePath()
  return shape
}

function _makeSingleEarCoverShape(radius, earExtend, earHalfH) {
  const shape = new THREE.Shape()
  const ex = radius + earExtend
  const ey = earHalfH
  const joinA = Math.asin(ey / radius)
  const xJoin = Math.cos(joinA) * radius

  shape.moveTo(xJoin, -ey)
  shape.lineTo(ex - ey, -ey)
  shape.quadraticCurveTo(ex, -ey, ex, 0)
  shape.quadraticCurveTo(ex, ey, ex - ey, ey)
  shape.lineTo(xJoin, ey)
  shape.absarc(0, 0, radius, joinA, Math.PI * 2 - joinA, false)
  shape.closePath()
  return shape
}

function _makePhotoCoverShape(radius, earExtend, earHalfH) {
  const shape = new THREE.Shape()
  const ex = radius + earExtend
  const ey = earHalfH
  const joinA = Math.asin(ey / radius)
  const xJoin = Math.cos(joinA) * radius
  const cornerR = Math.min(5.2, earHalfH * 0.58)

  shape.moveTo(xJoin, -ey)
  shape.lineTo(ex - cornerR, -ey)
  shape.quadraticCurveTo(ex, -ey, ex, -ey + cornerR)
  shape.lineTo(ex, ey - cornerR)
  shape.quadraticCurveTo(ex, ey, ex - cornerR, ey)
  shape.lineTo(xJoin, ey)
  shape.absarc(0, 0, radius, joinA, Math.PI * 2 - joinA, false)
  shape.closePath()
  return shape
}

// ─────────────────────────────────────────────────────────────────────────────
// 粉色端盖板（带侧耳圆形）
// ─────────────────────────────────────────────────────────────────────────────
function _makePinkCover(name, isTop, zPos) {
  const c = CELL_CONFIG
  const radius = c.diameter / 2
  const earExtend = c.cover.earExtend
  const earWidthY = c.cover.earHalfWidth
  const T = c.cover.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.endplate()

  const shape = _makePhotoCoverShape(radius, earExtend, earWidthY)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: T,
    bevelEnabled: true,
    bevelThickness: 0.45,
    bevelSize: 0.75,
    bevelSegments: 3,
    curveSegments: 64
  })
  geo.translate(0, 0, -T / 2)

  const body = new THREE.Mesh(geo, mat)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  _addBoltHoles(group, T, 8)
  _addCoverHoleChamfers(group, T / 2, 8)
  _addCoverHoleChamfers(group, -T / 2, 8)
  _addBrushedDiscLines(group, radius, T / 2 + 0.08, 0xd4a084)

  if (isTop) {
    _addGasPorts(group, T / 2)
    _addHexSocketPlug(group, 0, -22, T / 2 + 1.8)
  }

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 白色5cm厚垫片（圆形双面纹路）
// ─────────────────────────────────────────────────────────────────────────────
function _makeWhiteGasketWithPattern(name, zPos) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2
  const T = c.gasket.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  const shape = _makeCircleShape(flatR)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  geo.translate(0, 0, -T / 2)
  const body = new THREE.Mesh(geo, mat)
  body.castShadow = true
  group.add(body)

  // _addGasketPattern(group, T / 2, true)
  // _addGasketPattern(group, -T / 2, false)

  _addBoltHoles(group, T, 8)
  _addPhotoCloverSealAt(group, T / 2)
  _addPhotoCloverSealAt(group, -T / 2)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 白色5cm厚垫片（圆形背面纹路+黑色垫圈）
// ─────────────────────────────────────────────────────────────────────────────
function _makeWhiteGasketWithPatternBottom(name, zPos) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2
  const T = c.gasket.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.flowPlate()

  const shape = _makeCircleShape(flatR)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  geo.translate(0, 0, -T / 2)
  const body = new THREE.Mesh(geo, mat)
  body.castShadow = true
  group.add(body)

  // _addGasketPattern(group, T / 2, true)
  _addBoltHoles(group, T, 8)
  _addPhotoCloverSealAt(group, T / 2)

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

  const geo = new THREE.ExtrudeGeometry(shape, { depth: bgT, bevelEnabled: false, curveSegments: 64 })
  geo.translate(0, 0, -bgT / 2)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = zPos - bgT / 2
  parent.add(mesh)
}

// ─────────────────────────────────────────────────────────────────────────────
// 极板
// ─────────────────────────────────────────────────────────────────────────────
// 极板2D形状与镂空定义
// ─────────────────────────────────────────────────────────────────────────────
function _makeCentralCutoutPath() {
  const path = new THREE.Path()
  // Start at top-right corner of the central square recess
  path.moveTo(15.0, 15.0)

  // Go diagonally to the top of the right port arch (tangent point)
  path.lineTo(24.0, 3.2)

  // Draw right port arch: centered at (24.0, 0) with radius 3.2, CW from PI/2 to -PI/2
  path.absarc(24.0, 0, 3.2, Math.PI / 2, -Math.PI / 2, true)

  // Go diagonally to the bottom-right corner of the central square recess
  path.lineTo(15.0, -15.0)

  // Go horizontally to the bottom-left corner of the central square recess
  path.lineTo(-15.0, -15.0)

  // Go diagonally to the bottom of the left port arch (tangent point)
  path.lineTo(-24.0, -3.2)

  // Draw left port arch: centered at (-24.0, 0) with radius 3.2, CW from -PI/2 to PI/2
  path.absarc(-24.0, 0, 3.2, -Math.PI / 2, Math.PI / 2, true)

  // Go diagonally to the top-left corner of the central square recess
  path.lineTo(-15.0, 15.0)

  // Go horizontally back to the start
  path.lineTo(15.0, 15.0)

  path.closePath()
  return path
}

function _makeBackingPlateShape(R) {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, R, 0, Math.PI * 2, false)
  
  // Cutout 4 port holes
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const px = Math.cos(a) * 24.0
    const py = Math.sin(a) * 24.0
    const portHole = new THREE.Path()
    portHole.absarc(px, py, 2.0, 0, Math.PI * 2, true)
    shape.holes.push(portHole)
  }
  return shape
}

function _makeFacePlateShape(R) {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, R, 0, Math.PI * 2, false)
  
  // Cutout 1: Central active area + horizontal branch channels
  const mainCutout = _makeCentralCutoutPath()
  shape.holes.push(mainCutout)
  
  // Cutout 2: Top port pocket
  const topPort = new THREE.Path()
  topPort.absarc(0, 24.0, 2.5, 0, Math.PI * 2, true)
  shape.holes.push(topPort)
  
  // Cutout 3: Bottom port pocket
  const bottomPort = new THREE.Path()
  bottomPort.absarc(0, -24.0, 2.5, 0, Math.PI * 2, true)
  shape.holes.push(bottomPort)
  
  return shape
}

function _makeAnodePlate(name, zPos) {
  const c = CELL_CONFIG
  const R = c.innerDiameter / 2
  const T = c.plate.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.conductive()

  // Base backing plate (thickness 2.65 mm)
  const backingShape = _makeBackingPlateShape(R)
  const backingGeo = new THREE.ExtrudeGeometry(backingShape, { depth: T - c.flowChannel.grooveDepth, bevelEnabled: false, curveSegments: 48 })
  backingGeo.translate(0, 0, -(T - c.flowChannel.grooveDepth) / 2)
  const backingMesh = new THREE.Mesh(backingGeo, mat)
  backingMesh.castShadow = true
  backingMesh.position.z = 0.175 // side = -1 for anode, so position.z = +0.175
  group.add(backingMesh)

  // Face plate (thickness 0.35 mm) with cutouts
  const faceShape = _makeFacePlateShape(R)
  const faceGeo = new THREE.ExtrudeGeometry(faceShape, { depth: c.flowChannel.grooveDepth, bevelEnabled: false, curveSegments: 48 })
  faceGeo.translate(0, 0, -c.flowChannel.grooveDepth / 2)
  const faceMesh = new THREE.Mesh(faceGeo, mat)
  faceMesh.castShadow = true
  faceMesh.position.z = -1.325 // side = -1 for anode, so position.z = -1.325
  group.add(faceMesh)

  // 背面方形凹槽+流道
  _addPlateBlackGasket(group, -T / 2)
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

  // Base backing plate (thickness 2.65 mm)
  const backingShape = _makeBackingPlateShape(R)
  const backingGeo = new THREE.ExtrudeGeometry(backingShape, { depth: T - c.flowChannel.grooveDepth, bevelEnabled: false, curveSegments: 48 })
  backingGeo.translate(0, 0, -(T - c.flowChannel.grooveDepth) / 2)
  const backingMesh = new THREE.Mesh(backingGeo, mat)
  backingMesh.castShadow = true
  backingMesh.position.z = -0.175 // side = 1 for cathode, so position.z = -0.175
  group.add(backingMesh)

  // Face plate (thickness 0.35 mm) with cutouts
  const faceShape = _makeFacePlateShape(R)
  const faceGeo = new THREE.ExtrudeGeometry(faceShape, { depth: c.flowChannel.grooveDepth, bevelEnabled: false, curveSegments: 48 })
  faceGeo.translate(0, 0, -c.flowChannel.grooveDepth / 2)
  const faceMesh = new THREE.Mesh(faceGeo, mat)
  faceMesh.castShadow = true
  faceMesh.position.z = 1.325 // side = 1 for cathode, so position.z = +1.325
  group.add(faceMesh)

  // 正面方形凹槽+流道
  _addPlateBlackGasket(group, +T / 2)
  _addFlowChannelGroove(group, +T / 2)

  // 两片拉伸网 - 在阴极板正面（完美缩入流道凹槽上方，深度为 0.12 mm）
  const meshGroup = _makeDoubleMeshStack()
  meshGroup.position.z = +T / 2 - 0.12 // Sunken below the plate flat surface!
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
    color: 0x747879,
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
            0.28,
            c.mesh.thickness + 0.04
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
  const T = c.thinWhite.thickness

  const group = new THREE.Group()
  group.name = name
  group.userData.layer = name

  const mat = MaterialPresets.thinGasket()

  // 带方窗的圆形垫片
  const shape = _makeCircleShape(flatR)

  const windowSize = c.mea.size / 2 + 3
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
  // 方形O-ring围绕方窗
  _addThinWhiteWindowPattern(group, windowSize, T / 2)
  _addThinWhiteWindowPattern(group, windowSize, -T / 2)

  _addBoltHoles(group, T, 8)

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 薄垫片交叉线纹路（细微CNC加工痕迹）
// ─────────────────────────────────────────────────────────────────────────────
function _circleXExtent(radius, y) {
  const ay = Math.abs(y)
  if (ay >= radius) return 0
  return Math.sqrt(radius * radius - y * y)
}

function _addCrosshatchTexture(parent, surfZ, front) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2 - 3
  const spacing = 4.8
  const lineW = 0.10
  const lineH = 0.08
  const zOff = front ? -lineH / 2 : lineH / 2

  const mat = new THREE.MeshStandardMaterial({
    color: 0xd4d1c6,
    metalness: 0.04,
    roughness: 0.62,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  })

  // 水平方向平行线，裁剪到圆形边界
  for (let y = -flatR; y <= flatR; y += spacing) {
    const xExt = _circleXExtent(flatR, y)
    if (xExt < 2) continue
    const lineGeo = new THREE.BoxGeometry(xExt * 2, lineW, lineH)
    const line = new THREE.Mesh(lineGeo, mat)
    line.position.set(0, y, surfZ + zOff)
    parent.add(line)
  }

  // 垂直方向平行线（真交叉纹路）
  for (let x = -flatR; x <= flatR; x += spacing) {
    const yExt = _circleXExtent(flatR, x)
    if (yExt < 2) continue
    const lineGeo = new THREE.BoxGeometry(lineW, yExt * 2, lineH)
    const line = new THREE.Mesh(lineGeo, mat)
    line.position.set(x, 0, surfZ + zOff)
    parent.add(line)
  }
}

// 计算圆角方形在给定y值处的x范围 (保留作兼容)
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
function _addThinWhiteWindowPattern(parent, windowSize, surfZ) {
  const side = surfZ >= 0 ? 1 : -1
  const reliefMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f4ec,
    metalness: 0,
    roughness: 0.46,
    clearcoat: 0.32,
    clearcoatRoughness: 0.42,
    transparent: true,
    opacity: 0.82
  })
  const reliefH = 0.26
  const z = surfZ + side * (reliefH / 2 + 0.015)

  // Use mathematically precise realistic shape parameters: base = windowSize + 10.2, amp = 4.2, width = 3.2
  const Pc = windowSize + 10.2 - 1.5 // 24.2
  
  // Call smooth polar coordinate wavy seal shape of constant width
  const reliefShape = _makeWavySealShape(windowSize + 10.2, 4.2, 3.2, 128, false)
  const reliefGeo = new THREE.ExtrudeGeometry(reliefShape, {
    depth: reliefH,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.045,
    bevelSegments: 2
  })
  reliefGeo.translate(0, 0, -reliefH / 2)
  const relief = new THREE.Mesh(reliefGeo, reliefMat)
  relief.position.z = z
  parent.add(relief)
}

function _addGasketPattern(parent, surfZ, front) {
  const c = CELL_CONFIG
  const flatR = c.diameter / 2 - 3
  const spacing = 4.2
  const lineW = 0.13
  const lineH = 0.10
  const zOff = front ? -lineH / 2 : lineH / 2

  const mat = new THREE.MeshStandardMaterial({
    color: 0xd2cec2,
    metalness: 0.06,
    roughness: 0.66,
    transparent: true,
    opacity: 0.58,
    depthWrite: false
  })

  // 水平方向平行线，裁剪到圆形边界
  for (let y = -flatR; y <= flatR; y += spacing) {
    const xExt = _circleXExtent(flatR, y)
    if (xExt < 2) continue
    const lineGeo = new THREE.BoxGeometry(xExt * 2, lineW, lineH)
    const line = new THREE.Mesh(lineGeo, mat)
    line.position.set(0, y, surfZ + zOff)
    parent.add(line)
  }

  // 垂直方向平行线（真交叉纹路）
  for (let x = -flatR; x <= flatR; x += spacing) {
    const yExt = _circleXExtent(flatR, x)
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
  const side = surfZ >= 0 ? 1 : -1
  const grooveDepth = c.flowChannel.grooveDepth
  const grooveSize = c.flowChannel.recessSize
  const channelW = c.flowChannel.grooveWidth * 0.55
  
  // Recess floor top is strictly sunken by grooveDepth (0.35 mm) relative to surfZ
  const grooveFaceZ = surfZ - side * grooveDepth

  const channelMat = new THREE.MeshStandardMaterial({
    color: 0x697075,
    metalness: 0.88,
    roughness: 0.42
  })
  const portMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d30,
    metalness: 0.55,
    roughness: 0.55
  })

  // Recess frame border rim inside the pocket
  const rimW = 0.75
  const rimZ = grooveFaceZ + side * 0.06
  for (const b of [
    { w: grooveSize + 1.4, h: rimW, x: 0, y: grooveSize / 2 + rimW / 2 },
    { w: grooveSize + 1.4, h: rimW, x: 0, y: -grooveSize / 2 - rimW / 2 },
    { w: rimW, h: grooveSize + 1.4, x: -grooveSize / 2 - rimW / 2, y: 0 },
    { w: rimW, h: grooveSize + 1.4, x: grooveSize / 2 + rimW / 2, y: 0 }
  ]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, 0.12), channelMat)
    rim.position.set(b.x, b.y, rimZ)
    parent.add(rim)
  }

  // 11 Central flow lanes: thickness 0.11 mm, sitting flush on the recess floor (depth 0.35 to 0.24)
  const laneCount = 11
  const laneSpacing = grooveSize / (laneCount + 1)
  for (let i = 0; i < laneCount; i++) {
    const y = -grooveSize / 2 + laneSpacing * (i + 1)
    const lane = new THREE.Mesh(new THREE.BoxGeometry(grooveSize - 5.2, channelW, 0.11), channelMat)
    lane.position.set(0, y, grooveFaceZ + side * 0.055)
    parent.add(lane)
  }

  const portR = 24.0 // Align perfectly with R_port of wavy gaskets (24.0)
  _addPortStartedArcGrooves(parent, 1, portR, grooveSize, grooveFaceZ, side)
  _addPortStartedArcGrooves(parent, -1, portR, grooveSize, grooveFaceZ, side)
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const px = Math.cos(a) * portR
    const py = Math.sin(a) * portR
    const port = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.16, 18), portMat)
    port.rotation.x = Math.PI / 2
    port.position.set(px, py, grooveFaceZ + side * 0.08)
    parent.add(port)

    // Flow channel branches ONLY on left (Math.PI) and right (0) ports!
    if (a === 0 || a === Math.PI) {
      for (let i = -2; i <= 2; i++) { // 5 horizontal slots!
        const step = Math.abs(i)
        const branchLen = 10.1 - step * 1.9 // starts at the side port and steps toward the active area
        const branchX = 19.25 - step * 0.95

        const branch = new THREE.Mesh(new THREE.BoxGeometry(branchLen, 0.28, 0.10), channelMat)
        branch.position.set(branchX * Math.cos(a), i * 1.15, grooveFaceZ + side * 0.05)
        parent.add(branch)
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function _addPortStartedArcGrooves(parent, dir, portR, grooveSize, grooveFaceZ, side) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3e464a,
    metalness: 0.68,
    roughness: 0.48
  })
  const activeEdgeX = dir * (grooveSize / 2 + 0.55)
  const portEdgeX = dir * (portR - 2.15)
  const z = grooveFaceZ + side * 0.105

  for (const sgn of [1, -1]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(portEdgeX, sgn * 2.15, z),
      new THREE.Vector3(dir * (portR - 4.7), sgn * 13.8, z),
      new THREE.Vector3(activeEdgeX, sgn * (grooveSize / 2 + 0.2), z)
    )
    const groove = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, 0.16, 8, false), mat)
    parent.add(groove)
  }
}

function _addPlateBlackGasket(parent, surfZ) {
  const c = CELL_CONFIG
  const side = surfZ >= 0 ? 1 : -1
  const bgT = c.blackGasket.thickness

  const mat = MaterialPresets.gasket()

  const shape = _makeWavySealShape(25, 5.6, 4.2, 128)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: bgT, bevelEnabled: false, curveSegments: 64 })
  geo.translate(0, 0, -bgT / 2)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.z = surfZ + side * (bgT / 2 + 0.22)
  parent.add(mesh)

  // Add 5 horizontal parallel slots on left and right ports to expose the plate silver channels underneath!
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

  group.position.z = zPos
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// 四叶形O-ring
// ─────────────────────────────────────────────────────────────────────────────
function _makeWavySealShape(radiusBase, radiusAmp, tubeWidth, steps = 120, includeChannels = false) {
  const usePhotoArc = Math.abs(radiusBase - 25) < 0.5

  // Dynamically calculate control parameters for perfect geometry across all gasket layers
  let R_port
  if (Math.abs(radiusBase - 22) < 0.5) {
    R_port = 20.5
  } else if (Math.abs(radiusBase - 25) < 0.5) {
    R_port = 24.0
  } else {
    R_port = radiusBase - 1.5 // 24.2
  }

  // 1. Calculate matching W_in, W_out, and r_port_outer
  let W_in
  if (usePhotoArc) {
    W_in = 14.1 // Wider curved shoulders around the active area, matching the red reference arcs.
  } else {
    W_in = radiusBase - 10.7 // For thin white gasket: windowSize + 10.2 - 10.7 = windowSize - 0.5 (approx 15.0)
  }
  const W_out = W_in + tubeWidth
  const r_port_outer = R_port - W_in + 0.8 // approx 5.0 to 6.0
  const r_port_inner = r_port_outer - tubeWidth // concentric inner port loop radius
  const R_corner = usePhotoArc ? 6.2 : 3.5
  const r_corner = usePhotoArc ? 5.4 : 2.0

  const L_corner = W_out - R_corner
  const L_corner_in = W_in - r_corner

  // To guarantee perfectly monotonic S-curves without any overshoot:
  // L_straight must be strictly between r_port_outer and L_corner
  const L_straight = (r_port_outer + L_corner) / 2
  const L_straight_in = (r_port_inner + L_corner_in) / 2

  const tension = usePhotoArc ? 0.72 : 0.45
  const offset_port = tension * (R_port - W_out)
  const offset_straight = tension * (L_straight - r_port_outer)

  const offset_port_in = tension * (R_port - W_in)
  const offset_straight_in = tension * (L_straight_in - r_port_inner)

  const shape = new THREE.Shape()

  // ─────────────────────────────────────────────────────────────────────────────
  // OUTER BOUNDARY (CCW Winding Order)
  // ─────────────────────────────────────────────────────────────────────────────
  // Start at right lobe top tip
  shape.moveTo(R_port, r_port_outer)

  // Top-Right Quadrant
  shape.bezierCurveTo(R_port - offset_port, r_port_outer, W_out, L_straight - offset_straight, W_out, L_straight)
  shape.lineTo(W_out, L_corner)
  shape.absarc(W_out - R_corner, W_out - R_corner, R_corner, 0, 0.5 * Math.PI, false)
  shape.lineTo(L_straight, W_out)
  shape.bezierCurveTo(L_straight - offset_straight, W_out, r_port_outer, R_port - offset_port, r_port_outer, R_port)
  shape.absarc(0, R_port, r_port_outer, 0, Math.PI, false)

  // Top-Left Quadrant
  shape.bezierCurveTo(-r_port_outer, R_port - offset_port, -L_straight + offset_straight, W_out, -L_straight, W_out)
  shape.lineTo(-W_out + R_corner, W_out)
  shape.absarc(-W_out + R_corner, W_out - R_corner, R_corner, 0.5 * Math.PI, Math.PI, false)
  shape.lineTo(-W_out, L_straight)
  shape.bezierCurveTo(-W_out, L_straight - offset_straight, -R_port + offset_port, r_port_outer, -R_port, r_port_outer)
  shape.absarc(-R_port, 0, r_port_outer, 0.5 * Math.PI, 1.5 * Math.PI, false)

  // Bottom-Left Quadrant
  shape.bezierCurveTo(-R_port + offset_port, -r_port_outer, -W_out, -L_straight + offset_straight, -W_out, -L_straight)
  shape.lineTo(-W_out, -L_corner)
  shape.absarc(-W_out + R_corner, -W_out + R_corner, R_corner, Math.PI, 1.5 * Math.PI, false)
  shape.lineTo(-L_straight, -W_out)
  shape.bezierCurveTo(-L_straight + offset_straight, -W_out, -r_port_outer, -R_port + offset_port, -r_port_outer, -R_port)
  shape.absarc(0, -R_port, r_port_outer, Math.PI, 2 * Math.PI, false)

  // Bottom-Right Quadrant
  shape.bezierCurveTo(r_port_outer, -R_port + offset_port, L_straight - offset_straight, -W_out, L_straight, -W_out)
  shape.lineTo(W_out - R_corner, -W_out)
  shape.absarc(W_out - R_corner, -W_out + R_corner, R_corner, 1.5 * Math.PI, 2 * Math.PI, false)
  shape.lineTo(W_out, -L_straight)
  shape.bezierCurveTo(W_out, -L_straight + offset_straight, R_port - offset_port, -r_port_outer, R_port, -r_port_outer)
  shape.absarc(R_port, 0, r_port_outer, 1.5 * Math.PI, 2.5 * Math.PI, false)
  shape.closePath()

  // ─────────────────────────────────────────────────────────────────────────────
  // INNER BOUNDARY (CW Winding Order)
  // Left/Right ports are OPEN (connected to the center window)
  // Top/Bottom ports are CLOSED (solid walls)
  // ─────────────────────────────────────────────────────────────────────────────
  const innerPath = new THREE.Path()
  // Start at right lobe bottom inner (CW winding)
  innerPath.moveTo(W_in, -L_straight_in)

  // Go to bottom-right corner
  innerPath.lineTo(W_in, -W_in + r_corner)
  innerPath.absarc(W_in - r_corner, -W_in + r_corner, r_corner, 0, -0.5 * Math.PI, true)

  // Go straight across bottom (Closed bottom port)
  innerPath.lineTo(-W_in + r_corner, -W_in)
  innerPath.absarc(-W_in + r_corner, -W_in + r_corner, r_corner, -0.5 * Math.PI, -Math.PI, true)

  // Go to left lobe (Open left port loop)
  innerPath.lineTo(-W_in, -L_straight_in)
  innerPath.bezierCurveTo(-W_in, -L_straight_in + offset_straight_in, -R_port + offset_port_in, -r_port_inner, -R_port, -r_port_inner)
  innerPath.absarc(-R_port, 0, r_port_inner, 1.5 * Math.PI, 0.5 * Math.PI, true)
  innerPath.bezierCurveTo(-R_port + offset_port_in, r_port_inner, -W_in, L_straight_in - offset_straight_in, -W_in, L_straight_in)

  // Go to top-left corner
  innerPath.lineTo(-W_in, W_in - r_corner)
  innerPath.absarc(-W_in + r_corner, W_in - r_corner, r_corner, -Math.PI, -1.5 * Math.PI, true)

  // Go straight across top (Closed top port)
  innerPath.lineTo(W_in - r_corner, W_in)
  innerPath.absarc(W_in - r_corner, W_in - r_corner, r_corner, 0.5 * Math.PI, 0, true)

  // Go to right lobe (Open right port loop)
  innerPath.lineTo(W_in, L_straight_in)
  innerPath.bezierCurveTo(W_in, L_straight_in - offset_straight_in, R_port - offset_port_in, r_port_inner, R_port, r_port_inner)
  innerPath.absarc(R_port, 0, r_port_inner, 0.5 * Math.PI, -0.5 * Math.PI, true)
  innerPath.bezierCurveTo(R_port - offset_port_in, -r_port_inner, W_in, -L_straight_in + offset_straight_in, W_in, -L_straight_in)

  innerPath.closePath()
  shape.holes.push(innerPath)

  // ─────────────────────────────────────────────────────────────────────────────
  // 2 SEPARATE CIRCULAR PORT HOLES (CW Winding Order)
  // ONLY for Top and Bottom ports, since Left and Right are open to the center!
  // ─────────────────────────────────────────────────────────────────────────────
  for (const a of [Math.PI / 2, Math.PI * 1.5]) {
    const px = Math.cos(a) * R_port
    const py = Math.sin(a) * R_port
    const portHole = new THREE.Path()
    portHole.absarc(px, py, r_port_inner, 0, Math.PI * 2, true)
    shape.holes.push(portHole)
  }

  return shape
}

function _addPhotoCloverSealAt(parent, surfZ) {
  const side = surfZ >= 0 ? 1 : -1
  const mat = MaterialPresets.oRing()
  const geo = new THREE.ExtrudeGeometry(_makeWavySealShape(22, 4.5, 3.4), {
    depth: 1.2,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.25,
    bevelSegments: 3
  })
  geo.translate(0, 0, -0.6)
  const seal = new THREE.Mesh(geo, mat)
  seal.position.z = surfZ + side * 0.72
  parent.add(seal)

  const holeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.1, roughness: 0.9 })
  const holeGeo = new THREE.CylinderGeometry(2.4, 2.4, 1.4, 18)
  const holeR = 20.5
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const hole = new THREE.Mesh(holeGeo, holeMat)
    hole.rotation.x = Math.PI / 2
    hole.position.set(Math.cos(a) * holeR, Math.sin(a) * holeR, seal.position.z + side * 0.05)
    parent.add(hole)
  }
}

function _addPhotoCloverSeal(parent, gasketT) {
  _addPhotoCloverSealAt(parent, gasketT / 2)
}

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
function _addBrushedDiscLines(parent, radius, z, color = 0xbfc4c8) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  })
  for (let y = -radius + 7; y <= radius - 7; y += 3.2) {
    const half = Math.sqrt(Math.max(0, radius * radius - y * y)) - 4
    if (half <= 3) continue
    const geo = new THREE.BoxGeometry(half * 2, 0.12, 0.04)
    const line = new THREE.Mesh(geo, mat)
    line.position.set(0, y, z)
    parent.add(line)
  }
}

function _addBoltHoles(parent, thickness, count) {
  const c = CELL_CONFIG
  const pcdR = c.bolt.pcd / 2
  const hR = c.bolt.diameter / 2

  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x101010, metalness: 0.1, roughness: 0.9
  })
  const holeGeo = new THREE.CylinderGeometry(hR, hR, thickness * 1.1, 12)

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / count
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
function _addCoverHoleChamfers(parent, surfZ, count) {
  const c = CELL_CONFIG
  const side = surfZ >= 0 ? 1 : -1
  const pcdR = c.bolt.pcd / 2
  const boreR = c.bolt.diameter / 2
  const ringMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8bec3,
    metalness: 0.88,
    roughness: 0.24,
    envMapIntensity: 1.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.2
  })
  const stainMat = new THREE.MeshBasicMaterial({
    color: 0x2d3336,
    transparent: true,
    opacity: 0.24,
    depthWrite: false
  })
  const ringGeo = new THREE.TorusGeometry(boreR + 1.35, 0.28, 8, 28)
  const stainGeo = new THREE.TorusGeometry(boreR + 2.05, 0.18, 6, 30)

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / count
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR

    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.set(x, y, surfZ + side * 0.16)
    parent.add(ring)

    const stain = new THREE.Mesh(stainGeo, stainMat)
    stain.position.set(x, y, surfZ + side * 0.18)
    parent.add(stain)
  }
}

function _addPlateBoltHoles(parent, plateT) {
  const c = CELL_CONFIG
  const pcdR = c.bolt.pcd / 2
  const hR = c.bolt.diameter / 2

  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x101010, metalness: 0.1, roughness: 0.9
  })
  const holeGeo = new THREE.CylinderGeometry(hR, hR, plateT * 1.1, 12)

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8
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
  const mat = MaterialPresets.busLug()
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.3, roughness: 0.7 })
  const ringMat = MaterialPresets.nut()

  const lugW = c.lug.width
  const lugL = c.lug.length
  const holeR = c.lug.holeRadius || 2.5

  const shape = new THREE.Shape()
  const halfW = lugW / 2
  const neck = 3
  shape.moveTo(0, -halfW)
  shape.lineTo(lugL - halfW, -halfW)
  shape.absarc(lugL - halfW, 0, halfW, -Math.PI / 2, Math.PI / 2, false)
  shape.lineTo(0, halfW)
  shape.quadraticCurveTo(-neck, halfW, -neck, 0)
  shape.quadraticCurveTo(-neck, -halfW, 0, -halfW)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: plateT,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.25,
    bevelSegments: 2
  })
  geo.translate(0, 0, -plateT / 2)
  const lugMesh = new THREE.Mesh(geo, mat)
  lugMesh.castShadow = true

  const holeGeo = new THREE.CylinderGeometry(holeR, holeR, plateT * 1.3, 16)
  const hole = new THREE.Mesh(holeGeo, holeMat)
  hole.rotation.x = Math.PI / 2
  const ringGeo = new THREE.TorusGeometry(holeR + 0.75, 0.23, 8, 24)
  const ringTop = new THREE.Mesh(ringGeo, ringMat)
  const ringBottom = new THREE.Mesh(ringGeo, ringMat)

  if (isAnode) {
    lugMesh.position.set(-(plateR - 1), 0, 0)
    lugMesh.rotation.z = Math.PI
    hole.position.set(-(plateR + lugL - halfW - 1), 0, 0)
  } else {
    lugMesh.position.set(plateR - 1, 0, 0)
    hole.position.set(plateR + lugL - halfW - 1, 0, 0)
  }
  ringTop.position.set(hole.position.x, hole.position.y, plateT / 2 + 0.07)
  ringBottom.position.set(hole.position.x, hole.position.y, -plateT / 2 - 0.07)

  parent.add(lugMesh)
  parent.add(hole)
  parent.add(ringTop)
  parent.add(ringBottom)
}

// ─────────────────────────────────────────────────────────────────────────────
// 气液接头
// ─────────────────────────────────────────────────────────────────────────────
function _addGasPorts(parent, portFaceZ) {
  const mat = MaterialPresets.gasPort()
  const boreMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.1, roughness: 0.9 })
  const sealMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8e1d2,
    metalness: 0.0,
    roughness: 0.66,
    transparent: true,
    opacity: 0.78
  })

  // 4 elements arranged at 12, 3, 6, 9 o'clock.
  // 12, 3, 9 o'clock are push-in fittings.
  // 6 o'clock is a hex socket plug.
  const fittings = [
    { x: 0, y: 24 },      // 12 o'clock
    { x: 22, y: -8 },     // lower right
    { x: -22, y: -8 },    // lower left
  ]

  for (const p of fittings) {
    const sub = new THREE.Group()
    const hexR = 6.2
    const bodyR = 4.1
    const bodyH = 10.5

    const seal = new THREE.Mesh(new THREE.TorusGeometry(hexR + 1.4, 0.42, 8, 32), sealMat)
    seal.position.z = portFaceZ + 0.24
    sub.add(seal)

    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(hexR + 1, hexR + 1, 2, 20), mat)
    flange.rotation.x = Math.PI / 2
    flange.position.z = portFaceZ + 1
    sub.add(flange)

    const hexRadius = hexR / Math.cos(Math.PI / 6)
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(hexRadius, hexRadius, 7, 6), mat)
    hex.rotation.x = Math.PI / 2
    hex.position.z = portFaceZ + 4.5
    sub.add(hex)

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 16), mat)
    tube.rotation.x = Math.PI / 2
    tube.position.z = portFaceZ + 5 + bodyH / 2
    sub.add(tube)

    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyR * 0.62, bodyR * 0.62, 0.45, 16), boreMat)
    bore.rotation.x = Math.PI / 2
    bore.position.z = portFaceZ + 5 + bodyH + 2.25
    sub.add(bore)

    // Stainless steel cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(bodyR + 0.5, bodyR + 0.5, 2, 16), mat)
    cap.rotation.x = Math.PI / 2
    cap.position.z = portFaceZ + 5 + bodyH + 1
    sub.add(cap)

    sub.position.set(p.x, p.y, 0)
    parent.add(sub)
  }

}

function _addHexSocketPlug(parent, x, y, z) {
  const mat = MaterialPresets.gasPort()
  const boreMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.1, roughness: 0.9 })
  const plug = _makeHexSocketPlug(4.7, 3.5, mat, boreMat)
  plug.position.set(x, y, z)
  parent.add(plug)

  const sealMat = new THREE.MeshBasicMaterial({
    color: 0xddd3c4,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  })
  const seal = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.24, 8, 28), sealMat)
  seal.position.set(x, y, z - 1.9)
  parent.add(seal)
}

function _makeHexSocketPlug(radius, height, mat, boreMat) {
  const socketR = 2.0
  const circumR = socketR / Math.cos(Math.PI / 6)

  const outer = new THREE.Shape()
  outer.absarc(0, 0, radius, 0, Math.PI * 2, false)

  const hole = new THREE.Path()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const hx = Math.cos(a) * circumR
    const hy = Math.sin(a) * circumR
    if (i === 0) hole.moveTo(hx, hy)
    else hole.lineTo(hx, hy)
  }
  hole.closePath()
  outer.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(outer, { depth: height, bevelEnabled: false })
  geo.translate(0, 0, -height / 2)
  const mesh = new THREE.Mesh(geo, mat)

  const bottomGeo = new THREE.CylinderGeometry(socketR, socketR, 0.5, 6)
  const bottom = new THREE.Mesh(bottomGeo, boreMat)
  bottom.rotation.x = Math.PI / 2
  bottom.position.z = -height / 2 + 0.25

  const group = new THREE.Group()
  group.add(mesh, bottom)
  return group
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
    const angle = (i / bCfg.count) * Math.PI * 2 + Math.PI / bCfg.count
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

    for (let j = 0; j < 12; j++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(bCfg.diameter / 2 + 0.28, 0.11, 6, 18),
        threadMat
      )
      ring.position.set(x, y, topFace + 0.4 + j * 1.15)
      group.add(ring)
    }
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
    const angle = (i / bCfg.count) * Math.PI * 2 + Math.PI / bCfg.count
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
    const angle = (i / bCfg.count) * Math.PI * 2 + Math.PI / bCfg.count
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
