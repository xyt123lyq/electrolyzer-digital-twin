import { gsap } from 'gsap'

export const ExplosionConfig = {
  distance: 35,
  duration: 1.4,          // 增加总时长
  ease: 'power3.out',
  collapseDuration: 1.4,  // 与爆炸时长一致
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

  // ========== 核心层先炸开（从内向外爆炸，对称分离）==========
  // Z=0 为中心，+Z 侧向 +Z 炸开，-Z 侧向 -Z 炸开
  // 拉伸网层 - mesh1 在顶层(+Z侧)向+Z，mesh2 在底层(-Z侧)向-Z（对称分开）
  if (layers.mesh1) {
    tl.to(layers.mesh1.position, { z: orig.mesh1 + D * 0.35, duration: DT * 0.5, ease: 'power3.out' }, 0.04)
  }
  if (layers.mesh2) {
    tl.to(layers.mesh2.position, { z: orig.mesh2 - D * 0.35, duration: DT * 0.5, ease: 'power3.out' }, 0.05)
    // mesh2 向 -Z 移动（对称分开，不是向+Z）
  }

  // MEA层 - mea1/mea2 在顶层(+Z侧)向+Z，mea3/mea4 在底层(-Z侧)向-Z（对称分开）
  if (layers.mea1) {
    tl.to(layers.mea1.position, { z: orig.mea1 + D * 0.30, duration: DT * 0.55, ease: 'power3.out' }, 0.08)
  }
  if (layers.mea2) {
    tl.to(layers.mea2.position, { z: orig.mea2 + D * 0.28, duration: DT * 0.55, ease: 'power3.out' }, 0.10)
  }
  if (layers.mea3) {
    tl.to(layers.mea3.position, { z: orig.mea3 - D * 0.28, duration: DT * 0.55, ease: 'power3.out' }, 0.10)
    // mea3 向 -Z（对称分开，不是向+Z）
  }
  if (layers.mea4) {
    tl.to(layers.mea4.position, { z: orig.mea4 - D * 0.30, duration: DT * 0.55, ease: 'power3.out' }, 0.08)
    // mea4 向 -Z（对称分开，不是向+Z）
  }

  // 薄垫片层 - thinWhite1/2 在顶层向+Z，thinWhite3/4 在底层向-Z（对称分开）
  if (layers.thinWhite1) {
    tl.to(layers.thinWhite1.position, { z: orig.thinWhite1 + D * 0.22, duration: DT * 0.6, ease: 'power3.out' }, 0.14)
  }
  if (layers.thinWhite2) {
    tl.to(layers.thinWhite2.position, { z: orig.thinWhite2 + D * 0.20, duration: DT * 0.6, ease: 'power3.out' }, 0.14)
  }
  if (layers.thinWhite3) {
    tl.to(layers.thinWhite3.position, { z: orig.thinWhite3 - D * 0.20, duration: DT * 0.6, ease: 'power3.out' }, 0.14)
  }
  if (layers.thinWhite4) {
    tl.to(layers.thinWhite4.position, { z: orig.thinWhite4 - D * 0.22, duration: DT * 0.65, ease: 'power3.out' }, 0.18)
  }

  // 黑色垫圈 - blackGasket1在顶层，blackGasket2在底层
  if (layers.blackGasket1) {
    tl.to(layers.blackGasket1.position, { z: orig.blackGasket1 + D * 0.18, duration: DT * 0.7, ease: 'power3.out' }, 0.22)
  }
  if (layers.blackGasket2) {
    tl.to(layers.blackGasket2.position, { z: orig.blackGasket2 - D * 0.18, duration: DT * 0.7, ease: 'power3.out' }, 0.22)
  }

  // ========== 中间层 ==========

  // 极板层 - anodePlate在顶层，cathodePlate在底层
  if (layers.anodePlate) {
    tl.to(layers.anodePlate.position, { z: orig.anodePlate + D * 0.45, duration: DT * 0.75, ease: 'power3.out' }, 0.28)
  }
  if (layers.cathodePlate) {
    tl.to(layers.cathodePlate.position, { z: orig.cathodePlate - D * 0.45, duration: DT * 0.75, ease: 'power3.out' }, 0.28)
  }

  // 厚垫片层
  if (layers.upperGasket) {
    tl.to(layers.upperGasket.position, { z: orig.upperGasket + D * 0.65, duration: DT * 0.85, ease: 'power3.out' }, 0.34)
  }
  if (layers.lowerGasket) {
    tl.to(layers.lowerGasket.position, { z: orig.lowerGasket - D * 0.65, duration: DT * 0.85, ease: 'power3.out' }, 0.34)
  }

  // ========== 外层五金件最后炸开 ==========

  // 端盖层
  if (layers.topCover) {
    tl.to(layers.topCover.position, { z: orig.topCover + D * 0.9, duration: DT * 0.9, ease: 'power4.out' }, 0.40)
  }
  if (layers.bottomCover) {
    tl.to(layers.bottomCover.position, { z: orig.bottomCover - D * 0.9, duration: DT * 0.9, ease: 'power4.out' }, 0.40)
  }

  // 平垫圈
  if (layers.flatWashers) {
    tl.to(layers.flatWashers.position, { z: orig.flatWashers + D * 1.1, duration: DT * 0.95, ease: 'power3.out' }, 0.44)
  }

  // 螺母
  if (layers.nuts) {
    tl.to(layers.nuts.position, { z: orig.nuts + D * 1.3, duration: DT, ease: 'power4.out' }, 0.46)
  }

  // 螺栓
  if (layers.bolts) {
    tl.to(layers.bolts.position, { z: orig.bolts + D * 1.5, duration: DT, ease: 'power4.out' }, 0.48)
  }

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

  // 从外向内复位 - 核心层最后归位（与爆炸镜像）
  // 爆炸: 外层先启动，核心层最后启动
  // 复位: 外层先归位，核心层最后归位
  const layerOrder = [
    // 五金件（最外层，先归位）
    { key: 'bolts', idx: 0 },
    { key: 'nuts', idx: 1 },
    { key: 'flatWashers', idx: 2 },
    // 端盖
    { key: 'topCover', idx: 3 },
    { key: 'bottomCover', idx: 4 },
    // 厚垫片
    { key: 'upperGasket', idx: 5 },
    { key: 'lowerGasket', idx: 6 },
    // 极板
    { key: 'anodePlate', idx: 7 },
    { key: 'cathodePlate', idx: 8 },
    // 黑色垫圈
    { key: 'blackGasket1', idx: 9 },
    { key: 'blackGasket2', idx: 10 },
    // 薄垫片
    { key: 'thinWhite1', idx: 11 },
    { key: 'thinWhite2', idx: 12 },
    { key: 'thinWhite3', idx: 13 },
    { key: 'thinWhite4', idx: 14 },
    // MEA层
    { key: 'mea1', idx: 15 },
    { key: 'mea2', idx: 16 },
    { key: 'mea3', idx: 17 },
    { key: 'mea4', idx: 18 },
    // 拉伸网（核心，最后归位）
    { key: 'mesh1', idx: 19 },
    { key: 'mesh2', idx: 20 }
  ]

  layerOrder.forEach(({ key, idx }) => {
    const layer = layers[key]
    if (!layer) return
    const origZ = orig[key] ?? 0
    // 紧凑的延迟节奏，外层快合拢，核心层最后精准归位
    tl.to(layer.position, { z: origZ, duration: d * (0.5 + idx * 0.02), ease: 'power3.in' }, idx * 0.02)
  })

  return tl
}
