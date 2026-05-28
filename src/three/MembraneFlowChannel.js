/**
 * MembraneFlowChannel.js
 *
 * 简化的隔膜流道可视化 - 只显示膜上的蛇形流道
 * 基于 PEM 电解槽 MEA 流道设计:
 * - 流场板(bipolar plate) 上加工蛇形流道
 * - 通道宽度 1-2mm, 行距 2-4mm
 * - 水/气体在流道中流动
 */

import * as THREE from 'three'
import { CELL_CONFIG } from './CellGenerator.js'
import { MaterialPresets } from './Materials.js'

// 流道参数 (基于 PEM 电解槽典型设计)
const CHANNEL_WIDTH = 1.5   // mm - 流道宽度
const CHANNEL_DEPTH = 0.8   // mm - 流道深度
const CHANNEL_GAP = 2.5     // mm - 流道间距(包含通道和陆地)
const MARGIN = 3             // mm - 边缘留白

// 颜色配置
const CHANNEL_COLOR = 0x0066aa   // 深蓝色流道
const CHANNEL_EMISSIVE = 0x003366
const FLOW_COLOR = 0x00aaff    // 发光效果

export class MembraneFlowChannel {
  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'MembraneFlowChannel'
    this._speed = 1.0
    this._direction = 1
    this._time = 0
    this._visible = false
    this._flowMeshes = []
    this._flowParticles = []
  }

  /**
   * 创建隔膜流道可视化
   * @param {string} side - 'anode' 或 'cathode'
   */
  create(side = 'anode') {
    // 获取膜尺寸
    const plateSize = CELL_CONFIG.innerDiameter * 0.9  // 膜占板面积的90%
    const halfSize = plateSize / 2

    // 创建基础膜板
    const baseMesh = this._createBasePlate(plateSize)
    this.group.add(baseMesh)

    // 创建流道
    const channels = this._createSerpentineChannels(plateSize)
    this.group.add(channels)

    // 创建流动粒子效果
    const particles = this._createFlowParticles(plateSize)
    this.group.add(particles)

    this.group.visible = false
    return this
  }

  _createBasePlate(size) {
    const geo = new THREE.PlaneGeometry(size, size, 1, 1)
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x1a3a5a,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = 'flowBase'
    return mesh
  }

  _createSerpentineChannels(plateSize) {
    const group = new THREE.Group()
    group.name = 'flowChannels'

    const halfSize = plateSize / 2
    const usableSize = plateSize - MARGIN * 2
    const rowHeight = CHANNEL_WIDTH + CHANNEL_GAP
    const numRows = Math.floor(usableSize / rowHeight)

    const material = new THREE.MeshStandardMaterial({
      color: CHANNEL_COLOR,
      emissive: CHANNEL_EMISSIVE,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.85
    })

    // 计算每行起点y坐标
    const startY = -halfSize + MARGIN + rowHeight / 2

    for (let i = 0; i < numRows; i++) {
      const y = startY + i * rowHeight
      const goingRight = i % 2 === 0

      // 流道段
      const segLength = usableSize - CHANNEL_WIDTH * 2
      const segGeo = new THREE.PlaneGeometry(segLength, CHANNEL_WIDTH, 1, 1)
      const segMesh = new THREE.Mesh(segGeo, material.clone())

      // 位置
      const x = goingRight ? 0 : 0
      segMesh.position.set(x, y, 0.01)

      group.add(segMesh)
      this._flowMeshes.push(segMesh)

      // 转弯圆弧 (如果非最后一行)
      if (i < numRows - 1) {
        const turnRadius = CHANNEL_WIDTH / 2 + CHANNEL_GAP / 2
        const turnGeo = new THREE.TorusGeometry(
          turnRadius,
          CHANNEL_WIDTH / 2,
          8,
          16,
          Math.PI
        )
        const turnMesh = new THREE.Mesh(turnGeo, material.clone())

        // 计算转弯位置
        const turnX = goingRight ? (halfSize - MARGIN - CHANNEL_WIDTH / 2) : (-halfSize + MARGIN + CHANNEL_WIDTH / 2)
        const turnY = y + rowHeight / 2

        turnMesh.position.set(turnX, turnY, 0.01)
        turnMesh.rotation.z = goingRight ? Math.PI / 2 : -Math.PI / 2

        // 如果是从右到左的转弯，需要翻转
        if (!goingRight) {
          turnMesh.rotation.z = Math.PI / 2
        }

        group.add(turnMesh)
        this._flowMeshes.push(turnMesh)
      }
    }

    return group
  }

  _createFlowParticles(size) {
    const group = new THREE.Group()
    group.name = 'flowParticles'

    // 创建发光粒子材质
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(FLOW_COLOR) },
        uSpeed: { value: 1.0 },
        uDirection: { value: 1.0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uDirection;
        varying float vAlpha;
        varying float vProgress;

        attribute float progress;
        attribute float speed;

        void main() {
          vProgress = progress;
          float t = mod(uTime * uSpeed * uDirection + progress, 1.0);
          vAlpha = sin(t * 3.14159) * 0.8 + 0.2;

          vec3 pos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 3.0 + sin(uTime * 3.0 + progress * 10.0) * 1.5;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(uColor, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    // 生成粒子位置 (沿蛇形路径)
    const numParticles = 80
    const positions = new Float32Array(numParticles * 3)
    const progresses = new Float32Array(numParticles)
    const speeds = new Float32Array(numParticles)

    const halfSize = size / 2
    const usableSize = size - MARGIN * 2
    const rowHeight = CHANNEL_WIDTH + CHANNEL_GAP
    const numRows = Math.floor(usableSize / rowHeight)
    const startY = -halfSize + MARGIN + rowHeight / 2

    for (let i = 0; i < numParticles; i++) {
      const progress = i / numParticles
      progresses[i] = progress
      speeds[i] = 0.8 + Math.random() * 0.4

      // 计算沿蛇形路径的位置
      const pos = this._getPositionOnSerpentine(progress, halfSize, startY, rowHeight, numRows)
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = 0.02
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('progress', new THREE.BufferAttribute(progresses, 1))
    geo.setAttribute('speed', new THREE.BufferAttribute(speeds, 1))

    const particles = new THREE.Points(geo, particleMaterial)
    group.add(particles)

    this._particleSystem = particles
    return group
  }

  _getPositionOnSerpentine(progress, halfSize, startY, rowHeight, numRows) {
    // 将 progress 映射到蛇形路径上
    const totalSegments = numRows * 2 - 1  // 总段数
    const segProgress = progress * totalSegments
    const rowIndex = Math.floor(segProgress)
    const segInRow = rowIndex % 2  // 0 = 从左到右, 1 = 从右到左
    const localProgress = segProgress - rowIndex

    const y = startY + Math.floor(rowIndex / 2) * rowHeight
    const xLen = halfSize * 2 - MARGIN * 2 - CHANNEL_WIDTH * 2

    let x
    if (segInRow === 0) {
      x = -halfSize + MARGIN + CHANNEL_WIDTH + localProgress * xLen
    } else {
      x = halfSize - MARGIN - CHANNEL_WIDTH - localProgress * xLen
    }

    return { x, y }
  }

  /**
   * 更新流动动画
   */
  update(delta) {
    if (!this._visible) return

    this._time += delta * this._speed * this._direction

    // 更新粒子 shader
    if (this._particleSystem) {
      this._particleSystem.material.uniforms.uTime.value = this._time
      this._particleSystem.material.uniforms.uSpeed.value = this._speed
      this._particleSystem.material.uniforms.uDirection.value = this._direction
      this._particleSystem.material.needsUpdate = true
    }

    // 更新流道发光
    const glowIntensity = 0.3 + Math.sin(this._time * 2) * 0.2
    for (const mesh of this._flowMeshes) {
      if (mesh.material && mesh.material.emissiveIntensity !== undefined) {
        mesh.material.emissiveIntensity = glowIntensity
      }
    }
  }

  /**
   * 设置流速
   */
  setSpeed(speed) {
    this._speed = Math.max(0.1, Math.min(5, speed))
  }

  /**
   * 设置流向
   */
  setDirection(dir) {
    this._direction = dir >= 0 ? 1 : -1
  }

  /**
   * 设置可见性
   */
  setVisible(visible) {
    this._visible = visible
    this.group.visible = visible
  }

  /**
   * 设置流向速度 (0-1, 来自传感器)
   */
  setFlowVelocity(velocity) {
    // 将 0-1 的速度映射到 0.5-3 的实际速度
    const speed = 0.5 + velocity * 2.5
    this.setSpeed(speed)
  }

  /**
   * 销毁
   */
  dispose() {
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
  }
}
