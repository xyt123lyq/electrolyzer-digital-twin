import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { gsap } from 'gsap'
import { buildCell, CELL_CONFIG, cellCoreThickness } from './CellGenerator.js'
import { explodeCell, collapseCell, ExplosionConfig, updateExplosionDistance } from './ExplosionAnimation.js'
import { MaterialPresets } from './Materials.js'

function detectTier() {
  try {
    const p = new URLSearchParams(window.location.search)
    const forced = (p.get('tier') || '').toLowerCase()
    if (['low', 'mid', 'high'].includes(forced)) return forced
  } catch (e) { /* noop */ }
  const mem = navigator.deviceMemory || 4
  const cpu = navigator.hardwareConcurrency || 4
  const dpr = window.devicePixelRatio || 1
  const isTouch = matchMedia('(pointer: coarse)').matches
  if (mem <= 2 || cpu <= 2 || isTouch) return 'low'
  if (mem >= 8 && cpu >= 8 && dpr >= 1.5) return 'high'
  return 'mid'
}

const TIER_PROFILES = {
  low:  { dpr: 1.0,  shadows: false, antialias: false, shadowMap: 0,    env: false },
  mid:  { dpr: 1.25, shadows: true,  antialias: true,  shadowMap: 1024, env: true  },
  high: { dpr: 1.5,  shadows: true,  antialias: true,  shadowMap: 2048, env: true  }
}

export class ElectrolyzerScene {
  constructor(container) {
    this.container = container
    this.cell = null
    this.autoRotate = true
    this.callbacks = {}
    this._raf = null
    this._running = true
    this._needsRender = true
    this._tier = detectTier()
    this._profile = TIER_PROFILES[this._tier]

    try {
      const p = new URLSearchParams(window.location.search)
      const dprForce = parseFloat(p.get('dpr'))
      if (Number.isFinite(dprForce) && dprForce >= 0.5 && dprForce <= 3) {
        this._profile = { ...this._profile, dpr: dprForce }
      }
    } catch (e) { /* noop */ }

    console.info(`[Scene] tier=${this._tier} dpr=${this._profile.dpr} shadows=${this._profile.shadows}`)

    this._initRenderer()
    this._initScene()
    this._initLights()
    this._initCamera()
    this._initControls()
    this._buildCell()
    this._initRaycaster()
    this._initResize()
    this._initVisibility()
    this._initLoop()
  }

  on(name, cb) { this.callbacks[name] = cb }
  _emit(name, ...args) { this.callbacks[name] && this.callbacks[name](...args) }
  requestRender() { this._needsRender = true }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: this._profile.antialias,
      alpha: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._profile.dpr))
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    if (this._profile.shadows) {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }

    this.container.appendChild(this.renderer.domElement)

    if (this._profile.env) {
      this._pmrem = new THREE.PMREMGenerator(this.renderer)
    }
  }

  _initScene() {
    this.scene = new THREE.Scene()

    if (this._profile.env) {
      const envTexture = this._pmrem.fromScene(new RoomEnvironment(), 0.02).texture
      this.scene.environment = envTexture
    }

    const groundGeo = new THREE.PlaneGeometry(800, 800)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a5663, metalness: 0.1, roughness: 0.85 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -55
    ground.receiveShadow = this._profile.shadows
    this.scene.add(ground)

    const grid = new THREE.GridHelper(600, 24, 0x114b78, 0x0c2c4a)
    grid.position.y = -54.5
    grid.material.opacity = 0.45
    grid.material.transparent = true
    this.scene.add(grid)
  }

  _initLights() {
    this.scene.add(new THREE.HemisphereLight(0xE8DCC8, 0x554433, 0.6))
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15))

    const key = new THREE.DirectionalLight(0xfff5e6, 2.0)
    key.position.set(180, 280, 200)
    if (this._profile.shadows) {
      const sm = this._profile.shadowMap
      key.castShadow = true
      key.shadow.mapSize.set(sm, sm)
      key.shadow.camera.near = 50
      key.shadow.camera.far = 800
      key.shadow.camera.left = -180
      key.shadow.camera.right = 180
      key.shadow.camera.top = 180
      key.shadow.camera.bottom = -180
      key.shadow.bias = 0.02
      key.shadow.normalBias = 1.8
    }
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xE8D8C0, 0.5)
    fill.position.set(-200, 150, -120)
    this.scene.add(fill)

    const back = new THREE.DirectionalLight(0xffeedd, 0.4)
    back.position.set(50, 60, -250)
    this.scene.add(back)

    const rim = new THREE.DirectionalLight(0xAABBDD, 0.3)
    rim.position.set(-120, -40, 200)
    this.scene.add(rim)
  }

  _initCamera() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000)
    this.camera.position.set(120, 70, 150)
    this.camera.lookAt(0, 0, 0)
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 60
    this.controls.maxDistance = 700
    this.controls.target.set(0, 0, 0)
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    this.controls.addEventListener('change', () => { this._needsRender = true })
    this.controls.addEventListener('start', () => { this._needsRender = true })
  }

  _buildCell() {
    this.cellAssembly = new THREE.Group()
    this.cellAssembly.name = 'CellAssembly'

    this.cellGroup = new THREE.Group()
    this.cellGroup.name = 'CellStack'
    this.cellGroup.rotation.x = -Math.PI / 2
    this.cellAssembly.add(this.cellGroup)

    this.cell = buildCell(0)
    this.cellGroup.add(this.cell)
    this.scene.add(this.cellAssembly)
    // this._loadScanModels()  // Disabled: scan GLB models have unpredictable
    //   thickness after non-uniform scaling, creating visible gaps between layers.
    //   Parametric geometry from CellGenerator.js uses exact dimensions (mm) and
    //   produces a tightly compressed stack with no inter-layer gaps.
  }

  _loadScanModels() {
    const loader = new GLTFLoader()
    const base = import.meta.env.BASE_URL

    const scanParts = [
      { file: 'part_D.glb',       layers: ['upperGasket', 'lowerGasket'], mat: () => MaterialPresets.flowPlate(),  targetSize: CELL_CONFIG.innerDiameter, targetThick: CELL_CONFIG.gasket.thickness },
      { file: 'part_C.glb',       layers: ['anodePlate'],                 mat: () => MaterialPresets.conductive(), targetSize: CELL_CONFIG.innerDiameter, targetThick: CELL_CONFIG.plate.thickness },
      { file: 'part_E.glb',       layers: ['cathodePlate'],               mat: () => MaterialPresets.conductive(), targetSize: CELL_CONFIG.innerDiameter, targetThick: CELL_CONFIG.plate.thickness },
    ]

    for (const sp of scanParts) {
      loader.load(base + 'models/' + sp.file, (gltf) => {
        const scanMesh = gltf.scene
        const mat = sp.mat()
        mat.side = THREE.DoubleSide
        scanMesh.traverse(c => {
          if (c.isMesh) {
            c.material = mat
            c.castShadow = true
            c.receiveShadow = true
            if (c.geometry) c.geometry.computeVertexNormals()
          }
        })

        const box = new THREE.Box3().setFromObject(scanMesh)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const scale = sp.targetSize / Math.max(size.x, size.z)
        const thickScale = sp.targetThick ? sp.targetThick / (size.y * scale) : 1

        for (const layerKey of sp.layers) {
          const group = this.cell.userData.layers[layerKey]
          if (!group) continue
          const savedZ = group.position.z
          const savedMat = group.material
          while (group.children.length) group.remove(group.children[0])

          const clone = scanMesh.clone(true)
          clone.traverse(c => {
            if (c.isMesh) {
              const m = sp.mat()
              m.side = THREE.DoubleSide
              c.material = m
              if (c.geometry) c.geometry.computeVertexNormals()
            }
          })
          clone.scale.set(scale, scale * thickScale, scale)
          clone.position.set(
            -center.x * scale,
            -center.y * scale * thickScale,
            -center.z * scale
          )
          clone.rotation.x = -Math.PI / 2

          group.add(clone)
          group.position.z = savedZ
          group.material = savedMat
        }
        this._needsRender = true
        console.info(`[Scene] scan loaded: ${sp.file} → ${sp.layers.join(', ')}`)
      })
    }
  }

  _initRaycaster() {
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    const onPick = (clientX, clientY) => {
      const rect = this.renderer.domElement.getBoundingClientRect()
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(this.mouse, this.camera)
      const hits = this.raycaster.intersectObjects(this.cellGroup.children, true)
      if (hits.length) this.handleCellClick()
    }
    let down = null
    const dom = this.renderer.domElement
    dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY } })
    dom.addEventListener('pointerup', (e) => {
      if (!down) return
      const dx = e.clientX - down.x, dy = e.clientY - down.y
      down = null
      if (Math.hypot(dx, dy) < 4) onPick(e.clientX, e.clientY)
    })
  }

  _initVisibility() {
    this._onVisChange = () => {
      this._running = (document.visibilityState !== 'hidden')
      if (this._running) { this._needsRender = true }
    }
    document.addEventListener('visibilitychange', this._onVisChange)
  }

  handleCellClick() {
    if (!this.cell) return
    const state = this.cell.userData.state
    if (state === 'exploding' || state === 'collapsing') return

    if (state === 'closed') {
      this.autoRotate = false
      gsap.killTweensOf(this.cellAssembly.rotation)
      gsap.to(this.cellAssembly.rotation, { y: 0, duration: 0.8, ease: 'power2.inOut', onUpdate: () => { this._needsRender = true } })
      this._emit('cellOpening', 0)
      this._focusCell()
      
      // 动画从物理层面抬高组件，防止在拉伸时底部零件穿透地板
      const scale = this.cell.userData.explosionScale ?? 1.0
      const lift = Math.max(0, (scale - 1.0) * 35)
      gsap.to(this.cellAssembly.position, { y: lift, duration: 1.1, ease: 'power3.out', onUpdate: () => { this._needsRender = true } })

      explodeCell(this.cell, () => {
        this._emit('cellExploded', 0)
      })
    } else if (state === 'exploded') {
      // 归位组件高度到 0
      gsap.to(this.cellAssembly.position, { y: 0, duration: 0.85, ease: 'power3.inOut', onUpdate: () => { this._needsRender = true } })
      collapseCell(this.cell, () => {
        this._emit('cellCollapsed', 0)
        this.autoRotate = true
      })
      this._resetFocus()
    }
    this._needsRender = true
  }

  triggerExplode() {
    if (!this.cell) return
    const state = this.cell.userData.state
    this.autoRotate = false

    gsap.killTweensOf(this.cellAssembly.rotation)
    gsap.to(this.cellAssembly.rotation, { y: 0, duration: 0.8, ease: 'power2.inOut', onUpdate: () => { this._needsRender = true } })

    this._emit('cellOpening', 0)
    this._focusCell()

    if (state === 'exploded' || state === 'exploding') {
      gsap.to(this.cellAssembly.position, { y: 0, duration: 0.85, ease: 'power3.inOut', onUpdate: () => { this._needsRender = true } })
      collapseCell(this.cell)
      const tryExplode = (attempts = 0) => {
        if (this.cell.userData.state === 'closed') {
          const scale = this.cell.userData.explosionScale ?? 1.0
          const lift = Math.max(0, (scale - 1.0) * 35)
          gsap.to(this.cellAssembly.position, { y: lift, duration: 1.1, ease: 'power3.out', onUpdate: () => { this._needsRender = true } })
          explodeCell(this.cell, () => { this._emit('cellExploded', 0) })
        } else if (attempts < 8) {
          gsap.delayedCall(0.2, () => tryExplode(attempts + 1))
        }
      }
      gsap.delayedCall(ExplosionConfig.collapseDuration + 0.15, () => tryExplode(0))
    } else if (state === 'closed') {
      const scale = this.cell.userData.explosionScale ?? 1.0
      const lift = Math.max(0, (scale - 1.0) * 35)
      gsap.to(this.cellAssembly.position, { y: lift, duration: 1.1, ease: 'power3.out', onUpdate: () => { this._needsRender = true } })
      explodeCell(this.cell, () => { this._emit('cellExploded', 0) })
    }
    this._needsRender = true
  }

  resetAll() {
    if (!this.cell) return
    gsap.to(this.cellAssembly.position, { y: 0, duration: 0.85, ease: 'power3.inOut', onUpdate: () => { this._needsRender = true } })
    if (this.cell.userData.state !== 'closed') {
      collapseCell(this.cell, () => {
        this._emit('cellCollapsed', 0)
        this.autoRotate = true
      })
    }
    this._resetFocus()
    this._needsRender = true
  }

  _focusCell() {
    if (!this._cameraDefault) {
      this._cameraDefault = { position: this.camera.position.clone(), target: this.controls.target.clone() }
    }
    gsap.killTweensOf([this.controls.target, this.camera.position])
    const dist = 220
    // 相机放在cell中心高度(y=0)，对称看到顶板和底板
    gsap.to(this.camera.position, { x: dist * 0.55, y: 0, z: dist * 0.75, duration: 1.1, ease: 'power3.inOut', onUpdate: () => { this._needsRender = true } })
    gsap.to(this.controls.target, { x: 0, y: 0, z: 0, duration: 1.0, ease: 'power3.inOut', onUpdate: () => { this._needsRender = true } })
  }

  _resetFocus() {
    if (!this._cameraDefault) return
    gsap.killTweensOf([this.controls.target, this.camera.position])
    gsap.to(this.controls.target, { ...this._cameraDefault.target, duration: 0.85, ease: 'power3.inOut', onUpdate: () => { this._needsRender = true } })
    gsap.to(this.camera.position, { ...this._cameraDefault.position, duration: 0.85, ease: 'power3.inOut', onUpdate: () => { this._needsRender = true } })
  }

  getLayerScreenPositions() {
    if (!this.cell) return null
    const v = new THREE.Vector3()
    const out = {}
    const layers = this.cell.userData.layers
    for (const key of Object.keys(layers)) {
      layers[key].getWorldPosition(v)
      out[key] = this._projectToScreen(v)
    }
    return out
  }

  _projectToScreen(world) {
    const v = world.clone().project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height,
      visible: v.z < 1 && v.z > -1
    }
  }

  _initResize() {
    this._onResize = () => {
      const w = this.container.clientWidth
      const h = this.container.clientHeight
      if (!w || !h) return
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h)
      this._needsRender = true
    }
    window.addEventListener('resize', this._onResize)
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this._onResize())
      this._ro.observe(this.container)
    }
  }

  _hasActiveAnimation() {
    if (this.autoRotate) return true
    const s = this.cell?.userData?.state
    return s === 'exploded' || s === 'exploding' || s === 'collapsing'
  }

  _initLoop() {
    this.clock = new THREE.Clock()
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      if (!this._running) return

      const delta = Math.min(this.clock.getDelta(), 0.05)
      if (this.controls.enableDamping) this.controls.update()

      // ─── 驱动流道流动可视化 ───
      let hasVisibleFlow = false
      if (this.cell && this.cell.userData.flowVisualizers) {
        const vizs = this.cell.userData.flowVisualizers
        for (const viz of vizs) {
          const isVisible = viz.group ? viz.group.visible : viz._visible
          if (isVisible) {
            viz.update(delta)
            hasVisibleFlow = true
          }
        }
      }
      if (hasVisibleFlow) {
        this._needsRender = true
      }

      if (this._hasActiveAnimation()) {
        if (this.autoRotate) this.cellAssembly.rotation.y += delta * 0.25
        if (this.cell?.userData?.state === 'exploded') {
          // Pulse the MEA/middleGasket gdl material while exploded
          const layers  = this.cell.userData.layers
          const pulse   = 1.0 + Math.sin(performance.now() * 0.003) * 0.35
          // layers.middleGasket and layers.mea are the same object (alias)
          const meaMat  = (layers.mea3 ?? layers.mea4)?.material
          if (meaMat) meaMat.emissiveIntensity = pulse
        }
        this._needsRender = true
      }

      if (this._needsRender) {
        this.camera.updateMatrixWorld()
        this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert()
        this.scene.updateMatrixWorld()
        this._emit('beforeRender')
        this.renderer.render(this.scene, this.camera)
        this._needsRender = false
        this._emit('frame')
      }
    }
    loop()
  }

  /**
   * 切换 CFD 流场分析模式
   * @param {number} mode - 0: 常规流动, 1: 流速分布, 2: 压力梯度, 3: 两相流含气, 4: 关闭
   */
  setCFDAnalysisMode(mode) {
    if (!this.cell || !this.cell.userData.flowVisualizers) return
    const vizs = this.cell.userData.flowVisualizers
    for (const viz of vizs) {
      if (typeof viz.setAnalysisMode === 'function') {
        viz.setAnalysisMode(mode)
      } else if (typeof viz.setVelocity === 'function') {
        // FlowVisualizer (serpentine) uses setAnalysisMode too because we added it
        viz.setAnalysisMode(mode)
      }
    }
    this._needsRender = true
  }

  /**
   * 控制流体流速 (由流量滑块/传感器遥测触发，0.0 - 1.0)
   */
  setCFDVelocity(v) {
    if (!this.cell || !this.cell.userData.flowVisualizers) return
    const vizs = this.cell.userData.flowVisualizers
    for (const viz of vizs) {
      if (typeof viz.setFlowVelocity === 'function') {
        viz.setFlowVelocity(v)
      } else if (typeof viz.setVelocity === 'function') {
        viz.setVelocity(v)
      }
    }
    this._needsRender = true
  }

  /**
   * 动态控制爆炸拆解零件的拉伸间距比例
   * @param {number} scale - 缩放比例 (如 0.3 - 2.5)
   */
  setExplosionScale(scale) {
    if (!this.cell) return
    
    // 智能联动：如果当前是闭合状态，拖动间距条自动触发爆炸拆解，提升直觉体验
    if (this.cell.userData.state === 'closed') {
      this.triggerExplode()
    }
    
    updateExplosionDistance(this.cell, scale)
    
    // 动态提升模型高度，防止在拉伸时底部零件穿透地板
    const lift = Math.max(0, (scale - 1.0) * 35)
    this.cellAssembly.position.y = lift
    
    this._needsRender = true
  }

  startAutoDemo() {
    this.stopAutoDemo()
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0, onUpdate: () => { this._needsRender = true } })
    tl.call(() => { this.resetAll(); this._emit('demoPhase', { phase: 'rotate', text: '整体浏览模式' }) }, [], 0)
    tl.call(() => { this.triggerExplode(); this._emit('demoPhase', { phase: 'explode', text: '零件爆炸分解' }) }, [], 4)
    tl.call(() => { this.resetAll(); this._emit('demoPhase', { phase: 'reset', text: '复位 / 整体浏览' }) }, [], 12)
    tl.to({}, { duration: 5 }, 12)
    this.demoTimeline = tl
  }

  stopAutoDemo() {
    if (this.demoTimeline) { this.demoTimeline.kill(); this.demoTimeline = null }
  }

  snapshot(filename = `electrolyzer-${Date.now()}.png`) {
    this.renderer.render(this.scene, this.camera)
    const url = this.renderer.domElement.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  dispose() {
    cancelAnimationFrame(this._raf)
    this._raf = null
    document.removeEventListener('visibilitychange', this._onVisChange)
    window.removeEventListener('resize', this._onResize)
    if (this._ro) this._ro.disconnect()
    this.stopAutoDemo()

    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach(m => {
          for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose() }
          m.dispose?.()
        })
      }
    })
    if (this._pmrem) this._pmrem.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
