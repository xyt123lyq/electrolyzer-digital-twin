/**
 * FlowVisualizer.js
 *
 * Multi-technique flow visualization system for electrolyzer membrane channel
 * plates. Provides four coordinated layers that can be enabled independently
 * based on hardware tier:
 *
 *   Layer 1 — FLOW_GROOVE   : Procedural channel groove mesh with emissive floor
 *   Layer 2 — FLOW_LINES    : Dual parallel flowing-dash LineSegments (GLSL)
 *   Layer 3 — FLOW_PARTICLES: GPU sprite points distributed along the channel path
 *   Layer 4 — FLOW_TUBE     : TubeGeometry with scrolling emissive band shader
 *
 * Performance budget (per channel face):
 *   Particles : 320 max  → single Points draw call
 *   Lines     : ~600 verts → single LineSegments draw call
 *   Tube      : 1200 tubular segs → single Mesh draw call
 *
 * Tier support:
 *   low   — tube only (400 tubular segments), no particles/lines
 *   mid   — tube + 160 particles, no lines
 *   high  — all four layers at full resolution
 */

import * as THREE from 'three'
import { CELL_CONFIG } from './CellGenerator.js'
import { MaterialPresets } from './Materials.js'

// ─────────────────────────────────────────────────────────────────────────────
// Public constants (also used by ElectrolyzerScene for sizing)
// ─────────────────────────────────────────────────────────────────────────────
export const FLOW_CONSTANTS = {
  CHANNEL_RADIUS: 0.8,   // mm — channel half-width
  ROW_GAP:        1.5,   // mm — spacing between channel rows
  MARGIN:         2.0    // mm — edge margin
}

const PARTICLE_COUNTS = { low: 60, mid: 120, high: 200 }
const TUBE_SEGMENTS    = { low: 300, mid: 500, high: 800 }

// ─────────────────────────────────────────────────────────────────────────────
// Path builder — serpentine (S-type) channel pattern
// Based on plate inner diameter (76mm for POM gasket/plates)
// ─────────────────────────────────────────────────────────────────────────────
export function buildSerpentinePoints() {
  // Use plate inner diameter for channel sizing
  const PLATE_SIZE = CELL_CONFIG.innerDiameter  // 76mm
  const CHANNEL_SIZE = PLATE_SIZE * 0.85  // 85% of plate, leave margin

  const uW  = CHANNEL_SIZE - FLOW_CONSTANTS.MARGIN * 2
  const uH  = CHANNEL_SIZE - FLOW_CONSTANTS.MARGIN * 2
  const rowH = FLOW_CONSTANTS.CHANNEL_RADIUS * 2 + FLOW_CONSTANTS.ROW_GAP
  const numRows = Math.max(8, Math.floor(uH / rowH))
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
      pts.push(new THREE.Vector3(x1 + dir * ins * 0.3,  y + rowH * 0.25, 0))
      pts.push(new THREE.Vector3(x1 + dir * ins * 0.6, y + rowH * 0.50, 0))
      pts.push(new THREE.Vector3(x1 + dir * ins * 0.3,  y + rowH * 0.75, 0))
      pts.push(new THREE.Vector3(x1, ny, 0))
    }
    y += rowH
  }
  return pts
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 · Channel groove — flat ribbon extruded from curve tangent plane
// ─────────────────────────────────────────────────────────────────────────────
/**
 * buildChannelGroove(curve) → THREE.Group
 *
 * Two meshes:
 *   1. grooveBody  — wide flat ribbon (CHANNEL_RADIUS × 2 wide) extruded
 *                     along the curve; dark metallic floor
 *   2. grooveFloor  — emissive inner floor strip (60% width) that glows
 *                     faintly blue even when flow is paused
 */
function buildChannelGroove(curve) {
  const N      = 240
  const halfW  = FLOW_CONSTANTS.CHANNEL_RADIUS * 1.1   // half-width of groove
  const depth  = FLOW_CONSTANTS.CHANNEL_RADIUS * 0.6  // groove depth

  // Sample curve frames for ribbon construction
  const frames  = curve.computeFrenetFrames(N, false)
  const posArr  = new Float32Array((N + 1) * 2 * 3)
  const normArr = new Float32Array((N + 1) * 2 * 3)
  const uvArr   = new Float32Array((N + 1) * 2 * 2)
  const idxArr  = []

  for (let i = 0; i <= N; i++) {
    const t   = i / N
    const p   = curve.getPointAt(t)
    // binormal is perpendicular to curve tangent in the XY plane
    const bn  = new THREE.Vector3(-frames.binormals[i].y, frames.binormals[i].x, 0).normalize()
    if (bn.length() < 0.01) bn.set(1, 0, 0)  // fallback at straight sections

    const v0  = i * 2
    const v1  = i * 2 + 1

    // Left edge vertex
    posArr[v0 * 3]     = p.x - bn.x * halfW
    posArr[v0 * 3 + 1] = p.y - bn.y * halfW
    posArr[v0 * 3 + 2] = 0
    normArr[v0 * 3]    = 0; normArr[v0 * 3 + 1] = 0; normArr[v0 * 3 + 2] = 1
    uvArr[v0 * 2]      = t * 60; uvArr[v0 * 2 + 1] = 0

    // Right edge vertex
    posArr[v1 * 3]     = p.x + bn.x * halfW
    posArr[v1 * 3 + 1] = p.y + bn.y * halfW
    posArr[v1 * 3 + 2] = 0
    normArr[v1 * 3]    = 0; normArr[v1 * 3 + 1] = 0; normArr[v1 * 3 + 2] = 1
    uvArr[v1 * 2]      = t * 60; uvArr[v1 * 2 + 1] = 1

    if (i < N) {
      const a = v0, b = v0 + 2, c = v1, d = v1 + 2
      idxArr.push(a, c, b,  b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(posArr,  3))
  geo.setAttribute('normal',    new THREE.BufferAttribute(normArr, 3))
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvArr,   2))
  geo.setIndex(idxArr)

  const mat = MaterialPresets.channelGroove()
  const body = new THREE.Mesh(geo, mat)
  body.name  = 'grooveBody'

  // ── Emissive floor strip ────────────────────────────────────────────────
  const fHalfW = halfW * 0.55
  const fPos   = new Float32Array((N + 1) * 2 * 3)
  const fIdx   = []
  for (let i = 0; i <= N; i++) {
    const t  = i / N
    const p  = curve.getPointAt(t)
    const bn = new THREE.Vector3(-frames.binormals[i].y, frames.binormals[i].x, 0).normalize()
    if (bn.length() < 0.01) bn.set(1, 0, 0)

    const v0 = i * 2, v1 = i * 2 + 1
    fPos[v0 * 3]     = p.x - bn.x * fHalfW;  fPos[v0 * 3 + 1] = p.y - bn.y * fHalfW;  fPos[v0 * 3 + 2] = 0.05
    fPos[v1 * 3]     = p.x + bn.x * fHalfW;  fPos[v1 * 3 + 1] = p.y + bn.y * fHalfW;  fPos[v1 * 3 + 2] = 0.05
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
    color:             0x1a4a7a,
    emissive:          new THREE.Color(0x0060cc),
    emissiveIntensity: 0.28,
    metalness:         0.55,
    roughness:         0.40,
    transparent:       true,
    opacity:          0.90,
    side:             THREE.DoubleSide
  })
  const floor = new THREE.Mesh(fGeo, fMat)
  floor.name  = 'grooveFloor'

  const group = new THREE.Group()
  group.name  = 'flowGroove'
  group.add(body, floor)
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 · Flowing dashed guide lines
// ─────────────────────────────────────────────────────────────────────────────
/**
 * buildFlowLines(curve, N) → THREE.LineSegments
 *
 * Two parallel guide lines (left/right channel edges) drawn as a
 * LineSegments mesh with a ShaderMaterial. UV-scrolling dash pattern:
 *   dash on  [0.0 – 0.38]   → visible
 *   gap      (0.38 – 1.0)   → transparent / discarded
 *
 * Brightness pulse at the leading edge of each dash creates a
 * directional arrow cue without requiring a texture atlas.
 */
function buildFlowLines(curve, N) {
  const halfW  = FLOW_CONSTANTS.CHANNEL_RADIUS * 0.95
  const verts  = (N + 1) * 2 * 3   // (N+1) points × 2 lines × 3 coords
  const uvArr  = new Float32Array((N + 1) * 2 * 2)
  const posArr = new Float32Array(verts)
  const idxArr = []

  for (let i = 0; i <= N; i++) {
    const t    = i / N
    const p    = curve.getPointAt(t)
    const next = curve.getPointAt(Math.min(1, t + 0.001))
    // Normal in XY plane
    const dx   = next.x - p.x, dy = next.y - p.y
    const len  = Math.sqrt(dx * dx + dy * dy) || 1
    const nx   = -dy / len, ny = dx / len

    const v0 = i * 2, v1 = i * 2 + 1
    posArr[v0 * 3]     = p.x - nx * halfW;  posArr[v0 * 3 + 1] = p.y - ny * halfW;  posArr[v0 * 3 + 2] = 0.3
    posArr[v1 * 3]     = p.x + nx * halfW;  posArr[v1 * 3 + 1] = p.y + ny * halfW;  posArr[v1 * 3 + 2] = 0.3
    uvArr[v0 * 2]      = t * 50; uvArr[v0 * 2 + 1] = 0
    uvArr[v1 * 2]      = t * 50; uvArr[v1 * 2 + 1] = 1

    if (i < N) {
      const a = v0, b = v0 + 2, c = v1, d = v1 + 2
      idxArr.push(a, b, c,  b, d, c)   // both lines as one tri-strip per quad
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
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uFlowSpeed;
      uniform vec3  uColor;
      uniform vec3  uGlow;
      varying vec2  vUv;

      void main() {
        // Scrolling dash: visible [0.0 – 0.36], gap [0.36 – 1.0]
        float scroll = fract(vUv.x - uTime * uFlowSpeed * 0.05);
        float dash   = step(0.0, scroll) - step(0.36, scroll);
        if (dash < 0.5) discard;

        // Brightness ramp within dash — leading edge brightest
        float pulse = smoothstep(0.0, 0.40, scroll) * (1.0 - smoothstep(0.30, 1.0, scroll));
        pulse = max(pulse, 0.20);

        vec3  col  = mix(uGlow, uColor, pulse);
        float alpha = 0.55 + pulse * 0.45;
        gl_FragColor = vec4(col, alpha);
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

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 · GPU particle system
// ─────────────────────────────────────────────────────────────────────────────
/**
 * buildFlowParticles(curve, count) → THREE.Points
 *
 * count sprite particles distributed evenly along the curve with randomised
 * phase offsets and speed multipliers (0.10 – 0.30 progress/second).
 * Per-particle size attribute drives vertex shader gl_PointSize variation.
 * Additive blending creates luminous hydrogen-bubble appearance.
 */
function buildFlowParticles(curve, count) {
  const pos    = new Float32Array(count * 3)
  const prog   = new Float32Array(count)
  const speeds = new Float32Array(count)
  const sizes  = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    prog[i]   = (i / count + Math.random() * 0.05) % 1.0
    speeds[i] = 0.10 + Math.random() * 0.20
    sizes[i]  = 1.6  + Math.random() * 1.6
    const p   = curve.getPointAt(prog[i])
    pos[i * 3]     = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = 0.6
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos,   3))
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color(0x88f4ff) },
      uGlow:  { value: new THREE.Color(0x003366) }
    },
    vertexShader: /* glsl */`
      attribute float aSize;
      uniform   float uTime;
      varying   float vAlpha;

      void main() {
        gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (1.0 + 0.35 * sin(uTime * 3.0 + aSize * 0.5));
        float t      = mod(uTime * 0.18 + aSize * 0.08, 1.0);
        vAlpha       = sin(t * 3.14159);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  uColor;
      uniform vec3  uGlow;
      varying float vAlpha;

      void main() {
        vec2  uv   = gl_PointCoord - 0.5;
        float d    = length(uv) * 2.0;
        if (d > 1.0) discard;
        float core = 1.0 - smoothstep(0.0, 0.30, d);
        float halo = 1.0 - smoothstep(0.0, 1.0,  d);
        vec3  col  = mix(uGlow, uColor, core);
        float a    = (core * 0.88 + halo * 0.30) * vAlpha;
        gl_FragColor = vec4(col, a);
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
    arr[i * 3 + 2] = 0.6
  }
  pts.geometry.attributes.position.needsUpdate = true
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 4 · Shader-driven tube
// ─────────────────────────────────────────────────────────────────────────────
/**
 * buildFlowTube(curve, tubularSegs) → THREE.Mesh
 *
 * TubeGeometry (tube radius slightly under the groove width) with a custom
 * ShaderMaterial. Fragment shader maps UV.x (0→1 along flow direction) to:
 *   - Two overlapping sine waves → flowing emissive band "packets"
 *   - Direction arrow mark: sharp brightness ramp at packet leading edge
 *   - Fresnel edge highlight for tube-surface depth
 *   - Velocity encoding: uFlowVelocity (0..1) scales overall brightness
 *
 * The tube is oriented in the XY plane (matches the curve's natural plane)
 * and positioned at z = +CHANNEL_RADIUS so it sits exactly atop the groove
 * floor, appearing as a transparent luminous fluid channel.
 */
function buildFlowTube(curve, tubularSegs) {
  // TubeGeometry builds a tube in the XY-plane by default
  const geo = new THREE.TubeGeometry(curve, tubularSegs, FLOW_CONSTANTS.CHANNEL_RADIUS * 0.78, 8, false)
  geo.rotateX(Math.PI / 2)   // orient so the tube face (cross-section) is in XY plane

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:          { value: 0 },
      uFlowSpeed:    { value: 1.0 },
      uFlowVelocity: { value: 0.7 },  // drives brightness (0..1 from telemetry)
      uColor:        { value: new THREE.Color(0x00b8ff) },
      uColor2:       { value: new THREE.Color(0x60e8ff) },
      uGlow:         { value: new THREE.Color(0x001833) }
    },
    vertexShader: /* glsl */`
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
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uFlowSpeed;
      uniform float uFlowVelocity;
      uniform vec3  uColor;
      uniform vec3  uColor2;
      uniform vec3  uGlow;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      void main() {
        // ── Scrolling emissive bands ───────────────────────────────────────
        // Primary band: sin^2 envelope creates smooth on/off pulses
        float flow   = vUv.x * 10.0 - uTime * uFlowSpeed * 2.5;
        float band1  = pow(sin(flow)       * 0.5 + 0.5, 2.0);
        float band2  = pow(sin(flow * 1.6 + uTime * 0.8) * 0.5 + 0.5, 3.0) * 0.3;

        // ── Direction arrow mark ─────────────────────────────────────────
        // Brightness ramp at leading edge of each packet
        float s      = sin(flow) * 0.5 + 0.5;
        float arrow  = pow(s, 5.0) * 0.55;

        // ── Fresnel edge glow ────────────────────────────────────────────
        vec3  N      = normalize(vNormal);
        vec3  V      = normalize(vViewPos);
        float NdotV  = abs(dot(N, V));
        float fresnel = pow(1.0 - NdotV, 2.2) * 0.35;

        // ── Velocity modulation ───────────────────────────────────────────
        // uFlowVelocity 0..1 → brightness scale 0.28..1.0
        float velScale = 0.28 + uFlowVelocity * 0.72;

        float intensity = (band1 * 0.50 + band2 + arrow + fresnel) * velScale;
        intensity = clamp(intensity, 0.0, 1.0);

        vec3  col   = mix(uGlow, mix(uColor, uColor2, band1 * 0.45), intensity);
        float alpha = 0.18 + intensity * 0.72;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
    side:        THREE.DoubleSide
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.name   = 'flowTube'
  // Position tube so it sits above the groove floor (z in flowViz local space)
  mesh.position.z = FLOW_CONSTANTS.CHANNEL_RADIUS * 0.35
  mesh.userData.curve = curve
  return mesh
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exporter
// ─────────────────────────────────────────────────────────────────────────────
/**
 * createFlowVisualization(tier = 'high') → FlowViz
 *
 * Assembles all requested layers into a single THREE.Group.
 * Call update(delta, speed) every frame.
 * Call setVelocity(0..1) with telemetry data to modulate brightness.
 * Call setVisible(bool) to show/hide.
 *
 * @param {string} tier  — 'low' | 'mid' | 'high'
 * @returns {{ group, update, setVelocity, setVisible, dispose }}
 */
export function createFlowVisualization(tier = 'high') {
  const pts     = buildSerpentinePoints()
  const curve   = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05)
  const tubeSegs = TUBE_SEGMENTS[tier] || TUBE_SEGMENTS.high
  const pCount   = PARTICLE_COUNTS[tier] || PARTICLE_COUNTS.high

  // Layer 1: Groove (always present — structural geometry)
  const grooveGroup = buildChannelGroove(curve)

  // Layer 2: Flow lines (high/mid tier)
  const flowLines = (tier !== 'low')
    ? buildFlowLines(curve, Math.min(tubeSegs, 500))
    : null

  // Layer 3: Particles (high/mid tier)
  const particles = (tier !== 'low')
    ? buildFlowParticles(curve, pCount)
    : null

  // Layer 4: Shader tube (always present — primary visual)
  const tube = buildFlowTube(curve, tubeSegs)

  const group = new THREE.Group()
  group.name  = 'FlowVisualization'
  group.add(tube)
  if (flowLines) group.add(flowLines)
  if (particles) group.add(particles)
  group.add(grooveGroup)

  // Hidden by default — shown on explosion
  group.visible = false

  // ── Per-frame update ───────────────────────────────────────────────────────
  function update(delta, flowSpeed = 1.0) {
    tube.material.uniforms.uTime.value      += delta
    tube.material.uniforms.uFlowSpeed.value  = Math.abs(flowSpeed)
    // Sign of flowSpeed: negative = reverse direction (flip time advancement)
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

  function setVelocity(v) {
    // v: 0..1 normalised flow rate from telemetry
    const cv = Math.max(0, Math.min(1, v))
    tube.material.uniforms.uFlowVelocity.value = cv
    if (flowLines) flowLines.material.uniforms.uFlowSpeed.value = 0.4 + cv * 1.2
    if (particles) {
      const pd = particles.userData
      // Scale particle base speeds proportionally to velocity
      const base = 0.10 + (1 - cv) * 0.05
      for (let i = 0; i < pd.count; i++) {
        pd.speeds[i] = base + Math.random() * 0.10
      }
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
    setVisible,
    dispose,
    // internals exposed for ElectrolyzerScene inspection
    _tube:      tube,
    _flowLines: flowLines,
    _particles: particles,
    _groove:    grooveGroup,
    _curve:     curve
  }
}
