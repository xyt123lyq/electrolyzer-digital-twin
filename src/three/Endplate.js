import * as THREE from 'three'
import { MaterialPresets } from './Materials.js'
import { CELL_CONFIG } from './CellGenerator.js'

/**
 * 端板 + 螺栓阵列 + 铜接线柱 — 严格按实物视频建模.
 *
 * 实物特征:
 *  - 顶/底绿色八角形端板(倒角矩形, 比电堆外形大一圈)
 *  - 端板沿四边一圈 ~14 颗六角螺母(短拉杆穿过电堆)
 *  - 顶端板上有 2-3 个白色塑料快插接头(气体出口)
 *  - 两侧伸出叠层铜排接线柱(2 片厚铜板叠加, 各带 2 个螺栓孔)
 */
export const ENDPLATE_CONFIG = {
  thickness: 14,
  margin: 9,              // 端板比 cell 外形大一圈的量(单边)
  chamfer: 7,             // 八角形倒角
  nutHeight: 3,
  nutRadius: 4.2,
  rodRadius: 2.4,
  longSideBolts: 5,
  shortSideBolts: 4,
  terminal: {
    plateThick: 3,
    plateW: 16,
    plateLen: 38,
    gap: 2,
    holeRadius: 1.6,
    holeCount: 2
  },
  quickConnect: {
    bodyRadius: 4.5,
    bodyHeight: 18,
    flangeRadius: 6,
    coneRadius: 3.4,
    coneHeight: 5
  }
}

export function buildEndplateAssembly(stackSpan) {
  const group = new THREE.Group()
  group.name = 'EndplateAssembly'

  const W = CELL_CONFIG.width
  const H = CELL_CONFIG.height
  const ep = ENDPLATE_CONFIG

  const platedW = W + ep.margin * 2
  const platedH = H + ep.margin * 2

  // ---- 顶 / 底端板 (八角形) ----
  const plateShape = octagonShape(platedW, platedH, ep.chamfer)
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: ep.thickness,
    bevelEnabled: true,
    bevelSize: 0.7,
    bevelThickness: 0.5,
    bevelSegments: 2,
    curveSegments: 1
  })
  plateGeo.translate(0, 0, -ep.thickness / 2)

  const topPlate = new THREE.Mesh(plateGeo, MaterialPresets.endplate())
  topPlate.name = 'endplate_top'
  topPlate.position.z = stackSpan / 2 + ep.thickness / 2
  topPlate.castShadow = true
  topPlate.receiveShadow = true
  group.add(topPlate)

  const bottomPlate = new THREE.Mesh(plateGeo, MaterialPresets.endplate())
  bottomPlate.name = 'endplate_bottom'
  bottomPlate.position.z = -(stackSpan / 2 + ep.thickness / 2)
  bottomPlate.castShadow = true
  bottomPlate.receiveShadow = true
  group.add(bottomPlate)

  // ---- 螺栓位置(沿端板边缘一圈) ----
  const boltPositions = ringBoltPositions(platedW, platedH, ep)

  const totalSpan = stackSpan + ep.thickness * 2
  const rodGeo = new THREE.CylinderGeometry(ep.rodRadius, ep.rodRadius, totalSpan + ep.nutHeight, 12)
  // 六角螺母: Shape (六边形 + 圆孔) → ExtrudeGeometry
  const hexShape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const hx = Math.cos(a) * ep.nutRadius
    const hy = Math.sin(a) * ep.nutRadius
    if (i === 0) hexShape.moveTo(hx, hy)
    else hexShape.lineTo(hx, hy)
  }
  hexShape.closePath()
  const holePath = new THREE.Path()
  holePath.absarc(0, 0, ep.rodRadius, 0, Math.PI * 2, false)
  hexShape.holes.push(holePath)
  const nutGeo = new THREE.ExtrudeGeometry(hexShape, {
    depth: ep.nutHeight, bevelEnabled: false
  })
  nutGeo.translate(0, 0, -ep.nutHeight / 2)

  const rodMat = MaterialPresets.bolt()
  const nutMat = MaterialPresets.nut()

  for (const [x, y] of boltPositions) {
    const rod = new THREE.Mesh(rodGeo, rodMat)
    rod.rotation.x = Math.PI / 2
    rod.position.set(x, y, 0)
    group.add(rod)

    const nutTop = new THREE.Mesh(nutGeo, nutMat)
    nutTop.position.set(x, y, totalSpan / 2 + ep.nutHeight / 2)
    group.add(nutTop)

    const nutBot = new THREE.Mesh(nutGeo, nutMat)
    nutBot.position.set(x, y, -(totalSpan / 2 + ep.nutHeight / 2))
    group.add(nutBot)
  }

  // ---- 顶板的 3 个白色塑料快插接头 ----
  buildQuickConnects(group, topPlate.position.z + ep.thickness / 2)

  // ---- 两侧叠层铜排接线柱 ----
  buildCopperTerminal(group, +1,  ep.terminal, topPlate.position.z - ep.thickness)
  buildCopperTerminal(group, -1,  ep.terminal, bottomPlate.position.z + ep.thickness)

  group.userData = { topPlate, bottomPlate }
  return group
}

// ---------- helpers ----------

function octagonShape(w, h, c) {
  const s = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  s.moveTo(-hw + c, -hh)
  s.lineTo( hw - c, -hh)
  s.lineTo( hw,     -hh + c)
  s.lineTo( hw,      hh - c)
  s.lineTo( hw - c,  hh)
  s.lineTo(-hw + c,  hh)
  s.lineTo(-hw,      hh - c)
  s.lineTo(-hw,     -hh + c)
  s.closePath()
  return s
}

function ringBoltPositions(w, h, ep) {
  const hw = w / 2
  const hh = h / 2
  const inset = 4.5
  const positions = []

  for (let i = 0; i < ep.longSideBolts; i++) {
    const t = i / (ep.longSideBolts - 1)
    const x = -hw + inset + t * (w - inset * 2)
    positions.push([x,  hh - inset])
    positions.push([x, -hh + inset])
  }
  for (let i = 1; i < ep.shortSideBolts - 1; i++) {
    const t = i / (ep.shortSideBolts - 1)
    const y = -hh + inset + t * (h - inset * 2)
    positions.push([ hw - inset, y])
    positions.push([-hw + inset, y])
  }
  return positions
}

function buildQuickConnects(group, topZ) {
  const ep = ENDPLATE_CONFIG.quickConnect
  const layout = [
    { x: -22, y: 14, color: 0xeaeaea },
    { x:  10, y: 14, color: 0xeaeaea },
    { x:  -8, y: -10, color: 0xdadbdf }
  ]
  for (const cfg of layout) {
    const sub = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.color, metalness: 0.1, roughness: 0.55
    })
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(ep.flangeRadius, ep.flangeRadius, 1.5, 16),
      mat
    )
    flange.rotation.x = Math.PI / 2
    flange.position.z = 1.0
    sub.add(flange)
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(ep.bodyRadius, ep.bodyRadius, ep.bodyHeight, 16),
      mat
    )
    body.rotation.x = Math.PI / 2
    body.position.z = 1.0 + ep.bodyHeight / 2 + 0.75
    sub.add(body)
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(ep.coneRadius, ep.coneHeight, 16),
      MaterialPresets.nut()
    )
    cone.rotation.x = Math.PI / 2
    cone.position.z = body.position.z + ep.bodyHeight / 2 + ep.coneHeight / 2
    sub.add(cone)
    sub.position.set(cfg.x, cfg.y, topZ)
    group.add(sub)
  }
}

function buildCopperTerminal(group, side, t, anchorZ) {
  const xBase = (CELL_CONFIG.width / 2 + ENDPLATE_CONFIG.margin) * side
  const dirX = side
  const sub = new THREE.Group()
  sub.name = 'terminal_' + (side > 0 ? 'pos' : 'neg')

  const plateGeo = new THREE.BoxGeometry(t.plateLen, t.plateW, t.plateThick)
  const plateMat = MaterialPresets.copperTerminal()
  const offsetX = dirX * (t.plateLen / 2 + 2)

  const yLevels = [t.gap / 2 + t.plateThick / 2, -(t.gap / 2 + t.plateThick / 2)]
  for (const dy of yLevels) {
    const plate = new THREE.Mesh(plateGeo, plateMat)
    plate.position.set(offsetX, 0, dy)
    sub.add(plate)
    for (let i = 0; i < t.holeCount; i++) {
      const u = (i + 0.5) / t.holeCount
      const xHole = offsetX - dirX * (t.plateLen / 2) + dirX * u * t.plateLen
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(t.holeRadius, t.holeRadius, t.plateThick + 0.4, 14),
        MaterialPresets.port()
      )
      hole.rotation.x = Math.PI / 2
      hole.position.set(xHole, 0, dy)
      sub.add(hole)
    }
  }

  const rootGeo = new THREE.BoxGeometry(6, t.plateW + 2, t.gap + t.plateThick * 2 + 2)
  const rootMat = MaterialPresets.copperTerminal()
  const root = new THREE.Mesh(rootGeo, rootMat)
  root.position.set(dirX * (CELL_CONFIG.width / 2 + ENDPLATE_CONFIG.margin + 2), 0, 0)
  sub.add(root)

  sub.position.z = anchorZ + ((anchorZ > 0) ? -3 : 3)
  group.add(sub)
}
