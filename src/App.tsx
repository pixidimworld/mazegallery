import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Sky, useGLTF, useTexture } from '@react-three/drei'
import {
  BvhPhysicsBody,
  IdleAnimationUrl,
  SimpleCharacter,
  useCharacterAnimationLoader,
  useCharacterModelLoader,
  Viverse,
} from '@react-three/viverse'
import {
  Box3,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MathUtils,
  Matrix3,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Vector3,
} from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

import mazeGalleryUrl from '../mazegallery1.glb?url'
import messenger2VrmUrl from '../messenger2.vrm?url'
import messengerVrmUrl from '../messenger.vrm?url'
import messengerTalkUrl from '../messengertalk.mp3?url'
import mainVrmUrl from '../main.vrm?url'
import bgMusicUrl from '../bg music.mp3?url'
import clickAudioUrl from '../click.mp3?url'
import footRunningUrl from '../footrunning.mp3?url'
import footWalkUrl from '../footwalk.mp3?url'
import jumpAudioUrl from '../jump.mp3?url'
import wallDiffuseUrl from '../walldiffuse.png?url'

const GRASS_CONFIG = {
  bladeCount: 78000,
  bladeWidth: 0.095,
  bladeHeight: 1.02,
  windSpeed: 0.4,
  turbulence: 0.54,
  sunAzimuth: 185,
  sunElevation: 51,
  baseColor: '#4f8c2f',
  tipColor: '#c5ea78',
}

const FEATURE_LINK_POSITION: [number, number, number] = [-6.05, 1.04, 3.58]

type SceneMesh = Mesh & Object3D & { isMesh?: boolean }
type MobilePadThumb = { x: number; y: number }

type MobileMoveDirection = '' | 'back' | 'forward'

type MobileTurnDirection = '' | 'left' | 'right'

function MobileControls({
  visible,
  onMoveChange,
  onTurnChange,
  onJump,
}: {
  visible: boolean
  onMoveChange: (direction: MobileMoveDirection) => void
  onTurnChange: (direction: MobileTurnDirection) => void
  onJump: () => void
}) {
  const [moveThumb, setMoveThumb] = useState<MobilePadThumb>({ x: 0, y: 0 })
  const [turnThumb, setTurnThumb] = useState<MobilePadThumb>({ x: 0, y: 0 })

  const updateMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const radius = bounds.width * 0.34
    const localX = event.clientX - (bounds.left + bounds.width / 2)
    const localY = event.clientY - (bounds.top + bounds.height / 2)
    const distance = Math.hypot(localX, localY)
    const scale = distance > radius ? radius / distance : 1
    const x = localX * scale
    const y = localY * scale
    setMoveThumb({ x, y })

    if (Math.abs(y) < 10) {
      onMoveChange('')
      return
    }

    onMoveChange(y < 0 ? 'forward' : 'back')
  }

  const updateTurn = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const radius = bounds.width * 0.34
    const localX = event.clientX - (bounds.left + bounds.width / 2)
    const localY = event.clientY - (bounds.top + bounds.height / 2)
    const distance = Math.hypot(localX, localY)
    const scale = distance > radius ? radius / distance : 1
    const x = localX * scale
    const y = localY * scale
    setTurnThumb({ x, y })

    if (Math.abs(x) < 10) {
      onTurnChange('')
      return
    }

    onTurnChange(x < 0 ? 'left' : 'right')
  }

  const resetMove = () => {
    setMoveThumb({ x: 0, y: 0 })
    onMoveChange('')
  }

  const resetTurn = () => {
    setTurnThumb({ x: 0, y: 0 })
    onTurnChange('')
  }

  if (!visible) {
    return null
  }

  return (
    <div className="mobile-controls" data-no-global-dismiss="true">
      <div
        className="joystick-pad"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          updateMove(event)
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 0) {
            updateMove(event)
          }
        }}
        onPointerUp={resetMove}
        onPointerCancel={resetMove}
      >
        <div className="joystick-label">Move</div>
        <div className="joystick-thumb" style={{ transform: `translate(${moveThumb.x}px, ${moveThumb.y}px)` }} />
      </div>

      <button className="mobile-jump-button" type="button" onClick={onJump}>
        Jump
      </button>

      <div
        className="joystick-pad"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          updateTurn(event)
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 0) {
            updateTurn(event)
          }
        }}
        onPointerUp={resetTurn}
        onPointerCancel={resetTurn}
      >
        <div className="joystick-label">Turn</div>
        <div className="joystick-thumb" style={{ transform: `translate(${turnThumb.x}px, ${turnThumb.y}px)` }} />
      </div>
    </div>
  )
}

function createGrassBladeTexture(maxAnisotropy: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 512

  const context = canvas.getContext('2d')
  if (context != null) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.beginPath()
    context.moveTo(canvas.width * 0.5, canvas.height)
    context.bezierCurveTo(
      canvas.width * 0.08,
      canvas.height * 0.76,
      canvas.width * 0.18,
      canvas.height * 0.08,
      canvas.width * 0.5,
      0,
    )
    context.bezierCurveTo(
      canvas.width * 0.82,
      canvas.height * 0.08,
      canvas.width * 0.92,
      canvas.height * 0.76,
      canvas.width * 0.5,
      canvas.height,
    )
    context.closePath()

    const fill = context.createLinearGradient(0, canvas.height, 0, 0)
    fill.addColorStop(0, '#8eb563')
    fill.addColorStop(0.55, '#d8efac')
    fill.addColorStop(1, '#ffffff')
    context.fillStyle = fill
    context.fill()

    context.globalCompositeOperation = 'multiply'
    context.strokeStyle = 'rgba(72, 110, 42, 0.45)'
    context.lineWidth = 3
    for (let index = 0; index < 10; index += 1) {
      const x = 20 + index * 24
      context.beginPath()
      context.moveTo(x, canvas.height)
      context.quadraticCurveTo(canvas.width * 0.5, canvas.height * 0.34, canvas.width * 0.5, 0)
      context.stroke()
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = maxAnisotropy
  texture.colorSpace = SRGBColorSpace
  return texture
}

function createGrassBladeGeometry(width: number, height: number) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let row = 0; row <= 7; row += 1) {
    const t = row / 7
    const bladeWidth = width * (1 - t * 0.72)
    const bend = bladeWidth * 0.28

    positions.push(-bladeWidth / 2, height * t, 0)
    uvs.push(0, t)
    positions.push(0, height * t, bend)
    uvs.push(0.5, t)
    positions.push(bladeWidth / 2, height * t, 0)
    uvs.push(1, t)
  }

  for (let row = 0; row < 7; row += 1) {
    const a = row * 3
    const b = (row + 1) * 3
    indices.push(a, a + 1, b)
    indices.push(b, a + 1, b + 1)
    indices.push(a + 1, a + 2, b + 1)
    indices.push(b + 1, a + 2, b + 2)
  }

  const geometry = new BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new InstancedBufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('uv', new InstancedBufferAttribute(new Float32Array(uvs), 2))
  geometry.computeVertexNormals()
  return geometry
}

function createGrassLightDirection() {
  const elevation = MathUtils.degToRad(GRASS_CONFIG.sunElevation)
  const azimuth = MathUtils.degToRad(GRASS_CONFIG.sunAzimuth)
  return new Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  ).normalize()
}

function ProceduralGrass({ sourceMesh }: { sourceMesh: SceneMesh | null }) {
  const { gl } = useThree()

  const bladeTexture = useMemo(
    () => createGrassBladeTexture(gl.capabilities.getMaxAnisotropy()),
    [gl],
  )

  const geometry = useMemo(() => {
    if (sourceMesh == null) {
      return null
    }

    sourceMesh.updateWorldMatrix(true, false)

    const baseGeometry = createGrassBladeGeometry(GRASS_CONFIG.bladeWidth, GRASS_CONFIG.bladeHeight)
    const grassGeometry = new InstancedBufferGeometry()
    grassGeometry.index = baseGeometry.index
    grassGeometry.setAttribute('position', baseGeometry.getAttribute('position'))
    grassGeometry.setAttribute('normal', baseGeometry.getAttribute('normal'))
    grassGeometry.setAttribute('uv', baseGeometry.getAttribute('uv'))

    const offsets = new Float32Array(GRASS_CONFIG.bladeCount * 3)
    const scales = new Float32Array(GRASS_CONFIG.bladeCount)
    const rotations = new Float32Array(GRASS_CONFIG.bladeCount)
    const seeds = new Float32Array(GRASS_CONFIG.bladeCount)

    const sampler = new MeshSurfaceSampler(sourceMesh).build()
    const point = new Vector3()
    const normal = new Vector3()
    const transformedNormal = new Vector3()
    const normalMatrix = new Matrix3().getNormalMatrix(sourceMesh.matrixWorld)

    for (let index = 0; index < GRASS_CONFIG.bladeCount; index += 1) {
      let attempts = 0
      do {
        sampler.sample(point, normal)
        transformedNormal.copy(normal).applyMatrix3(normalMatrix).normalize()
        attempts += 1
      } while (transformedNormal.y < 0.45 && attempts < 6)

      point.applyMatrix4(sourceMesh.matrixWorld)
      point.addScaledVector(transformedNormal, 0.01)

      offsets[index * 3] = point.x
      offsets[index * 3 + 1] = point.y
      offsets[index * 3 + 2] = point.z
      scales[index] = MathUtils.lerp(0.78, 1.42, Math.random())
      rotations[index] = Math.random() * Math.PI * 2
      seeds[index] = Math.random()
    }

    grassGeometry.setAttribute('aOffset', new InstancedBufferAttribute(offsets, 3))
    grassGeometry.setAttribute('aScale', new InstancedBufferAttribute(scales, 1))
    grassGeometry.setAttribute('aRotation', new InstancedBufferAttribute(rotations, 1))
    grassGeometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1))
    grassGeometry.instanceCount = GRASS_CONFIG.bladeCount
    grassGeometry.computeBoundingSphere()

    baseGeometry.dispose()

    return grassGeometry
  }, [sourceMesh])

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWindSpeed: { value: GRASS_CONFIG.windSpeed },
        uTurbulence: { value: GRASS_CONFIG.turbulence },
        uBladeMap: { value: bladeTexture },
        uBaseColor: { value: new Vector3(0.3098, 0.549, 0.1843) },
        uTipColor: { value: new Vector3(0.7725, 0.9176, 0.4706) },
        uLightDirection: { value: createGrassLightDirection() },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWindSpeed;
        uniform float uTurbulence;

        attribute vec3 aOffset;
        attribute float aScale;
        attribute float aRotation;
        attribute float aSeed;

        varying vec2 vUv;
        varying float vHeight;
        varying float vSeed;
        varying float vCluster;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        vec3 permute(vec3 x) {
          return mod(((x * 34.0) + 1.0) * x, 289.0);
        }

        float snoise(vec2 v) {
          const vec4 C = vec4(
            0.211324865405187,
            0.366025403784439,
            -0.577350269189626,
            0.024390243902439
          );
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute(
            permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
          );
          vec3 m = max(0.5 - vec3(
            dot(x0, x0),
            dot(x12.xy, x12.xy),
            dot(x12.zw, x12.zw)
          ), 0.0);
          m = m * m;
          m = m * m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
          vUv = uv;
          vHeight = uv.y;
          vSeed = aSeed;

          vec3 transformed = position;
          transformed.y *= aScale;

          float cosine = cos(aRotation);
          float sine = sin(aRotation);
          mat3 rotateY = mat3(
            cosine, 0.0, sine,
            0.0, 1.0, 0.0,
            -sine, 0.0, cosine
          );
          transformed = rotateY * transformed;

          float cluster = clamp(snoise(vec2(aOffset.x * 0.055, aOffset.z * 0.055)) * 0.5 + 0.5, 0.0, 1.0);
          float gust = snoise(vec2(
            aOffset.x * 0.11 + uTime * uWindSpeed,
            aOffset.z * 0.09 + uTime * uWindSpeed * 0.82
          ));
          float ripple = snoise(vec2(
            aOffset.x * 0.3 - uTime * (uWindSpeed * 0.55),
            aOffset.z * 0.28 + aSeed * 4.0
          ));
          float flutter = snoise(vec2(
            aSeed * 8.0 + uTime * 0.4,
            aOffset.x * 0.18 + aOffset.z * 0.18
          ));

          float heightMask = pow(uv.y, 1.8);
          float forwardLean = mix(0.09, 0.24, aSeed) * mix(0.85, 1.18, cluster) * heightMask;
          float sideLean = mix(-0.08, 0.08, fract(aSeed * 17.31)) * pow(uv.y, 1.3);
          float bend = (
            gust * 0.56 +
            ripple * 0.18 * uTurbulence +
            flutter * 0.08 * uTurbulence
          ) * heightMask;

          transformed.x += forwardLean + bend * 0.18;
          transformed.z += sideLean + bend * 0.12;

          float windAngle = snoise(vec2(
            aOffset.x * 0.04 + uTime * (uWindSpeed * 0.1),
            aOffset.z * 0.04 - uTime * (uWindSpeed * 0.08)
          )) * 1.35;
          vec2 windDirection = vec2(cos(windAngle), sin(windAngle));
          transformed.xz += windDirection * bend * mix(0.16, 0.3, cluster);

          vec2 toCamera = normalize((cameraPosition.xz - aOffset.xz) + vec2(0.0001));
          transformed.xz += toCamera * (0.012 + uv.y * 0.028) * (0.84 + cluster * 0.28);

          vec3 roundedNormal = normalize(mix(normal, vec3(0.0, 0.5, 0.86), 0.3 + 0.24 * uv.y));
          vec3 worldPosition = transformed + aOffset;
          vec3 worldNormal = normalize(rotateY * roundedNormal);

          vCluster = cluster;
          vWorldPosition = worldPosition;
          vWorldNormal = worldNormal;

          gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uBladeMap;
        uniform vec3 uBaseColor;
        uniform vec3 uTipColor;
        uniform vec3 uLightDirection;

        varying vec2 vUv;
        varying float vHeight;
        varying float vSeed;
        varying float vCluster;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        void main() {
          vec4 blade = texture2D(uBladeMap, vUv);
          if (blade.a < 0.25) discard;

          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 normal = normalize(vWorldNormal);
          if (!gl_FrontFacing) {
            normal *= -1.0;
          }

          vec3 lightDir = normalize(uLightDirection);
          float wrap = 0.55;
          float diffuse = max((dot(normal, lightDir) + wrap) / (1.0 + wrap), 0.0);
          float backLight = pow(max(dot(viewDir, -lightDir), 0.0), 2.1) * (0.14 + 0.86 * vHeight);
          float ao = mix(0.5, 1.0, smoothstep(0.04, 0.84, vHeight)) * mix(0.76, 1.0, vCluster);
          float halfVector = max(dot(normal, normalize(lightDir + viewDir)), 0.0);
          float sheen = pow(halfVector, 10.0) * 0.14;
          float glint = pow(halfVector, 24.0) * 0.16;

          vec3 dryTint = vec3(0.74, 0.68, 0.42);
          vec3 localBase = mix(uBaseColor, dryTint, smoothstep(0.8, 1.0, vSeed) * 0.22);
          vec3 rootColor = vec3(0.04, 0.07, 0.025);
          vec3 gradient = mix(
            mix(rootColor, localBase, smoothstep(0.0, 0.26, vHeight)),
            uTipColor,
            smoothstep(0.18, 1.0, vHeight)
          );

          vec3 litColor = gradient * blade.rgb;
          vec3 finalColor = (litColor * (0.22 + diffuse) + uTipColor * backLight * 0.66 + vec3(sheen + glint)) * ao;

          gl_FragColor = vec4(finalColor, blade.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      alphaTest: 0.18,
      side: DoubleSide,
      depthWrite: true,
    })
  }, [bladeTexture])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uLightDirection.value.copy(createGrassLightDirection())
  })

  useEffect(() => {
    return () => {
      geometry?.dispose()
      material.dispose()
      bladeTexture.dispose()
    }
  }, [bladeTexture, geometry, material])

  if (geometry == null) {
    return null
  }

  return <mesh geometry={geometry} material={material} frustumCulled={false} castShadow />
}

function GalleryFeatureLink({
  position,
  onOpen,
}: {
  position: [number, number, number]
  onOpen: () => void
}) {
  const marker = useRef<Group>(null)

  useFrame((state) => {
    const root = marker.current
    if (root == null) {
      return
    }

    root.position.set(
      position[0],
      position[1],
      position[2] + Math.sin(state.clock.elapsedTime * 0.8) * 0.015,
    )

    const arrow = root.children[1]
    if (arrow != null) {
      arrow.position.y = 0.88 + Math.sin(state.clock.elapsedTime * 2.2) * 0.06
    }
  })

  return (
    <group ref={marker} position={position}>
      <mesh castShadow receiveShadow onClick={onOpen}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#72706d" roughness={0.98} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.88, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.22, 18]} />
        <meshStandardMaterial color="#3d3d3f" roughness={0.7} metalness={0.03} />
      </mesh>
      <Html center position={[0, 1.18, 0]} distanceFactor={12}>
        <div className="feature-rock-label">about pixi</div>
      </Html>
    </group>
  )
}

function MazeGallery({
  onOpenPixidimworld,
}: {
  onOpenPixidimworld: () => void
}) {
  const gltf = useGLTF(mazeGalleryUrl)
  const { gl } = useThree()
  const wallDiffuse = useTexture(wallDiffuseUrl)

  const grassMesh = useMemo(() => {
    gltf.scene.updateMatrixWorld(true)

    let groundMesh: SceneMesh | null = null
    gltf.scene.traverse((object) => {
      const mesh = object as SceneMesh
      if (groundMesh == null && mesh.isMesh && object.name === 'grass1') {
        groundMesh = mesh
      }
    })

    return groundMesh
  }, [gltf.scene])

  useEffect(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy()
    wallDiffuse.colorSpace = SRGBColorSpace
    wallDiffuse.anisotropy = maxAnisotropy

    gltf.scene.traverse((object) => {
      const mesh = object as SceneMesh & {
        castShadow?: boolean
        receiveShadow?: boolean
        name?: string
        material?: MeshStandardMaterial | MeshStandardMaterial[]
      }

      if (!mesh.isMesh) {
        return
      }

      mesh.castShadow = true
      mesh.receiveShadow = true

      if (mesh.geometry.getAttribute('uv') != null && mesh.geometry.getAttribute('uv2') == null) {
        mesh.geometry.setAttribute('uv2', mesh.geometry.getAttribute('uv'))
      }

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const rawMaterial of materials) {
        if (!(rawMaterial instanceof MeshStandardMaterial)) {
          continue
        }

        const material = rawMaterial
        if (material.map != null) {
          material.map.anisotropy = maxAnisotropy
          material.map.colorSpace = SRGBColorSpace
        }

        if (mesh.name === 'grass1' || material.name === 'grass1') {
          material.bumpMap = null
          material.roughness = 0.5
          material.metalness = 0
          material.color.set('#ffffff')
          material.aoMap = material.map
          material.aoMapIntensity = 0.2
        }

        if (mesh.name === 'Text') {
          material.color.set('#404040')
          material.roughness = 0.8
          material.metalness = 0.02
        }

        if (material.name === 'Material.001') {
          material.map = wallDiffuse
          material.aoMap = wallDiffuse
          material.aoMapIntensity = 0.7
          material.color.set('#ece8e1')
          material.roughness = 0.98
          material.metalness = 0
        }

        material.needsUpdate = true
      }
    })
  }, [gltf.scene, gl, wallDiffuse])

  return (
    <group>
      <primitive object={gltf.scene} />
      <ProceduralGrass sourceMesh={grassMesh} />
      <GalleryFeatureLink position={FEATURE_LINK_POSITION} onOpen={onOpenPixidimworld} />
    </group>
  )
}

function IdleMessenger({
  url,
  position,
  rotation,
  scale = 1,
}: {
  url: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale?: number
}) {
  const model = useCharacterModelLoader({
    type: 'vrm',
    url,
    useViverseAvatar: false,
  })
  const idleClip = useCharacterAnimationLoader(model, { url: IdleAnimationUrl })

  useEffect(() => {
    model.scene.traverse((object) => {
      const mesh = object as Mesh & Object3D & {
        isMesh?: boolean
        castShadow?: boolean
        receiveShadow?: boolean
      }

      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })

    const action = model.mixer.clipAction(idleClip)
    action.reset().play()

    return () => {
      action.stop()
    }
  }, [idleClip, model])

  useFrame((_, delta) => {
    model.mixer.update(delta)
  })

  return (
    <primitive
      object={model.scene}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  )
}

function BirdFlock() {
  const flock = useRef<Group>(null)

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const root = flock.current
    if (root == null) {
      return
    }

    root.children.forEach((bird, index) => {
      const radius = 9 + index * 1.2
      const speed = 0.18 + index * 0.024
      const angle = time * speed + index * 1.5

      bird.position.set(
        Math.cos(angle) * radius,
        8.5 + Math.sin(time * 0.7 + index) * 0.5,
        Math.sin(angle) * radius - 1.5,
      )
      bird.rotation.y = -angle + Math.PI / 2
      bird.rotation.z = Math.sin(time * 8 + index) * 0.18
    })
  })

  return (
    <group ref={flock}>
      {Array.from({ length: 9 }, (_, index) => (
        <group key={index} scale={0.22 + index * 0.025}>
          <mesh position={[-0.45, 0, 0]} rotation={[0, 0, 0.45]}>
            <boxGeometry args={[0.9, 0.06, 0.12]} />
            <meshStandardMaterial color="#2c3138" roughness={0.9} />
          </mesh>
          <mesh position={[0.45, 0, 0]} rotation={[0, 0, -0.45]}>
            <boxGeometry args={[0.9, 0.06, 0.12]} />
            <meshStandardMaterial color="#2c3138" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function CloudDrift() {
  const clouds = useRef<Group>(null)

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const root = clouds.current
    if (root == null) {
      return
    }

    root.children.forEach((cloud, index) => {
      const angle = time * (0.035 + index * 0.006) + index * 1.1
      const radius = 14 + index * 2.3
      cloud.position.set(
        Math.cos(angle) * radius,
        10.5 + index * 0.35 + Math.sin(time * 0.4 + index) * 0.22,
        Math.sin(angle) * radius - 4,
      )
      cloud.rotation.y = -angle * 0.5
    })
  })

  return (
    <group ref={clouds}>
      {Array.from({ length: 5 }, (_, index) => (
        <group key={index}>
          <mesh position={[-1.2, 0, 0]} scale={[1.6, 0.7, 0.9]}>
            <sphereGeometry args={[1, 14, 14]} />
            <meshStandardMaterial color="#f4f5f0" roughness={1} metalness={0} />
          </mesh>
          <mesh position={[0, 0.18, 0]} scale={[2.1, 0.85, 1]}>
            <sphereGeometry args={[1, 14, 14]} />
            <meshStandardMaterial color="#f4f5f0" roughness={1} metalness={0} />
          </mesh>
          <mesh position={[1.35, -0.04, 0.1]} scale={[1.55, 0.68, 0.88]}>
            <sphereGeometry args={[1, 14, 14]} />
            <meshStandardMaterial color="#f4f5f0" roughness={1} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Loader() {
  return (
    <Html fullscreen>
      <div className="loading-screen">
        <div className="loading-title">LOADING ...</div>
        <div className="loading-track">
          <div className="loading-bar" />
        </div>
      </div>
    </Html>
  )
}

function MusicIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ui-icon-svg">
      <path
        d="M14 4v10.2a2.8 2.8 0 1 1-1.2-2.3V7.3l6.2-1.6v6.5a2.8 2.8 0 1 1-1.2-2.3V4.1L14 5z"
        fill="currentColor"
      />
      {muted ? <path d="M5 5l14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : null}
    </svg>
  )
}

function TypewriterCard({
  lines,
}: {
  lines: string[]
}) {
  const [activeLineIndex, setActiveLineIndex] = useState(0)

  useEffect(() => {
    setActiveLineIndex(0)
    if (lines.length <= 1) {
      return
    }

    const timers = lines.slice(1).map((_, index) =>
      window.setTimeout(() => {
        setActiveLineIndex(index + 1)
      }, (index + 1) * 2200),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [lines])

  const currentLine = lines[activeLineIndex] ?? ''

  return (
    <div className="messenger-card-text">
      <p key={`${activeLineIndex}-${currentLine.slice(0, 12)}`} className="messenger-line">
        {currentLine}
      </p>
    </div>
  )
}

function MessengerInteractions({
  onUiClick,
}: {
  onUiClick: () => void
}) {
  const { camera, gl } = useThree()
  const [activeMessenger, setActiveMessenger] = useState<null | 'welcome' | 'checkin'>(null)
  const [nearWelcome, setNearWelcome] = useState(false)
  const [nearCheckin, setNearCheckin] = useState(false)
  const talkAudioRef = useRef<HTMLAudioElement | null>(null)
  const proximityRef = useRef({ nearWelcome: false, nearCheckin: false })

  const welcomePosition = useMemo(() => new Vector3(-4.5, 0.95, 3.1), [])
  const checkinPosition = useMemo(() => new Vector3(5.6, 0.95, -1.5), [])

  const welcomeLines = useMemo(
    () => [
      'Welcome to pixidimworld maze art gallery.',
      'This is a website maze gallery exploring the 2d art of what the owner Donald Imhanwa drew as an artist.',
      'The purpose of the site is to display his art to the world soo they see what he can draw, all art are drawn from references.',
      'Enjoy ur exploring.',
    ],
    [],
  )

  const checkinLines = useMemo(
    () => ['Hope you are enjoying the website gallery view.'],
    [],
  )

  useEffect(() => {
    const talkAudio = new Audio(messengerTalkUrl)
    talkAudio.preload = 'auto'
    talkAudio.volume = 0.88
    talkAudioRef.current = talkAudio

    return () => {
      talkAudio.pause()
    }
  }, [])

  const restoreMovement = () => {
    requestAnimationFrame(() => restoreSceneControls(gl.domElement))
  }

  useFrame(() => {
    const welcomeDistance = camera.position.distanceTo(welcomePosition)
    const checkinDistance = camera.position.distanceTo(checkinPosition)
    const nextNearWelcome = welcomeDistance < 7.4
    const nextNearCheckin = checkinDistance < 7.4

    if (proximityRef.current.nearWelcome !== nextNearWelcome) {
      proximityRef.current.nearWelcome = nextNearWelcome
      setNearWelcome(nextNearWelcome)
      if (!nextNearWelcome && activeMessenger === 'welcome') {
        setActiveMessenger(null)
        const talkAudio = talkAudioRef.current
        if (talkAudio != null) {
          talkAudio.pause()
          talkAudio.currentTime = 0
        }
        restoreMovement()
      }
    }

    if (proximityRef.current.nearCheckin !== nextNearCheckin) {
      proximityRef.current.nearCheckin = nextNearCheckin
      setNearCheckin(nextNearCheckin)
      if (!nextNearCheckin && activeMessenger === 'checkin') {
        setActiveMessenger(null)
        restoreMovement()
      }
    }
  })

  const openWelcome = () => {
    onUiClick()
    setActiveMessenger('welcome')
    const talkAudio = talkAudioRef.current
    if (talkAudio != null) {
      talkAudio.currentTime = 0
      void talkAudio.play().catch(() => {})
    }
  }

  const closeWelcome = () => {
    onUiClick()
    setActiveMessenger(null)
    const talkAudio = talkAudioRef.current
    if (talkAudio != null) {
      talkAudio.pause()
      talkAudio.currentTime = 0
    }
    restoreMovement()
  }

  const openCheckin = () => {
    onUiClick()
    setActiveMessenger('checkin')
  }

  const closeCheckin = () => {
    onUiClick()
    setActiveMessenger(null)
    restoreMovement()
  }

  return (
    <group>
      {(nearWelcome || activeMessenger === 'welcome') ? (
        <group position={[-3.82, 2.62, 3.1]}>
          {activeMessenger !== 'welcome' ? (
            <Html center distanceFactor={10}>
              <button className="messenger-icon-button" type="button" onClick={openWelcome}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="messenger-icon-svg">
                  <path d="M5 6.5h14v8.8H9.8L6 18.4v-3.1H5z" fill="currentColor" />
                </svg>
              </button>
            </Html>
          ) : null}
          {activeMessenger === 'welcome' ? (
            <Html center distanceFactor={12} position={[-0.62, 1.02, 0]}>
              <div className="messenger-card messenger-card-cloud messenger-card-main">
                <button className="messenger-card-close" type="button" onClick={closeWelcome}>
                  x
                </button>
                <TypewriterCard lines={welcomeLines} />
              </div>
            </Html>
          ) : null}
        </group>
      ) : null}

      {(nearCheckin || activeMessenger === 'checkin') ? (
        <group position={[6.28, 2.58, -1.5]}>
          {activeMessenger !== 'checkin' ? (
            <Html center distanceFactor={10}>
              <button className="messenger-icon-button" type="button" onClick={openCheckin}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="messenger-icon-svg">
                  <path d="M5 6.5h14v8.8H9.8L6 18.4v-3.1H5z" fill="currentColor" />
                </svg>
              </button>
            </Html>
          ) : null}
          {activeMessenger === 'checkin' ? (
            <Html center distanceFactor={12} position={[0.56, 0.92, 0]}>
              <div className="messenger-card messenger-card-small messenger-card-cloud">
                <button className="messenger-card-close" type="button" onClick={closeCheckin}>
                  x
                </button>
                <TypewriterCard lines={checkinLines} />
              </div>
            </Html>
          ) : null}
        </group>
      ) : null}
    </group>
  )
}

function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady()
  }, [onReady])

  return null
}

function restoreSceneControls(target?: HTMLElement | null) {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    active.blur()
  }

  const focusTarget = target instanceof HTMLElement ? target : null
  if (focusTarget != null) {
    focusTarget.focus({ preventScroll: true })
    const parent = focusTarget.parentElement
    if (parent instanceof HTMLElement) {
      parent.focus({ preventScroll: true })
    }
  }

  window.focus()
}

function PixidimworldPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <aside className={`feature-panel${open ? ' feature-panel-open' : ''}`} aria-hidden={!open}>
      <button className="feature-panel-close" type="button" onClick={onClose}>
        x
      </button>
      <div className="feature-panel-layout">
        <p className="feature-panel-topic">Pixidimworld</p>
        <h2 className="feature-panel-title">Who Is Pixidimworld And What Do We Create</h2>
        <p className="feature-panel-lead">I am the co owner, a creative frontend dev plus a 3d web designer.</p>
        <p className="feature-panel-copy feature-panel-copy-left">I work based on collaborations and teams.</p>
        <p className="feature-panel-copy feature-panel-copy-right">I make websites that are creative, unique, and arranged like art instead of the usual ordinary layouts. Pixidimworld is known for 3D websites and animations.</p>
      </div>
    </aside>
  )
}

export default function App() {
  const playerSpawn: [number, number, number] = [-9.3, 1.02, 4.25]
  const playerRotation: [number, number, number] = [0, 1.05, 0]
  const [hasLoaded, setHasLoaded] = useState(false)
  const [sceneEntered, setSceneEntered] = useState(false)
  const [showHelpCard, setShowHelpCard] = useState(false)
  const [showPixidimworldPanel, setShowPixidimworldPanel] = useState(false)
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [needsMusicResume, setNeedsMusicResume] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const sceneCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bgMusicRef = useRef<HTMLAudioElement | null>(null)
  const clickAudioRef = useRef<HTMLAudioElement | null>(null)
  const footWalkRef = useRef<HTMLAudioElement | null>(null)
  const footRunRef = useRef<HTMLAudioElement | null>(null)
  const jumpAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioPrimedRef = useRef(false)
  const virtualKeysRef = useRef<Set<string>>(new Set())
  const pressedKeysRef = useRef<Set<string>>(new Set())
  const footstepFrameRef = useRef<number | null>(null)
  const lastStepAtRef = useRef(0)
  const lastJumpAtRef = useRef(0)

  const restorePlayerControls = () => {
    pressedKeysRef.current.clear()
    requestAnimationFrame(() => restoreSceneControls(sceneCanvasRef.current))
  }

  useEffect(() => {
    const bgMusic = new Audio(bgMusicUrl)
    bgMusic.loop = true
    bgMusic.volume = 0.4
    bgMusic.preload = 'auto'
    bgMusicRef.current = bgMusic

    const clickAudio = new Audio(clickAudioUrl)
    clickAudio.volume = 0.45
    clickAudio.preload = 'auto'
    clickAudioRef.current = clickAudio

    const footWalk = new Audio(footWalkUrl)
    footWalk.volume = 0.38
    footWalk.preload = 'auto'
    footWalkRef.current = footWalk

    const footRun = new Audio(footRunningUrl)
    footRun.volume = 0.42
    footRun.preload = 'auto'
    footRunRef.current = footRun

    const jumpAudio = new Audio(jumpAudioUrl)
    jumpAudio.volume = 0.48
    jumpAudio.preload = 'auto'
    jumpAudioRef.current = jumpAudio

    return () => {
      bgMusic.pause()
      clickAudio.pause()
      footWalk.pause()
      footRun.pause()
      jumpAudio.pause()
    }
  }, [])

  const primeAudioPlayback = async () => {
    if (audioPrimedRef.current) {
      return
    }

    const audioList = [
      clickAudioRef.current,
      footWalkRef.current,
      footRunRef.current,
      jumpAudioRef.current,
    ]

    for (const audio of audioList) {
      if (audio == null) {
        continue
      }

      const originalVolume = audio.volume
      try {
        audio.volume = 0
        audio.currentTime = 0
        await audio.play()
        audio.pause()
        audio.currentTime = 0
      } catch {
        // Ignore unlock failures and let normal playback retry later.
      } finally {
        audio.volume = originalVolume
      }
    }

    audioPrimedRef.current = true
  }

  const playClickSound = () => {
    if (!sceneEntered) {
      return
    }

    const clickAudio = clickAudioRef.current
    if (clickAudio == null) {
      return
    }

    clickAudio.currentTime = 0
    void clickAudio.play().catch(() => {})
  }

  const startBackgroundMusic = async () => {
    const bgMusic = bgMusicRef.current
    if (bgMusic == null || !musicEnabled) {
      return
    }

    try {
      await bgMusic.play()
      setNeedsMusicResume(false)
    } catch {
      setNeedsMusicResume(true)
    }
  }

  useEffect(() => {
    const stopFootsteps = () => {
      const footWalk = footWalkRef.current
      const footRun = footRunRef.current

      if (footWalk != null) {
        footWalk.pause()
        footWalk.currentTime = 0
      }

      if (footRun != null) {
        footRun.pause()
        footRun.currentTime = 0
      }
    }

    const isMoveKey = (key: string) =>
      ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)

    const footstepLoop = (now: number) => {
      const activeKeys = pressedKeysRef.current
      const isMoving = Array.from(activeKeys).some(isMoveKey)
      const isRunning = isMoving && activeKeys.has('shift')
      const uiBlockingMovement = !sceneEntered || showHelpCard || showPixidimworldPanel

      if (!uiBlockingMovement && !document.hidden && isMoving) {
        const stepInterval = isRunning ? 250 : 410
        const inactiveAudio = isRunning ? footWalkRef.current : footRunRef.current
        if (inactiveAudio != null && !inactiveAudio.paused) {
          inactiveAudio.pause()
          inactiveAudio.currentTime = 0
        }
        if (now - lastStepAtRef.current >= stepInterval) {
          const stepAudio = isRunning ? footRunRef.current : footWalkRef.current
          if (stepAudio != null) {
            stepAudio.currentTime = 0
            void stepAudio.play().catch(() => {})
          }
          lastStepAtRef.current = now
        }
      } else {
        stopFootsteps()
      }

      footstepFrameRef.current = requestAnimationFrame(footstepLoop)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      pressedKeysRef.current.add(key)

      if (sceneEntered && musicEnabled && needsMusicResume && !document.hidden) {
        void startBackgroundMusic()
      }

      if ((key === ' ' || key === 'space' || key === 'spacebar') && !event.repeat && sceneEntered && !showHelpCard && !showPixidimworldPanel) {
        const now = performance.now()
        if (now - lastJumpAtRef.current > 420) {
          const jumpAudio = jumpAudioRef.current
          if (jumpAudio != null) {
            jumpAudio.currentTime = 0
            void jumpAudio.play().catch(() => {})
          }
          lastJumpAtRef.current = now
        }
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key.toLowerCase())
    }

    const onPointerDown = () => {
      if (sceneEntered && musicEnabled && needsMusicResume && !document.hidden) {
        void startBackgroundMusic()
      }
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        bgMusicRef.current?.pause()
        setNeedsMusicResume(sceneEntered && musicEnabled)
        pressedKeysRef.current.clear()
        stopFootsteps()
      }
    }

    const onWindowBlur = () => {
      pressedKeysRef.current.clear()
      stopFootsteps()
    }

    footstepFrameRef.current = requestAnimationFrame(footstepLoop)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (footstepFrameRef.current != null) {
        cancelAnimationFrame(footstepFrameRef.current)
      }
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopFootsteps()
    }
  }, [sceneEntered, musicEnabled, needsMusicResume, showHelpCard, showPixidimworldPanel])

  const handleEnterNow = async () => {
    await primeAudioPlayback()
    setSceneEntered(true)
    setShowHelpCard(false)
    setShowPixidimworldPanel(false)
    restorePlayerControls()
    await startBackgroundMusic()
  }

  const handleMusicToggle = async () => {
    await primeAudioPlayback()
    playClickSound()
    const nextEnabled = !musicEnabled
    setMusicEnabled(nextEnabled)
    restorePlayerControls()

    if (!sceneEntered) {
      return
    }

    if (!nextEnabled) {
      bgMusicRef.current?.pause()
      setNeedsMusicResume(false)
      return
    }

    await startBackgroundMusic()
  }

  const handleOpenPixidimworldPanel = () => {
    playClickSound()
    setShowHelpCard(false)
    setShowPixidimworldPanel(true)
  }

  const handleClosePixidimworldPanel = () => {
    playClickSound()
    setShowPixidimworldPanel(false)
    restorePlayerControls()
  }

  const handleCloseHelpCard = () => {
    playClickSound()
    setShowHelpCard(false)
    restorePlayerControls()
  }

  return (
    <>
      {hasLoaded ? <div className="brand-badge">pixidimworld</div> : null}

      {hasLoaded && !sceneEntered ? (
        <div className="intro-card intro-card-enter" data-no-global-dismiss="true">
          <h2>Use (W, A, S, D) to move .</h2>
          <p>Enter The Maze Gallery.</p>
          <button className="enter-now-button" type="button" onClick={() => void handleEnterNow()}>
            Enter Now
          </button>
        </div>
      ) : null}

      {hasLoaded && showHelpCard ? (
        <div className="info-card" data-no-global-dismiss="true">
          <button
            className="info-close"
            type="button"
            aria-label="Close settings"
            onClick={handleCloseHelpCard}
          >
            x
          </button>
          <h2>Maze Gallery</h2>
          <p>This is a maze art gallery made and drawn by Donald Imhanwa, owner of  Pixidimworld Studios.</p>
          <p>Use W, A, S, D  and hold Shift while moving to run.</p>
          <p>Follow the single floating link marker near the Pixidimworld wall to open the studio story panel.</p>
        </div>
      ) : null}

      {hasLoaded ? (
        <PixidimworldPanel open={showPixidimworldPanel} onClose={handleClosePixidimworldPanel} />
      ) : null}

      <div className="ui-stack" aria-label="site controls" style={{ opacity: hasLoaded ? 1 : 0, pointerEvents: hasLoaded ? 'auto' : 'none' }}>
        <button
          className="ui-icon"
          type="button"
          aria-label="Open gallery settings"
          data-no-global-dismiss="true"
          onClick={() => {
            playClickSound()
            setShowPixidimworldPanel(false)
            setShowHelpCard(true)
          }}
        >
          ?
        </button>
        <button
          className="ui-icon"
          type="button"
          aria-label={musicEnabled ? 'Turn background music off' : 'Turn background music on'}
          data-no-global-dismiss="true"
          onClick={() => void handleMusicToggle()}
        >
          <MusicIcon muted={!musicEnabled} />
        </button>
        <button
          className="ui-icon"
          type="button"
          aria-label="Show controls"
          data-no-global-dismiss="true"
          onClick={() => {
            playClickSound()
            setShowHelpCard(false)
            setShowPixidimworldPanel(false)
            setSceneEntered(false)
            restorePlayerControls()
          }}
        >
          Ctrl
        </button>
      </div>

      <div className={`scene-shell${hasLoaded && !sceneEntered ? ' scene-shell-blur' : ''}`}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ fov: 55, near: 0.1, far: 300, position: [0, 3, 8] }}
          onCreated={({ gl }) => {
            sceneCanvasRef.current = gl.domElement
            gl.domElement.tabIndex = 0
          }}
        >
          <Suspense fallback={<Loader />}>
            <Viverse>
              <SceneReady onReady={() => setHasLoaded(true)} />
              <Sky />
              <ambientLight intensity={0.58} />
              <directionalLight
                castShadow
                intensity={1.28}
                position={[6, 11, 8]}
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={0.5}
                shadow-camera-far={32}
                shadow-camera-left={-14}
                shadow-camera-right={14}
                shadow-camera-top={14}
                shadow-camera-bottom={-14}
                shadow-bias={-0.00035}
              />

              <SimpleCharacter
                position={playerSpawn}
                rotation={playerRotation}
                useViverseAvatar={false}
                model={{ type: 'vrm', url: mainVrmUrl }}
              />

              <IdleMessenger
                url={messengerVrmUrl}
                position={[-4.5, 0.95, 3.1]}
                rotation={[0, -1.15, 0]}
              />
              <IdleMessenger
                url={messenger2VrmUrl}
                position={[5.6, 0.95, -1.5]}
                rotation={[0, 2.8, 0]}
              />
              <MessengerInteractions onUiClick={playClickSound} />
              <BirdFlock />
              <CloudDrift />

              <BvhPhysicsBody>
                <group position={[0, 0, 0]}>
                  <MazeGallery onOpenPixidimworld={handleOpenPixidimworldPanel} />
                </group>
              </BvhPhysicsBody>
            </Viverse>
          </Suspense>
        </Canvas>
      </div>
    </>
  )
}

useGLTF.preload(mazeGalleryUrl)
















