import { useMemo, useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import { PHYSICS_CONFIGS } from '../../physics/constants'
import { audio } from '../../audio/AudioManager'

// Textures Generation (Same as before)
function generateVascularAndNormalMaps() {
  const size = 1024
  const cvsDiffuse = document.createElement('canvas')
  cvsDiffuse.width = size
  cvsDiffuse.height = size
  const ctxD = cvsDiffuse.getContext('2d')
  const cvsNormal = document.createElement('canvas')
  cvsNormal.width = size
  cvsNormal.height = size
  const ctxN = cvsNormal.getContext('2d')

  const fleshGrad = ctxD.createRadialGradient(size/2, size/2, 20, size/2, size/2, size/2)
  fleshGrad.addColorStop(0.0, '#fb7185')
  fleshGrad.addColorStop(0.45, '#e11d48')
  fleshGrad.addColorStop(0.85, '#9f1239')
  fleshGrad.addColorStop(1.0, '#4c0519')
  ctxD.fillStyle = fleshGrad
  ctxD.fillRect(0, 0, size, size)
  ctxN.fillStyle = 'rgb(128, 128, 255)'
  ctxN.fillRect(0, 0, size, size)

  function drawVesselTree(startX, startY, length, angle, depth, isArtery) {
    if (depth <= 0) return
    const endX = startX + Math.cos(angle) * length
    const endY = startY + Math.sin(angle) * length
    const alpha = 0.35 + depth * 0.14
    ctxD.strokeStyle = isArtery ? `rgba(136, 19, 55, ${alpha})` : `rgba(76, 5, 25, ${alpha * 1.1})`
    ctxD.lineWidth = depth * 1.8
    ctxD.lineCap = 'round'
    ctxD.beginPath()
    ctxD.moveTo(startX, startY)
    ctxD.quadraticCurveTo(startX + (Math.random() - 0.5) * 16, startY + (Math.random() - 0.5) * 16, endX, endY)
    ctxD.stroke()
    ctxN.strokeStyle = 'rgba(160, 110, 255, 0.6)'
    ctxN.lineWidth = depth * 1.6
    ctxN.beginPath()
    ctxN.moveTo(startX, startY)
    ctxN.lineTo(endX, endY)
    ctxN.stroke()
    const branches = 1 + Math.floor(Math.random() * 2)
    for (let b = 0; b < branches; b++) {
      drawVesselTree(endX, endY, length * (0.65 + Math.random() * 0.25), angle + (Math.random() - 0.5) * 1.1, depth - 1, isArtery)
    }
  }

  for (let i = 0; i < 16; i++) {
    drawVesselTree(Math.random() * size, Math.random() * size, 40 + Math.random() * 30, Math.random() * Math.PI * 2, 4, i % 2 === 0)
  }

  const diffTex = new THREE.CanvasTexture(cvsDiffuse)
  diffTex.wrapS = THREE.RepeatWrapping; diffTex.wrapT = THREE.RepeatWrapping; diffTex.repeat.set(2, 2)
  diffTex.colorSpace = THREE.SRGBColorSpace
  const normTex = new THREE.CanvasTexture(cvsNormal)
  normTex.wrapS = THREE.RepeatWrapping; normTex.wrapT = THREE.RepeatWrapping; normTex.repeat.set(2, 2)

  return { diffTex, normTex }
}

const SPLASH_COUNT = 180

export default function Organ() {
  const bladderRef = useRef()
  const fluidRef = useRef()
  const sphincterRef = useRef()
  const streamRef = useRef()
  const splashRef = useRef()
  
  // Ureter fluid drops for peristaltic animation
  const leftDropRef = useRef()
  const rightDropRef = useRef()

  const matRef = useRef()
  const fluidMatRef = useRef()

  const baseVertices = useRef([])
  const velocities = useRef([])
  const viscoDentMemory = useRef([])
  const sphincterBases = useRef([])
  const globalJigglePhase = useRef(0)
  const fluidClipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), [])
  const cutawaySagittalPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), [])

  const [isPointerDown, setIsPointerDown] = useState(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const setSim = useSimStore.getState().updateSim
  const addRipple = useSimStore.getState().addRipple
  const isCutawayActive = useSimStore(s => s.isCutawayActive)

  const { diffTex, normTex, bladderGeo, fluidGeo, sphincterGeo, streamGeo, splashGeo, ureterGeo, ureterCurve } = useMemo(() => {
    const maps = generateVascularAndNormalMaps()
    
    const bGeo = new THREE.SphereGeometry(2.35, 64, 48)
    const fGeo = new THREE.SphereGeometry(2.35, 64, 48)
    const bPos = bGeo.attributes.position
    
    for (let i = 0; i < bPos.count; i++) {
      let x = bPos.getX(i), y = bPos.getY(i), z = bPos.getZ(i)
      const neckFactor = y < 0 ? Math.max(0.35, 1.0 - Math.abs(y / 2.35) * 0.6) : 1.0
      x *= neckFactor; z *= neckFactor * 0.94; y *= 1.12
      bPos.setXYZ(i, x, y, z)
    }
    bGeo.computeVertexNormals()

    const sGeo = new THREE.CylinderGeometry(0.35, 0.22, 1.2, 48, 16, false)
    const sPos = sGeo.attributes.position
    const sBases = []
    for (let i = 0; i < sPos.count; i++) {
      const x = sPos.getX(i), y = sPos.getY(i), z = sPos.getZ(i)
      sBases.push({ x, y, z, r: Math.hypot(x, z), theta: Math.atan2(z, x) })
    }

    const stream = new THREE.CylinderGeometry(0.12, 0.08, 6.0, 16, 24, true)
    
    const spGeo = new THREE.BufferGeometry()
    const spPos = new Float32Array(SPLASH_COUNT * 3)
    for (let i = 0; i < SPLASH_COUNT; i++) spPos[i*3 + 1] = -999
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3))

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.2, 4.2, -1.0),
      new THREE.Vector3(-2.4, 2.0, -0.4),
      new THREE.Vector3(-0.9, 0.3, -0.1) // Connects precisely to the trigone region
    ])
    const uGeo = new THREE.TubeGeometry(curve, 32, 0.11, 8, false)

    return { ...maps, bladderGeo: bGeo, fluidGeo: fGeo, sphincterGeo: sGeo, streamGeo: stream, splashGeo: spGeo, ureterGeo: uGeo, ureterCurve: curve }
  }, [])

  baseVertices.current = useMemo(() => {
    const bases = []
    const pos = bladderGeo.attributes.position
    for (let i = 0; i < pos.count; i++) bases.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)))
    return bases
  }, [bladderGeo])

  velocities.current = useMemo(() => Array.from({ length: baseVertices.current.length }, () => new THREE.Vector3()), [])
  viscoDentMemory.current = useMemo(() => new Float32Array(baseVertices.current.length), [])
  sphincterBases.current = useMemo(() => {
    const sBases = []
    const sPos = sphincterGeo.attributes.position
    for (let i = 0; i < sPos.count; i++) {
      const x = sPos.getX(i), y = sPos.getY(i), z = sPos.getZ(i)
      sBases.push({ x, y, z, r: Math.hypot(x, z), theta: Math.atan2(z, x) })
    }
    return sBases
  }, [sphincterGeo])

  const impartSlosh = (fx, fz) => {
    const sim = useSimStore.getState()
    const boost = (sim.sloshVelX * fx + sim.sloshVelZ * fz) > 0 ? 1.35 : 0.85
    setSim({ 
      sloshVelX: sim.sloshVelX + fx * boost, 
      sloshVelZ: sim.sloshVelZ + fz * boost,
      fluidCoreVelocity: new THREE.Vector3(sim.fluidCoreVelocity.x - fx*0.45, 0, sim.fluidCoreVelocity.z - fz*0.45)
    })
  }

  const applyDent = (localPt, radius, strength) => {
    const pos = bladderGeo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i)
      const d = localPt.distanceTo(new THREE.Vector3(vx, vy, vz))
      if (d < radius) {
        const power = (1.0 - d / radius) * strength * 1.6
        velocities.current[i].x -= (vx / 2.35) * power
        velocities.current[i].y -= (vy / 2.35) * power
        velocities.current[i].z -= (vz / 2.35) * power
        viscoDentMemory.current[i] = Math.min(0.6, viscoDentMemory.current[i] + power * 0.35)
      }
    }
  }

  const handleGlobalSlap = () => {
    const slapAngle = Math.random() * Math.PI * 2
    const hitPt = new THREE.Vector3(Math.cos(slapAngle) * 2.2, 0.2 + (Math.random() - 0.5) * 0.8, Math.sin(slapAngle) * 2.2)
    const local = bladderRef.current.worldToLocal(hitPt)
    const sim = useSimStore.getState()

    addRipple({ center: local.clone(), radius: 0.1, maxRadius: 3.8, speed: 7.5, amplitude: 1.5, decay: 3.5 })
    setSim({ jiggleIntensity: Math.min(1.0, sim.jiggleIntensity + 0.6) })
    impartSlosh(local.x * 4.0, local.z * 4.0)
    applyDent(local, 1.8, 1.8)
    
    audio.playSlap(2.4)
    audio.speak('poked', true)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
  }

  useEffect(() => {
    document.addEventListener('triggerSlap', handleGlobalSlap)
    return () => document.removeEventListener('triggerSlap', handleGlobalSlap)
  }, [])

  const handlePointerDown = (e) => {
    e.stopPropagation()
    setIsPointerDown(true)
    lastPointer.current = { x: e.clientX, y: e.clientY }
    
    const sim = useSimStore.getState()
    const local = bladderRef.current.worldToLocal(e.point.clone())

    if (sim.interactionMode === 'poke') {
      addRipple({ center: local.clone(), radius: 0.1, maxRadius: 3.8, speed: 7.5, amplitude: 0.7, decay: 3.5 })
      setSim({ jiggleIntensity: Math.min(1.0, sim.jiggleIntensity + 0.3) })
      impartSlosh(local.x * 1.5, local.z * 1.5)
      applyDent(local, 1.4, 0.7)
      
      audio.playSquish(1.0)
      audio.speak('poked', true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30)
    } else if (sim.interactionMode === 'slap') {
      addRipple({ center: local.clone(), radius: 0.1, maxRadius: 3.8, speed: 7.5, amplitude: 1.5, decay: 3.5 })
      setSim({ jiggleIntensity: Math.min(1.0, sim.jiggleIntensity + 0.6) })
      impartSlosh(local.x * 4.0, local.z * 4.0)
      applyDent(local, 1.8, 1.8)
      
      audio.playSlap(2.0)
      audio.speak('poked', true) 
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
    } else if (sim.interactionMode === 'squeeze') {
      setSim({ targetSqueezeY: 0.35, squeezeContactPoint: local })
      audio.playSquish(1.2)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(35)
    }
  }

  const handlePointerMove = (e) => {
    if (!isPointerDown) return
    const sim = useSimStore.getState()
    const dx = e.clientX - lastPointer.current.x
    const dy = e.clientY - lastPointer.current.y
    lastPointer.current = { x: e.clientX, y: e.clientY }
    
    if (sim.interactionMode === 'squeeze') {
      const drag = Math.min(0.65, Math.max(0.0, sim.targetSqueezeY + Math.abs(dy) * 0.004 + Math.abs(dx) * 0.002))
      setSim({ targetSqueezeY: drag })
      if (Math.random() > 0.7) audio.playSqueezeFM(drag)
    }
  }

  const handlePointerUp = () => {
    setIsPointerDown(false)
    const sim = useSimStore.getState()
    if (sim.interactionMode === 'squeeze') {
      setSim({ targetSqueezeY: 0.0 })
      audio.playGranularSlosh(1.1)
    }
  }

  useFrame((state, delta) => {
    const dt = Math.min(0.08, delta)
    const sim = useSimStore.getState()
    const phys = PHYSICS_CONFIGS.jello
    const timeSec = state.clock.getElapsedTime()
    
    const fillRatio = Math.max(0.01, sim.volume / sim.maxCapacity)
    const compY = sim.squeezeAmountY || 0
    const scaleY = 1.0 - compY
    const inflationScale = 0.55 + Math.pow(fillRatio, 0.45) * 0.75
    const liquidFillHeight = -1.8 * inflationScale * scaleY + (fillRatio * 3.6 * inflationScale * scaleY)

    fluidClipPlane.constant = liquidFillHeight + 0.2
    
    // Slosh effect on clipping plane
    fluidClipPlane.normal.set(Math.sin(sim.sloshAngleX * 0.4), -1, Math.sin(sim.sloshAngleZ * 0.4)).normalize()

    if (matRef.current) {
      const stressRatio = Math.min(1.0, fillRatio)
      matRef.current.emissiveIntensity = 0.22 + stressRatio * 0.4
      matRef.current.roughness = THREE.MathUtils.lerp(0.35, 0.08, stressRatio)
      matRef.current.thickness = THREE.MathUtils.lerp(1.8, 0.45, stressRatio)
      matRef.current.transmission = THREE.MathUtils.lerp(0.45, 0.78, stressRatio)
    }
    if (fluidMatRef.current) {
      const h = sim.hydration || 0.85
      fluidMatRef.current.color.setRGB(1.0, 0.72 + h * 0.22, 0.1 + h * 0.6)
    }

    // Vertex Physics
    globalJigglePhase.current += dt * phys.jiggleFreq
    const jiggle1 = Math.sin(globalJigglePhase.current) * sim.jiggleIntensity * 0.18
    const jiggle2 = Math.cos(globalJigglePhase.current * 1.5) * sim.jiggleIntensity * 0.12
    const bulgeXZ = Math.sqrt(1.0 / Math.max(0.2, (1.0 - compY * (0.45 + fillRatio * 0.45))))
    
    const wrinkleAmp = Math.pow(1.0 - Math.min(1.0, fillRatio), 1.6) * 0.28
    const sagFactor = Math.max(0, (1.0 - fillRatio * 2.2)) * 0.45
    const tremorAmp = (sim.sphincterToneStrain > 0.3) ? (sim.sphincterToneStrain * 0.045) : 0.0
    
    const bPos = bladderGeo.attributes.position
    const fPos = fluidGeo.attributes.position

    for (let i = 0; i < bPos.count; i++) {
      const base = baseVertices.current[i]
      const cx = bPos.getX(i), cy = bPos.getY(i), cz = bPos.getZ(i)
      
      viscoDentMemory.current[i] = Math.max(0, viscoDentMemory.current[i] - dt * 1.4)
      const dentOffset = viscoDentMemory.current[i]

      const wrinkleNoise = (Math.sin(base.x * 7.0 + base.y * 9.0) * Math.cos(base.z * 8.0 + base.y * 5.0)) * wrinkleAmp
      const sloshPushX = (Math.sin(sim.sloshAngleX) * (base.y / 2.35) * 0.22) + (sim.fluidCoreOffset.x * 0.35)
      const sloshPushZ = (Math.sin(sim.sloshAngleZ) * (base.y / 2.35) * 0.22) + (sim.fluidCoreOffset.z * 0.35)

      const theta = Math.atan2(base.z, base.x)
      const phi = Math.acos(Math.max(-1, Math.min(1, base.y / 2.35)))
      const jiggleWobble = Math.sin(theta * 3.0 + globalJigglePhase.current) * Math.sin(phi * 2.0) * jiggle1 +
                           Math.cos(theta * 2.0 - globalJigglePhase.current * 1.2) * jiggle2

      let rippleDisp = 0
      for (let r = 0; r < sim.ripples.length; r++) {
        const rip = sim.ripples[r]
        const waveDist = Math.abs(base.distanceTo(rip.center) - rip.radius)
        if (waveDist < 0.65) rippleDisp += Math.cos((waveDist / 0.65) * (Math.PI / 2)) * rip.amplitude
      }

      const tremorX = (Math.random() - 0.5) * tremorAmp
      const tremorY = (Math.random() - 0.5) * tremorAmp
      const tremorZ = (Math.random() - 0.5) * tremorAmp

      const sagY = base.y > 0 ? -sagFactor * (base.y / 2.35) : 0
      const flaccidSpread = base.y < 0 ? (1.0 + (1.0 - fillRatio) * 0.2) : 1.0
      const totalRadMod = Math.max(0.2, (1.0 + jiggleWobble + rippleDisp - dentOffset))

      const tx = ((base.x * flaccidSpread * bulgeXZ + wrinkleNoise) * inflationScale + sloshPushX + tremorX) * totalRadMod
      const ty = ((base.y * scaleY + sagY + wrinkleNoise * 0.5) * inflationScale + tremorY) * totalRadMod
      const tz = ((base.z * flaccidSpread * bulgeXZ + wrinkleNoise) * inflationScale + sloshPushZ + tremorZ) * totalRadMod

      const fx = (tx - cx) * phys.springK
      const fy = (ty - cy) * phys.springK
      const fz = (tz - cz) * phys.springK

      const vel = velocities.current[i]
      vel.x = (vel.x + fx * dt) * phys.damping
      vel.y = (vel.y + fy * dt) * phys.damping
      vel.z = (vel.z + fz * dt) * phys.damping

      const nx = cx + vel.x * dt
      const ny = cy + vel.y * dt
      const nz = cz + vel.z * dt

      bPos.setXYZ(i, nx, ny, nz)
      fPos.setXYZ(i, nx * 0.94, ny * 0.94, nz * 0.94) 
    }
    
    bPos.needsUpdate = true; fPos.needsUpdate = true
    bladderGeo.computeVertexNormals(); fluidGeo.computeVertexNormals()

    // Sphincter Animation
    const sPos = sphincterGeo.attributes.position
    const dil = sim.isStressLeaking ? 0.35 : sim.sphincterDilation
    const twitchOsc = Math.sin(timeSec * 38.0) * Math.cos(timeSec * 23.0)
    const twitchAmp = sim.sphincterToneStrain * 0.08
    const clenchPucker = sim.isClenching ? 0.65 : 1.0
    for (let i = 0; i < sPos.count; i++) {
      const v = sphincterBases.current[i]
      const funnelRadius = THREE.MathUtils.lerp((v.r + Math.sin(v.theta * 8.0) * 0.045 * (1.0 - dil) + Math.sin(v.theta * 4.0 + timeSec * 30.0) * twitchAmp * twitchOsc) * clenchPucker, v.r * (1.0 + (v.y > 0 ? 0.9 : 1.6)), dil)
      sPos.setXYZ(i, Math.cos(v.theta) * funnelRadius, v.y, Math.sin(v.theta) * funnelRadius)
    }
    sPos.needsUpdate = true; sphincterGeo.computeVertexNormals()
    
    // MOVE SPHINCTER LOWER
    if (sphincterRef.current) sphincterRef.current.position.y = -2.35 * inflationScale * scaleY - 0.45

    // Stream & Splash Animation
    const exitY = sphincterRef.current ? sphincterRef.current.position.y - 0.55 : -2.5
    if (streamRef.current) {
      streamRef.current.visible = sim.flowRate > 0
      if (sim.flowRate > 0) {
        const streamPos = streamGeo.attributes.position
        const streamRadius = THREE.MathUtils.lerp(0.04, 0.16, dil)
        for (let i = 0; i < streamPos.count; i++) {
          const segY = (i % 24) / 24
          const sloshX = Math.sin(sim.sloshAngleX) * segY * 0.4
          const sloshZ = Math.sin(sim.sloshAngleZ) * segY * 0.4
          const r = (streamRadius * (1.0 - segY * 0.35) + Math.sin(timeSec * 24.0 + segY * 18.0) * (0.015 * segY)) * (0.5 + Math.min(1.0, sim.flowRate / 30.0) * 0.5)
          const theta = ((i / 24) % 16) * (Math.PI * 2 / 16)
          streamPos.setXYZ(i, Math.cos(theta) * r + sloshX, exitY - (segY * 5.5), Math.sin(theta) * r + sloshZ)
        }
        streamPos.needsUpdate = true; streamGeo.computeVertexNormals()
        
        // Splash Particles
        const sp = splashGeo.attributes.position.array
        const splashBaseY = exitY - 5.5
        for (let i = 0; i < SPLASH_COUNT; i++) {
          if (sp[i * 3 + 1] <= splashBaseY - 1.5 || sp[i * 3 + 1] === -999) {
            const angle = Math.random() * Math.PI * 2
            const dist = Math.random() * 0.25 * (sim.flowRate / 10.0)
            sp[i * 3 + 0] = Math.cos(angle) * dist
            sp[i * 3 + 1] = splashBaseY + (Math.random() * 0.2)
            sp[i * 3 + 2] = Math.sin(angle) * dist
          } else {
            sp[i * 3 + 1] -= (6.0 + Math.random() * 4.0) * dt
          }
        }
        splashGeo.attributes.position.needsUpdate = true
        splashRef.current.visible = true
      } else {
        const sp = splashGeo.attributes.position.array
        for (let i = 0; i < SPLASH_COUNT; i++) sp[i * 3 + 1] = -999
        splashGeo.attributes.position.needsUpdate = true
        splashRef.current.visible = false
      }
    }

    // Ureter Peristaltic Drops Animation
    const hasBeverage = sim.activeBeverages.length > 0
    if (leftDropRef.current && rightDropRef.current) {
      leftDropRef.current.visible = hasBeverage
      rightDropRef.current.visible = hasBeverage
      
      if (hasBeverage) {
        // Drop travels along the curve repeatedly
        const progress1 = (timeSec * 0.8) % 1.0
        const progress2 = ((timeSec * 0.8) + 0.5) % 1.0 // Offset phase for the right ureter
        
        const pos1 = ureterCurve.getPointAt(progress1)
        const pos2 = ureterCurve.getPointAt(progress2)

        // Drop scale logic (fades out as it hits bladder)
        const dropScale1 = Math.max(0.1, 1.2 * (1.0 - progress1))
        const dropScale2 = Math.max(0.1, 1.2 * (1.0 - progress2))

        leftDropRef.current.position.copy(pos1)
        leftDropRef.current.scale.setScalar(dropScale1)
        
        // Right curve is mirrored across X
        rightDropRef.current.position.set(-pos2.x, pos2.y, pos2.z)
        rightDropRef.current.scale.setScalar(dropScale2)
      }
    }
  })

  // Dynamic clipping planes
  const bladderClip = isCutawayActive ? [cutawaySagittalPlane] : []
  const fluidClip = isCutawayActive ? [fluidClipPlane, cutawaySagittalPlane] : [fluidClipPlane]

  return (
    <group position={[0, 0.2, 0]}>
      <mesh 
        ref={bladderRef} 
        geometry={bladderGeo} 
        renderOrder={10}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <meshPhysicalMaterial 
          ref={matRef} 
          map={diffTex} 
          normalMap={normTex} 
          normalScale={[0.8, 0.8]} 
          color={0xf43f5e} 
          emissive={0x881337} 
          emissiveIntensity={0.28} 
          roughness={0.22} 
          metalness={0.05} 
          clearcoat={0.9} 
          clearcoatRoughness={0.12} 
          transmission={0.65} 
          thickness={1.4} 
          ior={1.38} 
          transparent 
          opacity={0.88} 
          depthWrite={false} 
          side={isCutawayActive ? THREE.DoubleSide : THREE.FrontSide} 
          clippingPlanes={bladderClip}
        />
      </mesh>
      
      <mesh ref={fluidRef} geometry={fluidGeo} renderOrder={1}>
        <meshPhysicalMaterial 
          ref={fluidMatRef} 
          color={0xfacc15} 
          emissive={0xd97706} 
          emissiveIntensity={0.55} 
          roughness={0.08} 
          metalness={0.1} 
          transmission={0.88} 
          ior={1.333} 
          thickness={2.2} 
          transparent 
          opacity={0.94} 
          clippingPlanes={fluidClip} 
          clipShadows 
          side={THREE.DoubleSide} 
        />
      </mesh>
      
      <mesh ref={sphincterRef} geometry={sphincterGeo} renderOrder={4} position={[0, -2.15, -0.2]}>
        <meshPhysicalMaterial color={0xe11d48} emissive={0x4c0519} emissiveIntensity={0.35} roughness={0.25} clearcoat={0.8} clearcoatRoughness={0.15} side={THREE.DoubleSide} />
      </mesh>
      
      <mesh ref={streamRef} geometry={streamGeo} renderOrder={5} visible={false}>
        <meshPhysicalMaterial color={0xfacc15} emissive={0xd97706} emissiveIntensity={0.6} roughness={0.05} transmission={0.92} ior={1.333} transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>

      {/* Falling Splash Particles */}
      <points ref={splashRef} geometry={splashGeo} renderOrder={6} visible={false}>
        <pointsMaterial color={0xfef08a} size={0.12} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>

      <mesh geometry={ureterGeo} renderOrder={3}>
        <meshPhysicalMaterial color={0x94a3b8} roughness={0.3} transmission={0.75} transparent opacity={0.85} />
      </mesh>
      <mesh geometry={ureterGeo} renderOrder={3} scale={[-1, 1, 1]}>
        <meshPhysicalMaterial color={0x94a3b8} roughness={0.3} transmission={0.75} transparent opacity={0.85} />
      </mesh>

      {/* Ureter Traveling Fluid Drops */}
      <mesh ref={leftDropRef} visible={false} renderOrder={4}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshPhysicalMaterial color={0xfef08a} emissive={0xf59e0b} emissiveIntensity={0.9} roughness={0.1} transmission={0.8} transparent opacity={0.95} />
      </mesh>
      <mesh ref={rightDropRef} visible={false} renderOrder={4}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshPhysicalMaterial color={0xfef08a} emissive={0xf59e0b} emissiveIntensity={0.9} roughness={0.1} transmission={0.8} transparent opacity={0.95} />
      </mesh>
    </group>
  )
}
