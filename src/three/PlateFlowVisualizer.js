/**
 * PlateFlowVisualizer.js
 *
 * 在极板流场上添加流动效果 - 模拟流体在竖向平行通道中流动
 * 基于 PEM 电解槽极板流场设计 (照片 #16):
 * - 10 根竖向平行沟槽
 * - 流道宽度 ~1mm
 * - 流体从顶部进液口进入，底部出液口排出
 */

import * as THREE from 'three'

// 流动粒子配置
const PARTICLE_COUNT = 60
const FLOW_COLOR = 0x00ddff

export class PlateFlowVisualizer {
  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'PlateFlowVisualizer'
    this._visible = false
    this._speed = 1.0
    this._time = 0
    this._particles = null
    this._particleMat = null
    this._positionsAttr = null
    this._progressesAttr = null
    this._speedsAttr = null
    this._channelLen = 24
  }

  /**
   * 创建流动效果
   * @param {number} plateSize - 极板尺寸 mm
   * @param {boolean} isAnode - 是否阳极板
   */
  create(plateSize, isAnode = true) {
    const channelCount = 10
    const channelWidth = 1.0
    const recessHalf = 13
    const startX = -recessHalf + 2
    const channelSpacing = (recessHalf * 2 - 4) / (channelCount - 1)
    const channelLen = recessHalf * 2 - 2
    this._channelLen = channelLen

    // 创建沿竖向通道流动的粒子
    this._createVerticalFlowParticles(channelCount, channelWidth, channelLen, startX, channelSpacing)

    this.group.visible = false
    return this
  }

  _createVerticalFlowParticles(channelCount, channelW, channelLen, startX, spacing) {
    const group = new THREE.Group()
    group.name = 'flowParticles'

    // 创建粒子几何体 - 每个通道一组粒子
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const progresses = new Float32Array(PARTICLE_COUNT)
    const channelIndices = new Float32Array(PARTICLE_COUNT)
    const speeds = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const chIdx = i % channelCount
      channelIndices[i] = chIdx
      progresses[i] = Math.random()
      speeds[i] = 0.6 + Math.random() * 0.8

      const x = startX + chIdx * spacing
      const y = -channelLen / 2 + progresses[i] * channelLen
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = 0.8
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('progress', new THREE.BufferAttribute(progresses, 1))
    geo.setAttribute('channelIdx', new THREE.BufferAttribute(channelIndices, 1))
    geo.setAttribute('speed', new THREE.BufferAttribute(speeds, 1))

    // 发光材质
    this._particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(FLOW_COLOR) },
        uSpeed: { value: 1.0 }
      },
      vertexShader: `
        attribute float progress;
        attribute float speed;
        attribute float channelIdx;
        uniform float uTime;
        uniform float uSpeed;
        varying float vAlpha;

        void main() {
          vec3 pos = position;
          float channelLen = 24.0;
          float t = mod(progress + uTime * uSpeed * speed * 0.15, 1.0);
          float newY = -channelLen/2.0 + t * channelLen;
          pos.y = newY;
          vAlpha = sin(t * 3.14159) * 0.9 + 0.1;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 2.5 + sin(uTime * 4.0 + channelIdx) * 1.0;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(uColor, glow * vAlpha * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    this._particles = new THREE.Points(geo, this._particleMat)
    group.add(this._particles)

    // 保存属性引用
    this._positionsAttr = this._particles.geometry.attributes.position
    this._progressesAttr = this._particles.geometry.attributes.progress
    this._speedsAttr = this._particles.geometry.attributes.speed

    // 添加流道区域发光效果
    const glowGeo = new THREE.PlaneGeometry(26, 26, 1, 1)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x004466,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    })
    const glowMesh = new THREE.Mesh(glowGeo, glowMat)
    glowMesh.position.z = 0.5
    group.add(glowMesh)

    this.group.add(group)
  }

  /**
   * 更新流动动画
   */
  update(delta) {
    if (!this._visible || !this._particles) return

    this._time += delta * this._speed
    this._particleMat.uniforms.uTime.value = this._time
    this._particleMat.uniforms.uSpeed.value = this._speed
    this._particleMat.needsUpdate = true

    // 更新粒子位置
    const positions = this._particles.geometry.attributes.position
    const progresses = this._particles.geometry.attributes.progress
    const speeds = this._particles.geometry.attributes.speed
    const channelLen = this._channelLen

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const speed = speeds.array[i]
      progresses.array[i] = (progresses.array[i] + delta * this._speed * speed * 0.15) % 1.0
      const newY = -channelLen / 2 + progresses.array[i] * channelLen
      positions.array[i * 3 + 1] = newY
    }

    positions.needsUpdate = true
    progresses.needsUpdate = true
  }

  /**
   * 设置速度
   */
  setSpeed(speed) {
    this._speed = Math.max(0.1, Math.min(5, speed))
  }

  /**
   * 设置可见性
   */
  setVisible(visible) {
    this._visible = visible
    this.group.visible = visible
  }

  /**
   * 设置流速 (0-1, 来自传感器)
   */
  setFlowVelocity(velocity) {
    this._speed = 0.3 + velocity * 2.7
  }

  /**
   * 销毁
   */
  dispose() {
    if (this._particles) {
      this._particles.geometry.dispose()
      this._particleMat.dispose()
    }
  }
}