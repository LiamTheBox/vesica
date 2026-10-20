import * as THREE from 'three'
import { physicsOf } from '../../sim/sim'

// Geometry, textures and per-frame deformation for the organ. Kept outside React so
// the 60 fps vertex work never touches component render; `Organ.jsx` wires it up.

const SPLASH_COUNT = 180
const STREAM_SEGMENTS = 24

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

  const fleshGrad = ctxD.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 2)
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

export function createOrganRig() {
  const { diffTex, normTex } = generateVascularAndNormalMaps()

  const bladderGeo = new THREE.SphereGeometry(2.35, 64, 48)
  const fluidGeo = new THREE.SphereGeometry(2.35, 64, 48)
  const bPos = bladderGeo.attributes.position
  for (let i = 0; i < bPos.count; i++) {
    let x = bPos.getX(i), y = bPos.getY(i), z = bPos.getZ(i)
    const neckFactor = y < 0 ? Math.max(0.35, 1.0 - Math.abs(y / 2.35) * 0.6) : 1.0
    x *= neckFactor; z *= neckFactor * 0.94; y *= 1.12
    bPos.setXYZ(i, x, y, z)
  }
  bladderGeo.computeVertexNormals()

  const baseVertices = []
  for (let i = 0; i < bPos.count; i++) baseVertices.push(new THREE.Vector3(bPos.getX(i), bPos.getY(i), bPos.getZ(i)))
  const velocities = baseVertices.map(() => new THREE.Vector3())
  const dentMemory = new Float32Array(baseVertices.length)

  const sphincterGeo = new THREE.CylinderGeometry(0.35, 0.22, 1.2, 48, 16, false)
  const sPos = sphincterGeo.attributes.position
  const sphincterBases = []
  for (let i = 0; i < sPos.count; i++) {
    const x = sPos.getX(i), y = sPos.getY(i), z = sPos.getZ(i)
    sphincterBases.push({ x, y, z, r: Math.hypot(x, z), theta: Math.atan2(z, x) })
  }

  const streamGeo = new THREE.CylinderGeometry(0.12, 0.08, 6.0, 16, STREAM_SEGMENTS, true)

  const splashGeo = new THREE.BufferGeometry()
  const splashPositions = new Float32Array(SPLASH_COUNT * 3)
  for (let i = 0; i < SPLASH_COUNT; i++) splashPositions[i * 3 + 1] = -999
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3))

  const ureterCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.2, 4.2, -1.0),
    new THREE.Vector3(-2.4, 2.0, -0.4),
    new THREE.Vector3(-0.9, 0.3, -0.1), // meets the trigone region
  ])
  const ureterGeo = new THREE.TubeGeometry(ureterCurve, 32, 0.11, 8, false)

  const fluidClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  const cutawayPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)

  const scratch = new THREE.Vector3()
  const dropPoint = new THREE.Vector3()

  // Pushes vertices near `local` inward and leaves a slowly recovering dent.
  function dent(local, radius, strength) {
    const pos = bladderGeo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i)
      const d = scratch.set(vx, vy, vz).distanceTo(local)
      if (d < radius) {
        const power = (1.0 - d / radius) * strength * 1.6
        velocities[i].x -= (vx / 2.35) * power
        velocities[i].y -= (vy / 2.35) * power
        velocities[i].z -= (vz / 2.35) * power
        dentMemory[i] = Math.min(0.6, dentMemory[i] + power * 0.35)
      }
    }
  }

  function clearDents() {
    dentMemory.fill(0)
  }

  // `objects`: the live meshes/materials from Organ.jsx refs.
  function update(sim, dt, timeSec, objects) {
    const { bladderMat, fluidMat, sphincter, stream, splash, leftDrop, rightDrop } = objects
    const phys = physicsOf(sim)

    const fillRatio = Math.max(0.01, sim.volume / sim.maxCapacity)
    const compY = sim.squeezeAmountY || 0
    const scaleY = 1.0 - compY
    const inflationScale = 0.55 + Math.pow(fillRatio, 0.45) * 0.75
    const liquidFillHeight = -1.8 * inflationScale * scaleY + (fillRatio * 3.6 * inflationScale * scaleY)

    fluidClipPlane.constant = liquidFillHeight + 0.2
    fluidClipPlane.normal.set(Math.sin(sim.sloshAngleX * 0.4), -1, Math.sin(sim.sloshAngleZ * 0.4)).normalize()

    if (bladderMat) {
      const stressRatio = Math.min(1.0, fillRatio)
      bladderMat.emissiveIntensity = 0.22 + stressRatio * 0.4
      bladderMat.roughness = THREE.MathUtils.lerp(0.35, 0.08, stressRatio)
      bladderMat.thickness = THREE.MathUtils.lerp(1.8, 0.45, stressRatio)
      bladderMat.transmission = THREE.MathUtils.lerp(0.45, 0.78, stressRatio)
    }
    if (fluidMat) {
      const h = sim.hydration
      fluidMat.color.setRGB(1.0, 0.72 + h * 0.22, 0.1 + h * 0.6)
    }

    // Soft-body wall
    const phase = sim.globalJigglePhase
    const jiggle1 = Math.sin(phase) * sim.jiggleIntensity * 0.18
    const jiggle2 = Math.cos(phase * 1.5) * sim.jiggleIntensity * 0.12
    const bulgeXZ = Math.sqrt(1.0 / Math.max(0.2, (1.0 - compY * (0.45 + fillRatio * 0.45))))
    const wrinkleAmp = Math.pow(1.0 - Math.min(1.0, fillRatio), 1.6) * 0.28
    const sagFactor = Math.max(0, (1.0 - fillRatio * 2.2)) * 0.45
    const tremorAmp = (sim.sphincterToneStrain > 0.3) ? (sim.sphincterToneStrain * 0.045) : 0.0

    const fPos = fluidGeo.attributes.position
    for (let i = 0; i < bPos.count; i++) {
      const base = baseVertices[i]
      const cx = bPos.getX(i), cy = bPos.getY(i), cz = bPos.getZ(i)

      dentMemory[i] = Math.max(0, dentMemory[i] - dt * 1.4)
      const dentOffset = dentMemory[i]

      const wrinkleNoise = (Math.sin(base.x * 7.0 + base.y * 9.0) * Math.cos(base.z * 8.0 + base.y * 5.0)) * wrinkleAmp
      const sloshPushX = (Math.sin(sim.sloshAngleX) * (base.y / 2.35) * 0.22) + (sim.fluidCoreOffset.x * 0.35)
      const sloshPushZ = (Math.sin(sim.sloshAngleZ) * (base.y / 2.35) * 0.22) + (sim.fluidCoreOffset.z * 0.35)

      const theta = Math.atan2(base.z, base.x)
      const phi = Math.acos(Math.max(-1, Math.min(1, base.y / 2.35)))
      const jiggleWobble = Math.sin(theta * 3.0 + phase) * Math.sin(phi * 2.0) * jiggle1 +
        Math.cos(theta * 2.0 - phase * 1.2) * jiggle2

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

      const vel = velocities[i]
      vel.x = (vel.x + (tx - cx) * phys.springK * dt) * phys.damping
      vel.y = (vel.y + (ty - cy) * phys.springK * dt) * phys.damping
      vel.z = (vel.z + (tz - cz) * phys.springK * dt) * phys.damping

      const nx = cx + vel.x * dt
      const ny = cy + vel.y * dt
      const nz = cz + vel.z * dt
      bPos.setXYZ(i, nx, ny, nz)
      fPos.setXYZ(i, nx * 0.94, ny * 0.94, nz * 0.94)
    }
    bPos.needsUpdate = true
    fPos.needsUpdate = true
    bladderGeo.computeVertexNormals()
    fluidGeo.computeVertexNormals()

    // Sphincter
    const dil = sim.isStressLeaking ? 0.35 : sim.sphincterDilation
    const twitchOsc = Math.sin(timeSec * 38.0) * Math.cos(timeSec * 23.0)
    const twitchAmp = sim.sphincterToneStrain * 0.08
    const clenchPucker = sim.isClenching ? 0.65 : 1.0
    for (let i = 0; i < sPos.count; i++) {
      const v = sphincterBases[i]
      const funnelRadius = THREE.MathUtils.lerp(
        (v.r + Math.sin(v.theta * 8.0) * 0.045 * (1.0 - dil) + Math.sin(v.theta * 4.0 + timeSec * 30.0) * twitchAmp * twitchOsc) * clenchPucker,
        v.r * (1.0 + (v.y > 0 ? 0.9 : 1.6)),
        dil,
      )
      sPos.setXYZ(i, Math.cos(v.theta) * funnelRadius, v.y, Math.sin(v.theta) * funnelRadius)
    }
    sPos.needsUpdate = true
    sphincterGeo.computeVertexNormals()

    if (sphincter) sphincter.position.y = -2.35 * inflationScale * scaleY - 0.45

    // Stream & splash
    const exitY = sphincter ? sphincter.position.y - 0.55 : -2.5
    const streaming = sim.flowRate > 0
    if (stream) stream.visible = streaming
    if (splash) splash.visible = streaming
    if (streaming) {
      const streamPos = streamGeo.attributes.position
      const streamRadius = THREE.MathUtils.lerp(0.04, 0.16, dil)
      for (let i = 0; i < streamPos.count; i++) {
        const segY = (i % STREAM_SEGMENTS) / STREAM_SEGMENTS
        const sloshX = Math.sin(sim.sloshAngleX) * segY * 0.4
        const sloshZ = Math.sin(sim.sloshAngleZ) * segY * 0.4
        const r = (streamRadius * (1.0 - segY * 0.35) + Math.sin(timeSec * 24.0 + segY * 18.0) * (0.015 * segY)) * (0.5 + Math.min(1.0, sim.flowRate / 30.0) * 0.5)
        const theta = ((i / STREAM_SEGMENTS) % 16) * (Math.PI * 2 / 16)
        streamPos.setXYZ(i, Math.cos(theta) * r + sloshX, exitY - (segY * 5.5), Math.sin(theta) * r + sloshZ)
      }
      streamPos.needsUpdate = true
      streamGeo.computeVertexNormals()

      const splashBaseY = exitY - 5.5
      for (let i = 0; i < SPLASH_COUNT; i++) {
        if (splashPositions[i * 3 + 1] <= splashBaseY - 1.5 || splashPositions[i * 3 + 1] === -999) {
          const angle = Math.random() * Math.PI * 2
          const dist = Math.random() * 0.25 * (sim.flowRate / 10.0)
          splashPositions[i * 3 + 0] = Math.cos(angle) * dist
          splashPositions[i * 3 + 1] = splashBaseY + (Math.random() * 0.2)
          splashPositions[i * 3 + 2] = Math.sin(angle) * dist
        } else {
          splashPositions[i * 3 + 1] -= (6.0 + Math.random() * 4.0) * dt
        }
      }
    } else {
      for (let i = 0; i < SPLASH_COUNT; i++) splashPositions[i * 3 + 1] = -999
    }
    splashGeo.attributes.position.needsUpdate = true

    // Drops travelling down the ureters while drinks are being filtered
    const hasBeverage = sim.activeBeverages.length > 0
    if (leftDrop && rightDrop) {
      leftDrop.visible = hasBeverage
      rightDrop.visible = hasBeverage
      if (hasBeverage) {
        const progress1 = (timeSec * 0.8) % 1.0
        const progress2 = ((timeSec * 0.8) + 0.5) % 1.0
        ureterCurve.getPointAt(progress1, dropPoint)
        leftDrop.position.copy(dropPoint)
        leftDrop.scale.setScalar(Math.max(0.1, 1.2 * (1.0 - progress1)))
        ureterCurve.getPointAt(progress2, dropPoint)
        rightDrop.position.set(-dropPoint.x, dropPoint.y, dropPoint.z) // right ureter mirrors the left
        rightDrop.scale.setScalar(Math.max(0.1, 1.2 * (1.0 - progress2)))
      }
    }
  }

  return {
    diffTex, normTex, bladderGeo, fluidGeo, sphincterGeo, streamGeo, splashGeo, ureterGeo,
    fluidClipPlane, cutawayPlane, dent, clearDents, update,
  }
}
