import { readFileSync, writeFileSync } from 'fs'

const path = 'C:\\Users\\LYQDZH\\Desktop\\电解水\\三层电解槽\\src\\three\\CellGenerator.js'
let content = readFileSync(path, 'utf8')

// ── Change 1: _addCloverOring — replace pts array + fix tubeRadius ────────────
const OLD_CLOVER_PTS = `  // 控制点: 四叶花型 — 4 个瓣(N/S/E/W) + 瓣间凹陷 + 上下窄通道
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
  ]`

const NEW_CLOVER_PTS = `  // 等大四叶花型 — 4 个瓣完全对称 (N/E/S/W), 鞍部内缩
  // 实物照片显示 4 个瓣大小相等, 上下左右完全对称
  const R0 = 16    // lobe tip radius
  const Ri = 7.5   // saddle inward radius (pinch between lobes)

  const pts = [
    new THREE.Vector3(0, R0, 0),
    new THREE.Vector3(Ri, Ri, 0),
    new THREE.Vector3(R0, 0, 0),
    new THREE.Vector3(Ri, -Ri, 0),
    new THREE.Vector3(0, -R0, 0),
    new THREE.Vector3(-Ri, -Ri, 0),
    new THREE.Vector3(-R0, 0, 0),
    new THREE.Vector3(-Ri, Ri, 0),
  ]`

if (!content.includes(OLD_CLOVER_PTS)) {
  console.error('CHANGE 1a (pts) MATCH FAILED')
  process.exit(1)
}
content = content.replace(OLD_CLOVER_PTS, NEW_CLOVER_PTS)

// Fix tubeRadius comment + value in _addCloverOring
const OLD_TUBE_1 = `  // TubeGeometry(path, tubularSegments, tubeRadius, radialSegments, closed)
  // tubeRadius=1.8 → 截面直径 3.6mm, 匹配实物粗壮橡胶环
  const geo  = new THREE.TubeGeometry(curve, 120, 1.8, 10, true)`
const NEW_TUBE_1 = `  // TubeGeometry(path, tubularSegments, tubeRadius, radialSegments, closed)
  // tubeRadius=2.0 → 截面直径 4.0mm, 匹配实物粗壮橡胶环
  const geo  = new THREE.TubeGeometry(curve, 120, 2.0, 10, true)`

if (!content.includes(OLD_TUBE_1)) {
  console.error('CHANGE 1b (tubeRadius) MATCH FAILED')
  process.exit(1)
}
content = content.replace(OLD_TUBE_1, NEW_TUBE_1)
console.log('Change 1 done')

// ── Change 2: _addPlateORing — symmetric pts + tubeRadius 2.0→2.4, radial 10→12 ──
const OLD_PLATE_ORING = `  const S = 0.92
  const pts = [
    new THREE.Vector3(S * 0, S * 22, 0),
    new THREE.Vector3(S * 3, S * 19, 0),
    new THREE.Vector3(S * 4, S * 15, 0),
    new THREE.Vector3(S * 6, S * 11, 0),
    new THREE.Vector3(S * 7, S * 8, 0),
    new THREE.Vector3(S * 11, S * 6, 0),
    new THREE.Vector3(S * 15, S * 3, 0),
    new THREE.Vector3(S * 17, S * 0, 0),
    new THREE.Vector3(S * 15, S * -3, 0),
    new THREE.Vector3(S * 11, S * -6, 0),
    new THREE.Vector3(S * 7, S * -8, 0),
    new THREE.Vector3(S * 6, S * -11, 0),
    new THREE.Vector3(S * 4, S * -15, 0),
    new THREE.Vector3(S * 3, S * -19, 0),
    new THREE.Vector3(S * 0, S * -22, 0),
    new THREE.Vector3(S * -3, S * -19, 0),
    new THREE.Vector3(S * -4, S * -15, 0),
    new THREE.Vector3(S * -6, S * -11, 0),
    new THREE.Vector3(S * -7, S * -8, 0),
    new THREE.Vector3(S * -11, S * -6, 0),
    new THREE.Vector3(S * -15, S * -3, 0),
    new THREE.Vector3(S * -17, S * 0, 0),
    new THREE.Vector3(S * -15, S * 3, 0),
    new THREE.Vector3(S * -11, S * 6, 0),
    new THREE.Vector3(S * -7, S * 8, 0),
    new THREE.Vector3(S * -6, S * 11, 0),
    new THREE.Vector3(S * -4, S * 15, 0),
    new THREE.Vector3(S * -3, S * 19, 0),
  ]

  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.35)
  const geo   = new THREE.TubeGeometry(curve, 120, 2.0, 10, true)`

const NEW_PLATE_ORING = `  const S = 0.92
  const R0 = 16 * S
  const Ri = 7.5 * S
  const pts = [
    new THREE.Vector3(0, R0, 0),
    new THREE.Vector3(Ri, Ri, 0),
    new THREE.Vector3(R0, 0, 0),
    new THREE.Vector3(Ri, -Ri, 0),
    new THREE.Vector3(0, -R0, 0),
    new THREE.Vector3(-Ri, -Ri, 0),
    new THREE.Vector3(-R0, 0, 0),
    new THREE.Vector3(-Ri, Ri, 0),
  ]

  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.35)
  const geo   = new THREE.TubeGeometry(curve, 120, 2.4, 12, true)`

if (!content.includes(OLD_PLATE_ORING)) {
  console.error('CHANGE 2 MATCH FAILED')
  process.exit(1)
}
content = content.replace(OLD_PLATE_ORING, NEW_PLATE_ORING)
console.log('Change 2 done')

// ── Change 3: _addPlateInnerHoles — 8 holes R=18 ─────────────────────────────
const OLD_INNER = `function _addPlateInnerHoles(parent, plateT) {
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x060808, metalness: 0.15, roughness: 0.90
  })
  const holeGeo = new THREE.CylinderGeometry(1.2, 1.2, plateT * 1.06, 10)

  const count = 4
  const pcdR = 6
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / 4
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR
    const hole = new THREE.Mesh(holeGeo, holeMat)
    hole.rotation.x = Math.PI / 2
    hole.position.set(x, y, 0)
    parent.add(hole)
  }
}`

const NEW_INNER = `function _addPlateInnerHoles(parent, plateT) {
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x060808, metalness: 0.15, roughness: 0.90
  })
  const holeGeo = new THREE.CylinderGeometry(1.5, 1.5, plateT * 1.06, 14)
  const count = 8
  const pcdR = 18
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / 10
    const x = Math.cos(angle) * pcdR
    const y = Math.sin(angle) * pcdR
    const hole = new THREE.Mesh(holeGeo, holeMat)
    hole.rotation.x = Math.PI / 2
    hole.position.set(x, y, 0)
    parent.add(hole)
  }
}`

if (!content.includes(OLD_INNER)) {
  console.error('CHANGE 3 MATCH FAILED')
  process.exit(1)
}
content = content.replace(OLD_INNER, NEW_INNER)
console.log('Change 3 done')

// ── Change 4: _addMountingLug — -Y, single hole, square ─────────────────────
const OLD_LUG = `function _addMountingLug(parent, plateR, plateT, isAnode) {
  const lug = CELL_CONFIG.lug
  const mat = MaterialPresets.conductive()
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.3, roughness: 0.7 })
  const side = isAnode ? 1 : -1

  // 使用 18mm 伸出长度, 12mm 宽度 (比 config 中 10mm 更宽以匹配实物)
  const lugLength = 18
  const lugWidth  = 12

  const lugMesh = new THREE.Mesh(
    new THREE.BoxGeometry(lugLength, lugWidth, plateT), mat)
  lugMesh.position.set(side * (plateR + lugLength / 2 - 1), 0, 0)
  lugMesh.castShadow = true
  parent.add(lugMesh)

  // 耳片伸出段起始 X (极板边缘)
  const lugStartX = side * (plateR - 1)

  const holeGeo = new THREE.CylinderGeometry(lug.holeRadius, lug.holeRadius, plateT * 1.3, 16)

  // 第一孔: 伸出段 40% 处
  const hole1 = new THREE.Mesh(holeGeo, holeMat)
  hole1.rotation.x = Math.PI / 2
  hole1.position.set(lugStartX + side * lugLength * 0.40, 0, 0)
  parent.add(hole1)

  // 第二孔: 伸出段 75% 处
  const hole2 = new THREE.Mesh(holeGeo, holeMat)
  hole2.rotation.x = Math.PI / 2
  hole2.position.set(lugStartX + side * lugLength * 0.75, 0, 0)
  parent.add(hole2)
}`

const NEW_LUG = `function _addMountingLug(parent, plateR, plateT, isAnode) {
  const mat = MaterialPresets.conductive()
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.3, roughness: 0.7 })

  const lugW = 14
  const lugL = 14
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
}`

if (!content.includes(OLD_LUG)) {
  console.error('CHANGE 4 MATCH FAILED')
  process.exit(1)
}
content = content.replace(OLD_LUG, NEW_LUG)
console.log('Change 4 done')

// ── Change 5: _makeFlatWashers — bolt() → nut() ──────────────────────────────
// Must only replace the one inside _makeFlatWashers, not the one in _makeBolts
const OLD_WASHER_MAT = `  const mat     = MaterialPresets.bolt()`
const NEW_WASHER_MAT = `  const mat     = MaterialPresets.nut()`

if (!content.includes(OLD_WASHER_MAT)) {
  console.error('CHANGE 5 MATCH FAILED')
  process.exit(1)
}
content = content.replace(OLD_WASHER_MAT, NEW_WASHER_MAT)
console.log('Change 5 done')

writeFileSync(path, content, 'utf8')
console.log('All 5 changes written successfully. Final length:', content.length)
