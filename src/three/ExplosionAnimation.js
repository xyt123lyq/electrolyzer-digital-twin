import { gsap } from 'gsap'

export const ExplosionConfig = {
  distance: 12,
  duration: 1.4,
  ease: 'power3.out',
  collapseDuration: 1.4,
  collapseEase: 'power3.inOut',
  tilt: 0
}

// 精细控制每一层展开时的相对位移 (Z轴偏移)
// 让最中心的膜(mea3/mea4)与铁丝网(mesh1)保持极小的间距 (4.2)，形成完美的咬合结合感
// 让外侧的极板和垫圈等拥有舒适、均匀的展开间距 (各 10.0)
export const ExplodeOffsets = {
  mesh1: 0,
  
  mea3: 4.2,
  mea4: 4.2,
  
  thinWhite1: 14.2,
  thinWhite2: 14.2,
  
  anodePlate: 24.2,
  cathodePlate: 24.2,
  
  upperGasket: 34.2,
  lowerGasket: 34.2,
  
  topCover: 44.2,
  bottomCover: 44.2,
  
  flatWashers: 54.2,
  nuts: 54.2
}

// 所有阳极侧层(+Z) dir=1, 阴极侧层(-Z) dir=-1
export const ExplodeOrder = [
  // 核心中置层 (保持中心位置不动)
  { key: 'mesh1',        dir: 1,  slot: -1 },
  
  // 阳极侧 (+Z，向上移动)
  { key: 'mea3',         dir: 1,  slot: 0 },
  { key: 'thinWhite1',   dir: 1,  slot: 1 },
  { key: 'anodePlate',   dir: 1,  slot: 2 },
  { key: 'upperGasket',  dir: 1,  slot: 3 },
  { key: 'topCover',     dir: 1,  slot: 4 },
  { key: 'flatWashers',  dir: 1,  slot: 5 },
  { key: 'nuts',         dir: 1,  slot: 5 },

  // 阴极侧 (-Z，向下移动)
  { key: 'mea4',         dir: -1, slot: 0 },
  { key: 'thinWhite2',   dir: -1, slot: 1 },
  { key: 'cathodePlate', dir: -1, slot: 2 },
  { key: 'lowerGasket',  dir: -1, slot: 3 },
  { key: 'bottomCover',  dir: -1, slot: 4 },
]

export function updateExplosionDistance(cell, scale) {
  cell.userData.explosionScale = scale

  // 如果当前处于已经完全展开的状态（state === 'exploded'），直接物理位移刷新，零延迟
  if (cell.userData.state === 'exploded') {
    const layers = cell.userData.layers
    const orig = cell.userData.originalPositions
    ExplodeOrder.forEach(({ key, dir }) => {
      const layer = layers[key]
      if (!layer) return
      const offset = ExplodeOffsets[key] ?? 0
      layer.position.z = orig[key] + dir * offset * scale
    })
  }
}

export function explodeCell(cell, onComplete) {
  if (cell.userData._animTl) {
    cell.userData._animTl.kill()
    cell.userData._animTl = null
  }

  const layers = cell.userData.layers
  const orig = cell.userData.originalPositions
  cell.userData.state = 'exploding'

  const D = ExplosionConfig.distance
  const DT = ExplosionConfig.duration

  const tl = gsap.timeline({
    onComplete: () => {
      if (cell.userData._animTl === tl) {
        cell.userData.state = 'exploded'
        cell.userData._animTl = null
        onComplete && onComplete()
      }
    }
  })
  cell.userData._animTl = tl

  // 爆炸时隐藏螺丝、螺帽、螺杆、顶盖板和底盖板
  if (layers.bolts) {
    layers.bolts.visible = false
  }
  if (layers.topCover) {
    layers.topCover.visible = false
  }
  if (layers.bottomCover) {
    layers.bottomCover.visible = false
  }
  if (layers.nuts) {
    layers.nuts.visible = false
  }
  if (layers.flatWashers) {
    layers.flatWashers.visible = false
  }

  const scale = cell.userData.explosionScale ?? 1.0

  ExplodeOrder.forEach(({ key, dir, slot }) => {
    const layer = layers[key]
    if (!layer) return
    const offset = ExplodeOffsets[key] ?? 0
    const targetZ = orig[key] + dir * offset * scale
    tl.to(layer.position, {
      z: targetZ,
      duration: DT * 0.6,
      ease: 'power3.out'
    }, (slot + 1) * 0.06)
  })

  return tl
}

export function collapseCell(cell, onComplete) {
  if (cell.userData._animTl) {
    cell.userData._animTl.kill()
    cell.userData._animTl = null
  }

  const layers = cell.userData.layers
  const orig = cell.userData.originalPositions
  cell.userData.state = 'collapsing'

  const d = ExplosionConfig.collapseDuration

  const tl = gsap.timeline({
    onComplete: () => {
      if (cell.userData._animTl === tl) {
        cell.userData.state = 'closed'
        cell.userData._animTl = null
        onComplete && onComplete()
      }
    }
  })
  cell.userData._animTl = tl

  // 复位时恢复显示螺丝、螺帽、螺杆、顶盖板和底盖板
  if (layers.bolts) {
    layers.bolts.visible = true
  }
  if (layers.topCover) {
    layers.topCover.visible = true
  }
  if (layers.bottomCover) {
    layers.bottomCover.visible = true
  }
  if (layers.nuts) {
    layers.nuts.visible = true
  }
  if (layers.flatWashers) {
    layers.flatWashers.visible = true
  }

  // 从外向内复位
  const collapseOrder = [
    { key: 'nuts',        idx: 0 },
    { key: 'flatWashers', idx: 0 },
    { key: 'topCover',    idx: 1 },
    { key: 'bottomCover', idx: 1 },
    { key: 'upperGasket', idx: 2 },
    { key: 'lowerGasket', idx: 2 },
    { key: 'anodePlate',   idx: 3 },
    { key: 'cathodePlate', idx: 3 },
    { key: 'thinWhite1', idx: 4 },
    { key: 'thinWhite2', idx: 4 },
    { key: 'mea3',  idx: 5 },
    { key: 'mea4',  idx: 5 },
    { key: 'mesh1', idx: 5 },
  ]

  collapseOrder.forEach(({ key, idx }) => {
    const layer = layers[key]
    if (!layer) return
    const origZ = orig[key] ?? 0
    tl.to(layer.position, { z: origZ, duration: d * 0.5, ease: 'power3.in' }, idx * 0.04)
  })

  return tl
}
