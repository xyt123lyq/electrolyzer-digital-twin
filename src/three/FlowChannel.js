import * as THREE from 'three'
import { CELL_CONFIG } from './CellGenerator.js'
import { MaterialPresets } from './Materials.js'

/**
 * 蛇形(S 型)流道:
 *   - 通道宽 2mm, 深 1mm, 行间距 2mm
 *   - 真实建模: 沿一条 CatmullRomCurve3 用 TubeGeometry 拉伸
 *   - 同一条曲线被复用驱动粒子流动
 */
const CHANNEL_RADIUS = 1.0       // tube 半径 ≈ 通道宽/2
const ROW_GAP = 2                // 通道间隔
const MARGIN = 10                // 距离板边缘的留白

export function buildSerpentinePath() {
  const W = CELL_CONFIG.width
  const H = CELL_CONFIG.height
  const usableW = W - MARGIN * 2
  const usableH = H - MARGIN * 2
  const rowH = CHANNEL_RADIUS * 2 + ROW_GAP
  const numRows = Math.max(4, Math.floor(usableH / rowH))

  const xL = -usableW / 2
  const xR = usableW / 2
  const points = []
  const cornerInset = rowH / 2

  let y = -usableH / 2 + rowH / 2
  for (let i = 0; i < numRows; i++) {
    const goingRight = i % 2 === 0
    const x0 = goingRight ? xL : xR
    const x1 = goingRight ? xR : xL

    // 直线段起点
    points.push(new THREE.Vector3(x0, y, 0))
    // 直线段终点(留少量空间画 U 弯)
    points.push(new THREE.Vector3(x1, y, 0))

    // U 弯过渡: 用 4 个点形成圆弧
    if (i < numRows - 1) {
      const nextY = y + rowH
      const arcX = x1
      const turnDir = goingRight ? 1 : -1
      points.push(new THREE.Vector3(arcX + turnDir * cornerInset * 0.4, y + rowH * 0.25, 0))
      points.push(new THREE.Vector3(arcX + turnDir * cornerInset * 0.6, y + rowH * 0.5, 0))
      points.push(new THREE.Vector3(arcX + turnDir * cornerInset * 0.4, y + rowH * 0.75, 0))
      points.push(new THREE.Vector3(x1, nextY, 0))
    }
    y += rowH
  }
  return points
}

export function buildChannelMesh() {
  const pts = buildSerpentinePath()
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05)
  const tubularSegments = Math.min(1200, pts.length * 6)
  const geo = new THREE.TubeGeometry(curve, tubularSegments, CHANNEL_RADIUS, 8, false)
  const mesh = new THREE.Mesh(geo, MaterialPresets.channel())
  mesh.name = 'flowChannel'
  mesh.userData.curve = curve
  mesh.visible = false
  return mesh
}

export function buildFlowParticles(curve, count = 280) {
  const positions = new Float32Array(count * 3)
  const progress = new Float32Array(count)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    progress[i] = Math.random()
    speeds[i] = 0.12 + Math.random() * 0.18
    const p = curve.getPointAt(progress[i])
    positions[i * 3]     = p.x
    positions[i * 3 + 1] = p.y
    positions[i * 3 + 2] = p.z
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = MaterialPresets.particle()
  const points = new THREE.Points(geo, mat)
  points.name = 'flowParticles'
  points.userData = { curve, progress, speeds, count }
  points.visible = false
  return points
}

export function updateFlowParticles(points, delta) {
  if (!points.visible) return
  const { curve, progress, speeds, count } = points.userData
  const arr = points.geometry.attributes.position.array
  for (let i = 0; i < count; i++) {
    progress[i] += delta * speeds[i]
    if (progress[i] >= 1) progress[i] -= 1
    const p = curve.getPointAt(progress[i])
    arr[i * 3]     = p.x
    arr[i * 3 + 1] = p.y
    arr[i * 3 + 2] = p.z
  }
  points.geometry.attributes.position.needsUpdate = true
}
