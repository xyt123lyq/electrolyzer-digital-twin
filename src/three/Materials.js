import * as THREE from 'three'

export const MaterialPresets = {

  // BOM #1/#3/#4 螺栓杆 — 实物: 不锈钢光亮杆, 金属光泽
  bolt() {
    return new THREE.MeshPhysicalMaterial({
      color: 0x9a9da2,
      metalness: 0.90,
      roughness: 0.28,
      envMapIntensity: 1.2,
      clearcoat: 0.15,
      clearcoatRoughness: 0.3
    })
  },

  // 螺柱轴身 — 实物: 不锈钢外露螺纹
  boltShaft() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xb8bcc0,
      metalness: 0.92,
      roughness: 0.24,
      envMapIntensity: 1.4,
      clearcoat: 0.22,
      clearcoatRoughness: 0.22
    })
  },

  // BOM #2 不锈钢螺母 — 六角锻造面, 镀铬光泽
  nut() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xb6b4ad,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.55,
      clearcoat: 0.28,
      clearcoatRoughness: 0.2
    })
  },

  // BOM #5/#11 紫铜端盖 — 实物: 暖玫瑰金, 磨砂/缎面质感
  endplate() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xd2a08c,
      metalness: 0.72,
      roughness: 0.60,
      envMapIntensity: 0.9,
      clearcoat: 0.06,
      clearcoatRoughness: 0.55,
      emissive: 0x100504,
      emissiveIntensity: 0.025,
      sheen: 0.16,
      sheenColor: new THREE.Color(0xffe4d4),
      sheenRoughness: 0.55
    })
  },

  copperTerminal() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xd08858,
      metalness: 0.90,
      roughness: 0.22,
      envMapIntensity: 1.6,
      clearcoat: 0.4,
      clearcoatRoughness: 0.12
    })
  },

  // BOM #6/#10 POM白色绝缘垫片 — 工程塑料: 暖白色, 蜡质光泽
  flowPlate() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xfbfbf9,           // Off-white/cream white (never pure #ffffff)
      metalness: 0.05,
      roughness: 0.35,          // Satin surface finish
      envMapIntensity: 0.8,
      clearcoat: 0.1,           // Slight protective sheen
      clearcoatRoughness: 0.4,
      transmission: 0.0,       // Subtle edge translucency
      thickness: 0.0,           // Simulates physical edge refraction
      ior: 1.48
    })
  },

  // 薄垫片用 — 暖白色POM，无transmission
  thinGasket() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xfbfbf9,           // Matching premium Teflon PTFE
      metalness: 0.05,
      roughness: 0.35,
      envMapIntensity: 0.8,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4,
      transmission: 0.0,        // Slightly less transmission for thinner sheets
      thickness: 0.0,
      ior: 1.48
    })
  },

  // O形圈 — 丁腈橡胶: 哑光黑, 微弹性光泽
  gasket() {
    return new THREE.MeshPhysicalMaterial({
      color: 0x151515,          // Deep charcoal black (never pure #000000)
      metalness: 0.05,
      roughness: 0.60,          // Dull, scattering surface
      envMapIntensity: 0.6,
      clearcoat: 0.08,          // Slight surface lubrication/sheen
      clearcoatRoughness: 0.65,
      sheen: 0.2,
      sheenColor: new THREE.Color(0x2b2b2b),
      sheenRoughness: 0.8
    })
  },

  // BOM #7/#9 阳极/阴极板 — 实物: 暗钛灰色拉丝金属
  conductive() {
    return new THREE.MeshPhysicalMaterial({
      color: 0x909498,
      metalness: 0.88,
      roughness: 0.42,
      envMapIntensity: 1.2,
      clearcoat: 0.15,
      clearcoatRoughness: 0.3
    })
  },

  // 极板耳片
  busLug() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xb4bcc4,
      metalness: 0.90,
      roughness: 0.33,
      envMapIntensity: 1.2,
      clearcoat: 0.15,
      clearcoatRoughness: 0.3
    })
  },

  // BOM #8 MEA碳纸电极 — 碳纤维纸: 极粗糙哑光, 有细微纤维散射
  gdl() {
    return new THREE.MeshPhysicalMaterial({
      color: 0x222222,
      metalness: 0.02,
      roughness: 0.92,
      envMapIntensity: 0.3,
      sheen: 0.5,
      sheenColor: new THREE.Color(0x444444),
      sheenRoughness: 0.9,
      emissive: 0x080808,
      emissiveIntensity: 0.03
    })
  },

  catalyst() {
    return new THREE.MeshPhysicalMaterial({
      color: 0x252525,
      metalness: 0.10,
      roughness: 0.85,
      envMapIntensity: 0.4,
      sheen: 0.3,
      sheenColor: new THREE.Color(0x555555),
      sheenRoughness: 0.85
    })
  },

  subgasket() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xeaeaea,
      metalness: 0.0,
      roughness: 0.55,
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide
    })
  },

  // 气液接头 — 镀铬不锈钢: 高反射镜面
  gasPort() {
    return new THREE.MeshStandardMaterial({
      color: 0xd7d9d7,
      metalness: 0.78,
      roughness: 0.24,
      envMapIntensity: 1.25,
      emissive: 0x4a4d4d,
      emissiveIntensity: 0.16
    })
  },

  manifold() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xc0c8d0,
      metalness: 0.93,
      roughness: 0.22,
      envMapIntensity: 1.6,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2
    })
  },

  port() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xa8b0b8,
      metalness: 0.88,
      roughness: 0.35,
      envMapIntensity: 1.0
    })
  },

  oRing() {
    return new THREE.MeshPhysicalMaterial({
      color: 0x151515,          // Deep charcoal black EPDM Viton rubber
      metalness: 0.05,
      roughness: 0.60,
      envMapIntensity: 0.6,
      clearcoat: 0.08,
      clearcoatRoughness: 0.65,
      sheen: 0.2,
      sheenColor: new THREE.Color(0x2b2b2b),
      sheenRoughness: 0.8
    })
  },

  membrane() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xb8bec4,
      metalness: 0.02,
      roughness: 0.22,
      transmission: 0.35,
      thickness: 0.3,
      transparent: true,
      opacity: 0.52,
      emissive: 0x5c6872,
      emissiveIntensity: 0.08,
      clearcoat: 0.45,
      clearcoatRoughness: 0.28,
      side: THREE.DoubleSide
    })
  },

  channel() {
    return new THREE.MeshStandardMaterial({
      color: 0x29b6ff,
      emissive: 0x0a4fa0,
      emissiveIntensity: 0.65,
      metalness: 0.4,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    })
  },

  channelGroove() {
    return new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      metalness: 0.7,
      roughness: 0.55,
      emissive: 0x05151c,
      emissiveIntensity: 0.12
    })
  },

  edgeGlow() {
    return new THREE.LineBasicMaterial({
      color: 0x66d6ff,
      transparent: true,
      opacity: 0.9
    })
  },

  particle() {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0.00, 'rgba(220,240,255,1)')
    g.addColorStop(0.35, 'rgba(80,180,255,0.9)')
    g.addColorStop(0.70, 'rgba(30,100,200,0.4)')
    g.addColorStop(1.00, 'rgba(10,40,90,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return new THREE.PointsMaterial({
      size: 2.4,
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xcfefff
    })
  }
}
