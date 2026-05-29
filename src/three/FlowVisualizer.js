/**
 * FlowVisualizer.js
 *
 * 隔膜与多孔介质层 (GDL/MEA) 蛇形流道的多物理场三维可视化系统。
 * 完美契合 CellGenerator.js 物理建模尺寸，将流道范围限制在 central active area (recessSize = 30x30 mm) 内部，
 * 提供低、中、高三档硬件适配，以及四种分析模式的 GLSL 实时仿真着色渲染：
 *
 *   Layer 1 — FLOW_GROOVE   : 刻槽几何（金属槽底 + 弱发光底层）
 *   Layer 2 — FLOW_LINES    : 浮空双侧流动导向虚线（GLSL 着色器裁切）
 *   Layer 3 — FLOW_PARTICLES: GPU 发光气泡粒子系统（含气率模式下沿程指数膨胀）
 *   Layer 4 — FLOW_TUBE     : 三维发光流动流体管线（支持多物理场冷暖色谱和压力降彩虹色谱映射）
 */

import * as THREE from 'three'
import { CELL_CONFIG } from './CellGenerator.js'

// ── 流道物理常数 (按 30x30 mm 活性区域重置) ───────────────────────────────────
export const FLOW_CONSTANTS = {
  CHANNEL_RADIUS: 0.20,  // mm — 流管半径
  ROW_GAP:        1.3,   // mm — 行间距
  MARGIN:         1.0    // mm — 边缘留白
}

const PARTICLE_COUNTS = { low: 40, mid: 90, high: 160 }
const TUBE_SEGMENTS    = { low: 200, mid: 400, high: 600 }

// ── 曲线构建器：完美嵌在 30x30 mm 凹槽内的蛇形 (S型) 曲线 ──────────────────────
export function buildSerpentinePoints() {
  const ACTIVE_SIZE = CELL_CONFIG.flowChannel.recessSize || 30 // 30 mm
  const uW  = ACTIVE_SIZE - FLOW_CONSTANTS.MARGIN * 2
  const uH  = ACTIVE_SIZE - FLOW_CONSTANTS.MARGIN * 2
  
  const rowH = FLOW_CONSTANTS.CHANNEL_RADIUS * 2 + FLOW_CONSTANTS.ROW_GAP // 1.3 + 1.3 = 2.6 mm
  const numRows = Math.max(8, Math.floor(uH / rowH)) // 约 10-11 行
  
  const xL = -uW / 2, xR = uW / 2
  const pts = []
  let y = -uH / 2 + rowH / 2

  for (let i = 0; i < numRows; i++) {
    const right = (i % 2 === 0)
    const x0 = right ? xL : xR
    const x1 = right ? xR : xL
    pts.push(new THREE.Vector3(x0, y, 0))
    pts.push(new THREE.Vector3(x1, y, 0))
    if (i < numRows - 1) {
      const ny   = y + rowH
      const dir  = right ? 1 : -1
      const ins  = rowH * 0.5
      pts.push(new THREE.Vector3(x1 + dir * ins * 0.35, y + rowH * 0.25, 0))
      pts.push(new THREE.Vector3(x1 + dir * ins * 0.65, y + rowH * 0.50, 0))
      pts.push(new THREE.Vector3(x1 + dir * ins * 0.35, y + rowH * 0.75, 0))
      pts.push(new THREE.Vector3(x1, ny, 0))
    }
    y += rowH
  }
  return pts
}

// ── Layer 1 · 流道凹槽底壳 ──────────────────────────────────────────────────
function buildChannelGroove(curve) {
  const N      = 180
  const halfW  = FLOW_CONSTANTS.CHANNEL_RADIUS * 1.15
  const frames  = curve.computeFrenetFrames(N, false)
  
  const posArr  = new Float32Array((N + 1) * 2 * 3)
  const normArr = new Float32Array((N + 1) * 2 * 3)
  const uvArr   = new Float32Array((N + 1) * 2 * 2)
  const idxArr  = []

  for (let i = 0; i <= N; i++) {
    const t   = i / N
    const p   = curve.getPointAt(t)
    const bn  = new THREE.Vector3(-frames.binormals[i].y, frames.binormals[i].x, 0).normalize()
    if (bn.length() < 0.01) bn.set(1, 0, 0)

    const v0  = i * 2, v1 = i * 2 + 1

    posArr[v0 * 3]     = p.x - bn.x * halfW
    posArr[v0 * 3 + 1] = p.y - bn.y * halfW
    posArr[v0 * 3 + 2] = 0
    normArr[v0 * 3]    = 0; normArr[v0 * 3 + 1] = 0; normArr[v0 * 3 + 2] = 1
    uvArr[v0 * 2]      = t * 40; uvArr[v0 * 2 + 1] = 0

    posArr[v1 * 3]     = p.x + bn.x * halfW
    posArr[v1 * 3 + 1] = p.y + bn.y * halfW
    posArr[v1 * 3 + 2] = 0
    normArr[v1 * 3]    = 0; normArr[v1 * 3 + 1] = 0; normArr[v1 * 3 + 2] = 1
    uvArr[v1 * 2]      = t * 40; uvArr[v1 * 2 + 1] = 1

    if (i < N) {
      idxArr.push(v0, v1, v0 + 2,  v0 + 2, v1, v1 + 2)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(posArr,  3))
  geo.setAttribute('normal',    new THREE.BufferAttribute(normArr, 3))
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvArr,   2))
  geo.setIndex(idxArr)

  const mat = new THREE.MeshStandardMaterial({
    color: 0x11283e,
    metalness: 0.82,
    roughness: 0.35,
    transparent: true,
    opacity: 0.60
  })
  const body = new THREE.Mesh(geo, mat)
  body.name  = 'grooveBody'

  // 发光凹槽内底
  const fHalfW = halfW * 0.6
  const fPos   = new Float32Array((N + 1) * 2 * 3)
  const fIdx   = []
  for (let i = 0; i <= N; i++) {
    const t  = i / N
    const p  = curve.getPointAt(t)
    const bn = new THREE.Vector3(-frames.binormals[i].y, frames.binormals[i].x, 0).normalize()
    if (bn.length() < 0.01) bn.set(1, 0, 0)

    const v0 = i * 2, v1 = i * 2 + 1
    fPos[v0 * 3]     = p.x - bn.x * fHalfW;  fPos[v0 * 3 + 1] = p.y - bn.y * fHalfW;  fPos[v0 * 3 + 2] = 0.03
    fPos[v1 * 3]     = p.x + bn.x * fHalfW;  fPos[v1 * 3 + 1] = p.y + bn.y * fHalfW;  fPos[v1 * 3 + 2] = 0.03
    if (i < N) {
      fIdx.push(v0, v1, v0 + 2,  v0 + 2, v1, v1 + 2)
    }
  }

  const fGeo = new THREE.BufferGeometry()
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3))
  const fNorm = new Float32Array((N + 1) * 2 * 3).fill(0)
  for (let i = 0; i < (N + 1) * 2; i++) fNorm[i * 3 + 2] = 1
  fGeo.setAttribute('normal', new THREE.BufferAttribute(fNorm, 3))
  fGeo.setIndex(fIdx)

  const fMat = new THREE.MeshStandardMaterial({
    color:             0x004c88,
    emissive:          new THREE.Color(0x004ccb),
    emissiveIntensity: 0.22,
    metalness:         0.60,
    roughness:         0.45,
    transparent:       true,
    opacity:          0.80,
    side:             THREE.DoubleSide
  })
  const floor = new THREE.Mesh(fGeo, fMat)
  floor.name  = 'grooveFloor'

  const group = new THREE.Group()
  group.name  = 'flowGroove'
  group.add(body, floor)
  return group
}

// ── Layer 2 · 虚线流光导线 ──────────────────────────────────────────────────
function buildFlowLines(curve, N) {
  const halfW  = FLOW_CONSTANTS.CHANNEL_RADIUS * 0.95
  const verts  = (N + 1) * 2 * 3
  const uvArr  = new Float32Array((N + 1) * 2 * 2)
  const posArr = new Float32Array(verts)
  const idxArr = []

  for (let i = 0; i <= N; i++) {
    const t    = i / N
    const p    = curve.getPointAt(t)
    const next = curve.getPointAt(Math.min(1, t + 0.001))
    const dx   = next.x - p.x, dy = next.y - p.y
    const len  = Math.sqrt(dx * dx + dy * dy) || 1
    const nx   = -dy / len, ny = dx / len

    const v0 = i * 2, v1 = i * 2 + 1
    posArr[v0 * 3]     = p.x - nx * halfW;  posArr[v0 * 3 + 1] = p.y - ny * halfW;  posArr[v0 * 3 + 2] = 0.15
    posArr[v1 * 3]     = p.x + nx * halfW;  posArr[v1 * 3 + 1] = p.y + ny * halfW;  posArr[v1 * 3 + 2] = 0.15
    uvArr[v0 * 2]      = t * 30; uvArr[v0 * 2 + 1] = 0
    uvArr[v1 * 2]      = t * 30; uvArr[v1 * 2 + 1] = 1

    if (i < N) {
      idxArr.push(v0, v0 + 2, v1,  v0 + 2, v1 + 2, v1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
  geo.setAttribute('uv',      new THREE.BufferAttribute(uvArr,  2))
  geo.setIndex(idxArr)

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uFlowSpeed: { value: 1.0 },
      uColor:     { value: new THREE.Color(0x00ccff) },
      uGlow:      { value: new THREE.Color(0x001833) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlowSpeed;
      uniform vec3  uColor;
      uniform vec3  uGlow;
      varying vec2  vUv;

      void main() {
        float scroll = fract(vUv.x - uTime * uFlowSpeed * 0.08);
        float dash   = step(0.0, scroll) - step(0.35, scroll);
        if (dash < 0.5) discard;

        float pulse = smoothstep(0.0, 0.40, scroll) * (1.0 - smoothstep(0.28, 1.0, scroll));
        pulse = max(pulse, 0.18);

        vec3  col  = mix(uGlow, uColor, pulse);
        float alpha = 0.45 + pulse * 0.45;
        gl_FragColor = vec4(col, alpha * 0.6);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending:   THREE.AdditiveBlending
  })

  const lines = new THREE.LineSegments(geo, mat)
  lines.name  = 'flowLines'
  return lines
}

// ── Layer 3 · GPU 粒子系统 ──────────────────────────────────────────────────
function buildFlowParticles(curve, count) {
  const pos    = new Float32Array(count * 3)
  const prog   = new Float32Array(count)
  const speeds = new Float32Array(count)
  const sizes  = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    prog[i]   = (i / count + Math.random() * 0.06) % 1.0
    speeds[i] = 0.12 + Math.random() * 0.15
    sizes[i]  = 1.5  + Math.random() * 1.5
    const p   = curve.getPointAt(prog[i])
    pos[i * 3]     = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = 0.2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos,   3))
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color(0x88f4ff) },
      uGlow:  { value: new THREE.Color(0x003366) },
      uAnalysisMode: { value: 0 }
    },
    vertexShader: `
      attribute float aSize;
      uniform   float uTime;
      uniform   int uAnalysisMode;
      varying   float vAlpha;
      varying   float vProgress;

      void main() {
        // 基于采样路径的进度传输给 Fragment Shader
        float t      = mod(uTime * 0.20 + aSize * 0.08, 1.0);
        vProgress    = t;
        vAlpha       = sin(t * 3.14159);

        // 两相流模式下：越靠近出口（t 越大），粒子直径越大，发生微弱的随机扰动
        float pSize = aSize;
        if (uAnalysisMode == 3) {
          pSize = pSize * (1.0 + pow(t, 2.0) * 2.0);
        }

        gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = pSize * (1.0 + 0.3 * sin(uTime * 4.0 + aSize));
      }
    `,
    fragmentShader: `
      uniform vec3  uColor;
      uniform vec3  uGlow;
      uniform int   uAnalysisMode;
      varying float vAlpha;
      varying float vProgress;

      void main() {
        vec2  uv   = gl_PointCoord - 0.5;
        float d    = length(uv) * 2.0;
        if (d > 1.0) discard;
        float core = 1.0 - smoothstep(0.0, 0.30, d);
        float halo = 1.0 - smoothstep(0.0, 1.0,  d);
        
        vec3 col = mix(uGlow, uColor, core);
        
        if (uAnalysisMode == 3) {
          // 两相流：入口为水滴蓝，出口为气泡白
          vec3 water = vec3(0.0, 0.5, 1.0);
          vec3 gas = vec3(0.95, 0.98, 1.0);
          col = mix(water, gas, pow(vProgress, 1.5));
        }

        float a    = (core * 0.88 + halo * 0.30) * vAlpha;
        gl_FragColor = vec4(col, a * 0.8);
      }
    `,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending
  })

  const pts = new THREE.Points(geo, mat)
  pts.name  = 'flowParticles'
  pts.userData = { curve, prog, speeds, count }
  return pts
}

function updateFlowParticles(pts, delta, flowSpeed = 1.0) {
  if (!pts.visible) return
  const { curve, prog, speeds, count } = pts.userData
  const arr = pts.geometry.attributes.position.array
  for (let i = 0; i < count; i++) {
    prog[i] = (prog[i] + delta * speeds[i] * flowSpeed) % 1.0
    const p  = curve.getPointAt(prog[i])
    arr[i * 3]     = p.x
    arr[i * 3 + 1] = p.y
    arr[i * 3 + 2] = 0.2
  }
  pts.geometry.attributes.position.needsUpdate = true
}

// ── Layer 4 · 三维流体管线 ──────────────────────────────────────────────────
function buildFlowTube(curve, tubularSegs) {
  const geo = new THREE.TubeGeometry(curve, tubularSegs, FLOW_CONSTANTS.CHANNEL_RADIUS * 0.76, 8, false)
  geo.rotateX(Math.PI / 2)

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:          { value: 0 },
      uFlowSpeed:    { value: 1.0 },
      uFlowVelocity: { value: 0.6 },
      uAnalysisMode: { value: 0 },
      uColor:        { value: new THREE.Color(0x00b8ff) },
      uColor2:       { value: new THREE.Color(0x60e8ff) },
      uGlow:         { value: new THREE.Color(0x001833) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      void main() {
        vUv      = uv;
        vNormal  = normalMatrix * normal;
        vec4 mv  = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlowSpeed;
      uniform float uFlowVelocity;
      uniform int   uAnalysisMode;
      uniform vec3  uColor;
      uniform vec3  uColor2;
      uniform vec3  uGlow;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      vec3 getJetColor(float value) {
        float v = clamp(value, 0.0, 1.0);
        float r = clamp(min(4.0 * v - 1.5, -4.0 * v + 4.5), 0.0, 1.0);
        float g = clamp(min(4.0 * v - 0.5, -4.0 * v + 3.5), 0.0, 1.0);
        float b = clamp(min(4.0 * v + 0.5, -4.0 * v + 2.5), 0.0, 1.0);
        return vec3(r, g, b);
      }

      void main() {
        // ── 基础滚动流光 ────────────────────────────────────────────────────
        float flow   = vUv.x * 8.0 - uTime * uFlowSpeed * 2.2;
        float band1  = pow(sin(flow) * 0.5 + 0.5, 2.0);
        float band2  = pow(sin(flow * 1.5 + uTime * 0.7) * 0.5 + 0.5, 3.0) * 0.35;
        
        // 箭头导流脉冲
        float arrow  = pow(sin(flow) * 0.5 + 0.5, 6.0) * 0.5;

        // 菲涅尔边缘高光
        vec3  N      = normalize(vNormal);
        vec3  V      = normalize(vViewPos);
        float NdotV  = abs(dot(N, V));
        float fresnel = pow(1.0 - NdotV, 2.0) * 0.38;

        float velScale = 0.30 + uFlowVelocity * 0.70;
        float intensity = (band1 * 0.45 + band2 + arrow + fresnel) * velScale;
        intensity = clamp(intensity, 0.0, 1.0);

        // ── 模式颜色计算 ────────────────────────────────────────────────────
        vec3 col = mix(uGlow, mix(uColor, uColor2, band1 * 0.40), intensity);
        float alpha = 0.16 + intensity * 0.72;

        if (uAnalysisMode == 1) {
          // 模式 1: CFD 蛇形通道流速分布 (弯角阻力大，直道顺畅，弯角流速突增)
          // 利用沿管道正弦波动模拟弯角速度激增效应
          float velocityLocal = 0.5 + abs(sin(vUv.x * 12.0)) * 0.45;
          col = getJetColor(velocityLocal);
          alpha = 0.28 + intensity * 0.60;
        } 
        else if (uAnalysisMode == 2) {
          // 模式 2: CFD 蛇形通道全局压降 (入口红 -> 出口蓝)
          float pressRatio = vUv.x; // 从 0.0 到 1.0
          col = getJetColor(1.0 - pressRatio);
          alpha = 0.28 + intensity * 0.60;
        } 
        else if (uAnalysisMode == 3) {
          // 模式 3: 两相流 (纯水 -> 丰富气泡混合)
          vec3 water = vec3(0.0, 0.45, 0.95);
          vec3 bubbles = vec3(0.92, 0.96, 1.0);
          col = mix(water, mix(bubbles, vec3(1.0), band1), pow(vUv.x, 1.3));
          alpha = (0.20 + intensity * 0.75);
        }

        gl_FragColor = vec4(col, alpha * 0.7);
      }
    `,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
    side:        THREE.DoubleSide
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.name   = 'flowTube'
  mesh.position.z = FLOW_CONSTANTS.CHANNEL_RADIUS * 0.25
  mesh.userData.curve = curve
  return mesh
}

// ── 综合导出接口 ────────────────────────────────────────────────────────────
export function createFlowVisualization(tier = 'high') {
  const pts     = buildSerpentinePoints()
  const curve   = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05)
  const tubeSegs = TUBE_SEGMENTS[tier] || TUBE_SEGMENTS.high
  const pCount   = PARTICLE_COUNTS[tier] || PARTICLE_COUNTS.high

  // 1. 流道凹槽
  const grooveGroup = buildChannelGroove(curve)

  // 2. 流动虚线
  const flowLines = (tier !== 'low')
    ? buildFlowLines(curve, Math.min(tubeSegs, 400))
    : null

  // 3. GPU 粒子系统
  const particles = (tier !== 'low')
    ? buildFlowParticles(curve, pCount)
    : null

  // 4. 流体管道
  const tube = buildFlowTube(curve, tubeSegs)

  const group = new THREE.Group()
  group.name  = 'FlowVisualization'
  group.add(tube)
  if (flowLines) group.add(flowLines)
  if (particles) group.add(particles)
  group.add(grooveGroup)

  group.visible = false

  // 帧动画更新
  function update(delta, flowSpeed = 1.0) {
    tube.material.uniforms.uTime.value      += delta
    tube.material.uniforms.uFlowSpeed.value  = Math.abs(flowSpeed)
    if (flowSpeed < 0) tube.material.uniforms.uTime.value -= delta * 2

    if (flowLines) {
      flowLines.material.uniforms.uTime.value      += delta
      flowLines.material.uniforms.uFlowSpeed.value  = Math.abs(flowSpeed)
    }
    if (particles) {
      particles.material.uniforms.uTime.value += delta
      updateFlowParticles(particles, delta, Math.sign(flowSpeed) * Math.abs(flowSpeed))
    }
  }

  // 更改传感器流速
  function setVelocity(v) {
    const cv = Math.max(0, Math.min(1, v))
    tube.material.uniforms.uFlowVelocity.value = cv
    if (flowLines) flowLines.material.uniforms.uFlowSpeed.value = 0.4 + cv * 1.2
    if (particles) {
      const pd = particles.userData
      const base = 0.08 + (1 - cv) * 0.04
      for (let i = 0; i < pd.count; i++) {
        pd.speeds[i] = base + Math.random() * 0.08
      }
    }
  }

  // 切换流道分析显示模式
  function setAnalysisMode(mode) {
    if (mode === 4) {
      setVisible(false)
      return
    }
    
    setVisible(true)
    tube.material.uniforms.uAnalysisMode.value = mode
    tube.material.needsUpdate = true

    if (flowLines) {
      flowLines.visible = (mode === 0 || mode === 3) // 在流速和压降模式下隐藏虚线，减少颜色杂乱
    }

    if (particles) {
      particles.material.uniforms.uAnalysisMode.value = mode
      particles.material.needsUpdate = true
    }
  }

  function setVisible(v) {
    group.visible = v
  }

  function dispose() {
    group.traverse(o => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach(m => m.dispose())
      }
    })
  }

  return {
    group,
    update,
    setVelocity,
    setAnalysisMode,
    setVisible,
    dispose,
    _tube:      tube,
    _flowLines: flowLines,
    _particles: particles,
    _groove:    grooveGroup,
    _curve:     curve
  }
}
