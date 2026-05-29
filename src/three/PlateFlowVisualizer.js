/**
 * PlateFlowVisualizer.js
 *
 * 在极板流场上添加流动效果 - 模拟流体在极板通道中的流动。
 * 完美契合 CellGenerator.js 中物理建模的实际尺寸与流道拓扑：
 *   - 极板中心凹槽大小 (recessSize) 为 30x30 mm
 *   - 凹槽内刻有 11 根水平平行流道 (Y 坐标在 -12.5 到 +12.5 之间，间距 2.5 mm)
 *   - 流道长度 24.8 mm (X 轴范围在 -12.4 到 +12.4 之间)
 *   - 左右两侧进出液口 (Ports) 位于 x = ±24.0, y = 0 处，并由水平分支通道 (Branches) 和抛物线角接管道 (Bezier curves) 连接至中心凹槽。
 * 
 * 本可视化系统构建了 11 条贯穿“进液口 -> 分支/角接管 -> 11根平行流道 -> 分支/角接管 -> 出液口”的完整流线，
 * 并在 GPU 着色器中实现了四种流场分析模式的实时动态渲染：
 *   - 模式 0 (常规流态) — 半透明极光蓝粒子流
 *   - 模式 1 (流速场分析) — 模拟分流截面阻力，进出口收缩截面呈现高流速 (红色)，中心平行区分流呈现低流速 (青色/绿色)
 *   - 模式 2 (压力降分析) — 沿 X 轴流动方向呈现自左向右 (红 -> 黄 -> 绿 -> 蓝) 的全局压力梯度衰减
 *   - 模式 3 (含气率两相流) — 入口为纯净液态水流 (深蓝色小粒子)，进入反应区后发生电化学反应生成气体，粒子逐渐膨胀并演变为闪烁的发光气泡 (亮白色大粒子)
 */

import * as THREE from 'three'
import { CELL_CONFIG } from './CellGenerator.js'

// 粒子特效全局配置
const PARTICLE_COUNT_PER_PATH = 25
const PATH_COUNT = 11
const TOTAL_PARTICLES = PARTICLE_COUNT_PER_PATH * PATH_COUNT
const GLOW_COLOR = 0x00d8ff

export class PlateFlowVisualizer {
  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'PlateFlowVisualizer'
    this._visible = false
    this._speed = 1.0
    this._direction = 1 // 1: 从左到右 (通常阳极水流), -1: 从右到左 (通常阴极氢水混合流)
    this._time = 0
    this._analysisMode = 0 // 0:常规, 1:流速, 2:压力, 3:两相流
    this._flowVelocity = 0.5 // 传感器流量速度 (0.0 - 1.0)
    this._particles = null
    this._particleMat = null
    this._paths = []
  }

  /**
   * 初始化流动特效
   * @param {boolean} isAnode - 是否阳极板 (阳极氧气，阴极氢气，流向和微观参数略有不同)
   */
  create(isAnode = true) {
    this._direction = isAnode ? 1 : -1
    
    const c = CELL_CONFIG
    const grooveSize = c.flowChannel.recessSize || 30
    const portR = 24.0
    const laneCount = 11
    const laneSpacing = grooveSize / (laneCount + 1) // 30 / 12 = 2.5 mm

    // 1. 构建 11 条物理流道完整路径的样条曲线
    this._paths = []
    for (let i = 0; i < laneCount; i++) {
      const yLane = -grooveSize / 2 + laneSpacing * (i + 1) // -15 + 2.5 * (i + 1)
      const xLaneHalf = (grooveSize - 5.2) / 2 // 24.8 / 2 = 12.4

      // 定义流线控制点，使其完全契合 Plate 上的雕刻微观结构
      const points = []
      
      // 起点：左侧进液口
      points.push(new THREE.Vector3(-portR, 0, 0))

      // 拐弯过渡点：模拟直线角接通道和分支通道
      if (i === 0 || i === 1 || i === 9 || i === 10) {
        // 边缘流道，由 _addPortStartedArcGrooves (直线段) 引导
        const sgn = i < 5 ? -1 : 1
        points.push(new THREE.Vector3(-portR + 2.15, sgn * 2.15, 0))
        points.push(new THREE.Vector3(-xLaneHalf - 1.0, sgn * (grooveSize / 2 + 0.2), 0))
      } else {
        // 中间流道，由 5 条分支通道直接水平导入
        const step = Math.abs(i - 5) // 距离中心流道步数
        const branchLen = 10.1 - step * 1.9
        const branchX = 19.25 - step * 0.95
        points.push(new THREE.Vector3(-branchX, (i - 5) * 1.15, 0))
      }

      // 平行流道入口
      points.push(new THREE.Vector3(-xLaneHalf, yLane, 0))
      // 平行流道出口
      points.push(new THREE.Vector3(xLaneHalf, yLane, 0))

      // 出口拐弯过渡点
      if (i === 0 || i === 1 || i === 9 || i === 10) {
        const sgn = i < 5 ? -1 : 1
        points.push(new THREE.Vector3(xLaneHalf + 1.0, sgn * (grooveSize / 2 + 0.2), 0))
        points.push(new THREE.Vector3(portR - 2.15, sgn * 2.15, 0))
      } else {
        const step = Math.abs(i - 5)
        const branchX = 19.25 - step * 0.95
        points.push(new THREE.Vector3(branchX, (i - 5) * 1.15, 0))
      }

      // 终点：右侧出液口
      points.push(new THREE.Vector3(portR, 0, 0))

      // 生成平滑的 CatmullRom 样条曲线
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.05)
      this._paths.push(curve)
    }

    // 2. 初始化粒子属性缓存区
    const positions = new Float32Array(TOTAL_PARTICLES * 3)
    const progresses = new Float32Array(TOTAL_PARTICLES)
    const pathIndices = new Float32Array(TOTAL_PARTICLES)
    const speeds = new Float32Array(TOTAL_PARTICLES)
    const randomOffsets = new Float32Array(TOTAL_PARTICLES)

    let idx = 0
    for (let p = 0; p < PATH_COUNT; p++) {
      const curve = this._paths[p]
      for (let i = 0; i < PARTICLE_COUNT_PER_PATH; i++) {
        // 均匀且带随机扰动的初始进度分布
        const progress = (i / PARTICLE_COUNT_PER_PATH + Math.random() * 0.03) % 1.0
        progresses[idx] = progress
        pathIndices[idx] = p
        speeds[idx] = 0.08 + Math.random() * 0.06 // 进度递增速度
        randomOffsets[idx] = Math.random()

        // 采样样条曲线获取 3D 位置
        const pos = curve.getPointAt(progress)
        positions[idx * 3] = pos.x
        positions[idx * 3 + 1] = pos.y
        positions[idx * 3 + 2] = 0.0 // 贴合在凹槽底面
        idx++
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('progress', new THREE.BufferAttribute(progresses, 1))
    geo.setAttribute('pathIdx', new THREE.BufferAttribute(pathIndices, 1))
    geo.setAttribute('speed', new THREE.BufferAttribute(speeds, 1))
    geo.setAttribute('aRand', new THREE.BufferAttribute(randomOffsets, 1))

    // 3. 构建高科技流态分析着色器材质 (CFD Shader)
    this._particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 1.0 },
        uDirection: { value: this._direction },
        uAnalysisMode: { value: this._analysisMode },
        uFlowVelocity: { value: this._flowVelocity },
        uBaseColor: { value: new THREE.Color(GLOW_COLOR) },
        uIsAnode: { value: isAnode ? 1.0 : 0.0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uDirection;
        uniform int uAnalysisMode;
        uniform float uFlowVelocity;
        uniform float uIsAnode;

        attribute float progress;
        attribute float speed;
        attribute float pathIdx;
        attribute float aRand;

        varying vec3 vWorldPos;
        varying float vProgress;
        varying float vAlpha;
        varying float vSpeedLocal;

        void main() {
          vProgress = progress;
          vWorldPos = position;

          // 计算局部流速 (vSpeedLocal)：
          // 在进出口收缩区 (abs(x) > 14.0) 由于截面积急剧缩小，流速高；
          // 在中心平行的 11 条流道区 (abs(x) <= 14.0) 由于分流，流速低。
          float xDist = abs(position.x);
          float speedFactor = 1.0;
          if (xDist > 14.0) {
            speedFactor = 2.4 - (xDist - 14.0) * 0.08; // 管道汇聚，流速翻倍
          } else {
            speedFactor = 0.75 + sin(pathIdx * 0.5) * 0.15; // 平行分流通道流速低且有微弱分布差异
          }
          vSpeedLocal = speedFactor;

          // 计算粒子波动动画
          vec3 pos = position;
          
          if (uAnalysisMode == 3) {
            // 两相流气泡抖动效应
            // 气体产生位置 (向出口推进过程中 abs(x) 越小且越接近出口，含气率越高)
            float gasTrigger = uDirection > 0.0 ? (position.x + 13.0)/26.0 : (13.0 - position.x)/26.0;
            gasTrigger = clamp(gasTrigger, 0.0, 1.0);
            
            // 气泡高频布朗运动抖动
            if (gasTrigger > 0.1) {
              pos.x += sin(uTime * 15.0 + aRand * 20.0) * 0.28 * gasTrigger;
              pos.y += cos(uTime * 18.0 + aRand * 20.0) * 0.22 * gasTrigger;
            }
          }

          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPos;

          // 计算粒子渲染大小 (gl_PointSize)
          float baseSize = 2.5 + sin(uTime * 3.0 + pathIdx * 1.5) * 0.8;
          
          if (uAnalysisMode == 3) {
            // 两相流模式：水流进入反应区电解生成气泡，气泡随着向前流动体积呈指数放大
            float bubbleProgress = uDirection > 0.0 ? (pos.x + 24.0)/48.0 : (24.0 - pos.x)/48.0;
            bubbleProgress = clamp(bubbleProgress, 0.0, 1.0);
            // 出口处气泡大小是入口的 2.5 倍
            baseSize = baseSize * (1.0 + pow(bubbleProgress, 2.0) * 1.8);
          }
          
          // 基于相机深度微调粒子尺寸，增加立体感。同时限制最大与最小值，防止除以 0、负数或粒子贴近相机时尺寸爆炸导致渲染出黑色方块。
          gl_PointSize = clamp(baseSize * (300.0 / max(1.0, -mvPos.z)), 1.0, 64.0);
          
          // 计算粒子边缘渐变透明度 (防止在端部进出口处瞬间消失/闪烁)
          float endFade = sin(progress * 3.14159);
          vAlpha = pow(endFade, 0.5);
        }
      `,
      fragmentShader: `
        uniform int uAnalysisMode;
        uniform vec3 uBaseColor;
        uniform float uTime;
        uniform float uDirection;
        uniform float uIsAnode;

        varying vec3 vWorldPos;
        varying float vProgress;
        varying float vAlpha;
        varying float vSpeedLocal;

        // 经典 JET 伪彩色图谱映射 (CFD 仿真标准彩虹色谱)
        vec3 getJetColor(float value) {
          float v = clamp(value, 0.0, 1.0);
          float r = clamp(min(4.0 * v - 1.5, -4.0 * v + 4.5), 0.0, 1.0);
          float g = clamp(min(4.0 * v - 0.5, -4.0 * v + 3.5), 0.0, 1.0);
          float b = clamp(min(4.0 * v + 0.5, -4.0 * v + 2.5), 0.0, 1.0);
          return vec3(r, g, b);
        }

        void main() {
          // 圆形发光粒子剔除
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);

          vec3 finalColor = uBaseColor;
          float localAlpha = vAlpha;

          if (uAnalysisMode == 0) {
            // 模式 0: 物理常规流态 (半透明极光蓝)
            finalColor = uBaseColor;
            localAlpha *= 0.85;
          }
          else if (uAnalysisMode == 1) {
            // 模式 1: 流速场分析 (CFD Velocity magnitude)
            // 进出口收缩管道流速极高 (映射为暖橙/红色)，平行分流区流速低 (映射为青绿/蓝色)
            float normSpeed = (vSpeedLocal - 0.6) / 1.8; // 归一化流速 [0, 1]
            finalColor = getJetColor(normSpeed);
            localAlpha *= 0.95;
          }
          else if (uAnalysisMode == 2) {
            // 模式 2: 压力降分析 (CFD Pressure drop)
            // 沿 X 轴流动方向自左向右呈现压降 (入口红 -> 中间黄绿 -> 出口蓝)
            float pressRatio = (vWorldPos.x + 24.0) / 48.0; // [-24, 24] -> [0, 1]
            if (uDirection < 0.0) {
              pressRatio = 1.0 - pressRatio; // 考虑流向反转时的压力降方向
            }
            // 压降衰减颜色：1.0(高压) -> 0.0(低压)
            finalColor = getJetColor(1.0 - pressRatio);
            localAlpha *= 0.90;
          }
          else if (uAnalysisMode == 3) {
            // 模式 3: 含气率两相流 (CFD Gas Void Fraction)
            // 反应区前为纯净水流 (深蓝色)，反应区及出口为高浓度发光气泡 (白/银色)
            float bubbleRatio = uDirection > 0.0 ? (vWorldPos.x + 20.0)/40.0 : (20.0 - vWorldPos.x)/40.0;
            bubbleRatio = clamp(bubbleRatio, 0.0, 1.0);
            
            vec3 waterColor = vec3(0.0, 0.4, 0.95);
            vec3 gasBubbleColor = uIsAnode > 0.5 ? vec3(0.95, 0.98, 1.0) : vec3(0.92, 1.0, 0.94); // 阳极氧气银白，阴极氢气微绿
            
            // 渐变过渡：入口 -> 产气反应区
            finalColor = mix(waterColor, gasBubbleColor, pow(bubbleRatio, 1.5));
            // 气泡具有更高亮度
            localAlpha *= mix(0.7, 1.0, bubbleRatio);
          }

          gl_FragColor = vec4(finalColor, glow * localAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    this._particles = new THREE.Points(geo, this._particleMat)
    this.group.add(this._particles)

    // 添加一层背景流线发光几何体以托底，增强视觉丰满度
    this._createBackgroundFlowPipes()

    this.group.visible = false
    return this
  }

  /**
   * 创建流道底盘的半透明管道线条，以呈现完整管道结构
   */
  _createBackgroundFlowPipes() {
    const pipeGroup = new THREE.Group()
    pipeGroup.name = 'backgroundPipes'

    const pipeMat = new THREE.MeshBasicMaterial({
      color: 0x004c88,
      transparent: true,
      opacity: 0.08,
      wireframe: false,
      side: THREE.DoubleSide
    })

    // 对 11 条样条曲线生成窄条带几何体
    for (const curve of this._paths) {
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.38, 4, false)
      const tubeMesh = new THREE.Mesh(tubeGeo, pipeMat)
      pipeGroup.add(tubeMesh)
    }

    this.group.add(pipeGroup)
    this._bgPipes = pipeGroup
  }

  /**
   * 每一帧的渲染循环驱动
   */
  update(delta) {
    if (!this._visible || !this._particles) return

    // 1. 更新着色器时间与速度 uniforms
    this._time += delta * this._speed * this._direction
    this._particleMat.uniforms.uTime.value = this._time
    this._particleMat.uniforms.uSpeed.value = this._speed
    this._particleMat.uniforms.uFlowVelocity.value = this._flowVelocity
    this._particleMat.needsUpdate = true

    // 2. 动态调节背景流道线条的荧光闪烁，使其具有流体生命感
    if (this._bgPipes) {
      const pulse = 0.05 + Math.sin(this._time * 2.2) * 0.03
      this._bgPipes.traverse(c => {
        if (c.isMesh && c.material) {
          c.material.opacity = this._analysisMode === 0 ? pulse : pulse * 0.3
          if (this._analysisMode === 1) {
            c.material.color.setHex(0x335522) // 流态分析下调低荧光干扰
          } else if (this._analysisMode === 2) {
            c.material.color.setHex(0x223344)
          } else {
            c.material.color.setHex(0x004c88)
          }
        }
      })
    }

    // 3. 在 CPU 端更新粒子进度，重新采样样条曲线位置以保证路径绝对高精度
    const positions = this._particles.geometry.attributes.position.array
    const progresses = this._particles.geometry.attributes.progress.array
    const speeds = this._particles.geometry.attributes.speed.array

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const pIdx = Math.floor(i / PARTICLE_COUNT_PER_PATH)
      const curve = this._paths[pIdx]
      if (!curve) continue

      // 计算流动速率：融合传感器流速、局部流道狭窄因子和粒子固有速率
      let localSpeedFactor = 1.0
      const currentX = positions[i * 3]
      if (Math.abs(currentX) > 14.0) {
        localSpeedFactor = 1.8 // 收缩汇聚段流速激增
      } else {
        localSpeedFactor = 0.85
      }

      // 累加流动进度
      const step = delta * this._speed * speeds[i] * this._flowVelocity * localSpeedFactor * 1.5
      progresses[i] = (progresses[i] + step) % 1.0

      // 重新采样 3D 坐标
      const pos = curve.getPointAt(progresses[i])
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = 0.0 // 紧贴流槽底部
    }

    this._particles.geometry.attributes.position.needsUpdate = true
    this._particles.geometry.attributes.progress.needsUpdate = true
  }

  /**
   * 设置动画速度
   */
  setSpeed(speed) {
    this._speed = Math.max(0.1, Math.min(5.0, speed))
  }

  /**
   * 设置多物理场分析模式 (CFD Mode)
   * @param {number} mode - 0:常规, 1:流速, 2:压力, 3:两相流, 4:关闭
   */
  setAnalysisMode(mode) {
    this._analysisMode = mode
    if (this._particleMat) {
      this._particleMat.uniforms.uAnalysisMode.value = mode
      this._particleMat.needsUpdate = true
    }
    if (mode === 4) {
      this.setVisible(false)
    } else {
      this.setVisible(true)
    }
  }

  /**
   * 接收来自传感器的实时流量数据 (0-1 范围)
   */
  setFlowVelocity(velocity) {
    this._flowVelocity = Math.max(0.05, Math.min(1.0, velocity))
    if (this._particleMat) {
      this._particleMat.uniforms.uFlowVelocity.value = this._flowVelocity
      this._particleMat.needsUpdate = true
    }
  }

  /**
   * 设置全局可见性
   */
  setVisible(visible) {
    this._visible = visible
    this.group.visible = visible
  }

  /**
   * 销毁资源，防止显存和内存泄露
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