import { gsap } from 'gsap'

export const ExplosionConfig = {
  distance: 35,
  duration: 1.4,
  ease: 'power3.out',
  collapseDuration: 1.4,
  collapseEase: 'power3.inOut',
  tilt: 0
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

  // 爆炸时隐藏螺栓杆件
  if (layers.bolts) {
    layers.bolts.visible = false
  }

  // 统一间距：每层间隔 D，+Z侧向上，-Z侧向下
  // 所有阳极侧层(+Z) dir=1, 阴极侧层(-Z) dir=-1
  const explodeOrder = [
    // 核心层 — mesh在最上方最先弹出
    { key: 'mesh1',    dir: 1,  slot: 0 },
    // 薄垫片 — thinWhite2在mea下方，先于mea分离避免穿透
    { key: 'thinWhite2', dir: 1,  slot: 1 },
    { key: 'mea3',     dir: 1,  slot: 2 },
    { key: 'mea4',     dir: 1,  slot: 2 },
    { key: 'thinWhite1', dir: 1,  slot: 3 },
    // 极板
    { key: 'anodePlate',   dir: 1,  slot: 4 },
    { key: 'cathodePlate', dir: -1, slot: 4 },
    // 厚垫片
    { key: 'upperGasket', dir: 1,  slot: 5 },
    { key: 'lowerGasket', dir: -1, slot: 5 },
    // 端盖
    { key: 'topCover',    dir: 1,  slot: 6 },
    { key: 'bottomCover', dir: -1, slot: 6 },
    // 五金件（顶板上方）
    { key: 'flatWashers', dir: 1,  slot: 7 },
    { key: 'nuts',        dir: 1,  slot: 7 },
  ]

  explodeOrder.forEach(({ key, dir, slot }) => {
    const layer = layers[key]
    if (!layer) return
    const targetZ = orig[key] + dir * D * (slot + 1)
    tl.to(layer.position, {
      z: targetZ,
      duration: DT * 0.6,
      ease: 'power3.out'
    }, slot * 0.06)
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

  // 复位时显示螺栓杆件
  if (layers.bolts) {
    layers.bolts.visible = true
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
    { key: 'mea3',  idx: 5 },
    { key: 'mea4',  idx: 5 },
    { key: 'thinWhite2', idx: 6 },
    { key: 'mesh1', idx: 7 },
  ]

  collapseOrder.forEach(({ key, idx }) => {
    const layer = layers[key]
    if (!layer) return
    const origZ = orig[key] ?? 0
    tl.to(layer.position, { z: origZ, duration: d * 0.5, ease: 'power3.in' }, idx * 0.04)
  })

  return tl
}
