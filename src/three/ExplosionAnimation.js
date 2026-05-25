import { gsap } from 'gsap'

/**
 * 爆炸 / 复位动画 (GSAP) — 10 件 BOM 装配 (8 螺柱版).
 *
 * 坐标约定 (cellGroup.rotation.x = -Math.PI/2):
 *  +Z = 场景上方 = topCover + 螺母/垫圈端
 *  -Z = 场景下方 = bottomCover 端
 *
 * 装配中心: middleGasket (POM+MEA 复合件) Z=0
 *
 * 爆炸规则 — 各层远离 middleGasket 中心展开:
 *  bolts/nuts/flatWashers: +Z 大幅展开 (顶部五金件向上)
 *  topCover:               orig + D*2  (+Z, 场景顶)
 *  upperGasket:            orig + D    (+Z)
 *  anodePlate:             orig + D*0.6 (+Z)
 *  middleGasket/mea:       shock 效果 (缩放脉冲 + emissive 闪烁, 不移位)
 *  cathodePlate:           orig - D*0.6 (-Z)
 *  lowerGasket:            orig - D     (-Z)
 *  bottomCover:            orig - D*2   (-Z)
 */
export const ExplosionConfig = {
  distance: 45,
  duration: 1.2,
  ease: 'power3.out',
  collapseDuration: 1.0,
  collapseEase: 'power3.inOut',
  tilt: 0
}

export function explodeCell(cell, onComplete) {
  if (cell.userData._animTl) {
    cell.userData._animTl.kill()
    cell.userData._animTl = null
  }

  const layers = cell.userData.layers
  const orig   = cell.userData.originalPositions
  cell.userData.state = 'exploding'

  const D  = ExplosionConfig.distance
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

  // ── 螺柱 — 紧贴底板一起向 -Z (螺栓压入底板) ──────────────────────────
  if (layers.bolts) {
    tl.to(layers.bolts.position,
      { z: orig.bolts - D * 1.5, duration: DT, ease: 'power4.out' }, 0.12)
  }
  // ── 螺母/平垫圈 — 向 +Z (在顶板上方) ────────────────────────────────────
  if (layers.nuts) {
    tl.to(layers.nuts.position,
      { z: orig.nuts + D * 2, duration: DT, ease: 'power4.out' }, 0.04)
  }
  if (layers.flatWashers) {
    tl.to(layers.flatWashers.position,
      { z: orig.flatWashers + D * 1.8, duration: DT * 0.95, ease: 'power3.out' }, 0.08)
  }

  // ── 上铜端盖 (+Z, 场景顶) ─────────────────────────────────────────────────
  if (layers.topCover) {
    tl.to(layers.topCover.position,
      { z: orig.topCover + D * 1.5, duration: DT, ease: 'power4.out' }, 0.12)
  }

  // ── 上 POM 垫 (+Z) ────────────────────────────────────────────────────────
  if (layers.upperGasket) {
    tl.to(layers.upperGasket.position,
      { z: orig.upperGasket + D, duration: DT * 0.95, ease: 'power3.out' }, 0.16)
  }

  // ── 阳极板 (+Z 轻展开) ────────────────────────────────────────────────────
  if (layers.anodePlate) {
    tl.to(layers.anodePlate.position,
      { z: orig.anodePlate + D * 0.6, duration: DT * 0.9, ease: 'power3.out' }, 0.20)
  }

  // ── middleGasket (POM+MEA) — shock: 缩放脉冲 + emissive 闪烁 (留在中心) ──
  // layers.middleGasket 和 layers.mea 指向同一对象 (别名)
  const meaLayer = layers.middleGasket ?? layers.mea
  if (meaLayer) {
    // 缩放脉冲
    tl.to(meaLayer.scale,
      { x: 1.08, y: 1.08, z: 1.0, duration: 0.15, ease: 'power3.out' }, 0.34)
    tl.to(meaLayer.scale,
      { x: 1.00, y: 1.00, z: 1.0, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, 0.49)

    // emissive 闪烁 (group.material = gdlMat)
    const mat = meaLayer.material
    if (mat) {
      tl.to(mat, { emissiveIntensity: 1.8, duration: 0.18, ease: 'power3.out' }, 0.34)
      tl.to(mat, { emissiveIntensity: 0.03, duration: 0.7, ease: 'power2.inOut' }, 0.52)
    }

    // 边缘辉光 (group.userData.edge = edgeMat)
    const edgeMat = meaLayer.userData?.edge
    if (edgeMat) {
      tl.to(edgeMat, { opacity: 1.0, duration: 0.4, ease: 'power2.out' }, 0.34)
    }
  }

  // ── 阴极板 (-Z 轻展开) ────────────────────────────────────────────────────
  if (layers.cathodePlate) {
    tl.to(layers.cathodePlate.position,
      { z: orig.cathodePlate - D * 0.6, duration: DT * 0.9, ease: 'power3.out' }, 0.20)
  }

  // ── 下 POM 垫 (-Z) ────────────────────────────────────────────────────────
  if (layers.lowerGasket) {
    tl.to(layers.lowerGasket.position,
      { z: orig.lowerGasket - D, duration: DT * 0.95, ease: 'power3.out' }, 0.16)
  }

  // ── 下铜端盖 (-Z, 场景底) ─────────────────────────────────────────────────
  if (layers.bottomCover) {
    tl.to(layers.bottomCover.position,
      { z: orig.bottomCover - D * 1.5, duration: DT, ease: 'power4.out' }, 0.12)
  }

  return tl
}

export function collapseCell(cell, onComplete) {
  if (cell.userData._animTl) {
    cell.userData._animTl.kill()
    cell.userData._animTl = null
  }

  const layers = cell.userData.layers
  const orig   = cell.userData.originalPositions
  cell.userData.state = 'collapsing'

  const d = ExplosionConfig.collapseDuration
  const e = ExplosionConfig.collapseEase

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

  // 复位顺序: 由外向内 stagger
  // 注意: middleGasket 和 mea 是同一对象, 只复位一次
  const layerOrder = [
    'bottomCover',  'lowerGasket',
    'cathodePlate',
    'middleGasket',
    'anodePlate',
    'upperGasket',  'topCover',
    'flatWashers',  'nuts', 'bolts'
  ]

  layerOrder.forEach((key, idx) => {
    const layer = layers[key]
    if (!layer) return
    // 优先使用 originalPositions[key], 回退到 middleGasket 的原始 Z=0
    const origZ = orig[key] ?? 0
    tl.to(layer.position,
      { z: origZ, duration: d * (0.85 + idx * 0.01), ease: e },
      idx * 0.04)
  })

  // 复位 middleGasket/mea 缩放
  const meaLayer = layers.middleGasket ?? layers.mea
  if (meaLayer) {
    tl.to(meaLayer.scale,
      { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.inOut' }, 0)

    // 复位发光和边缘辉光
    const mat     = meaLayer.material
    const edgeMat = meaLayer.userData?.edge
    if (mat) {
      tl.to(mat, { emissiveIntensity: 0.03, duration: d, ease: 'power2.in' }, 0)
    }
    if (edgeMat) {
      tl.to(edgeMat, { opacity: 0.9, duration: d, ease: 'power2.in' }, 0)
    }
  }

  // 复位极板缩放 (保险)
  for (const key of ['anodePlate', 'cathodePlate']) {
    if (layers[key]) {
      tl.to(layers[key].scale,
        { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.inOut' }, 0)
    }
  }

  return tl
}
