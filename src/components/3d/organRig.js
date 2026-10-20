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

// Bladder centre in world space (the organ group sits 0.2 above the origin).
export const ORGAN_CENTER = new THREE.Vector3(0, 0.2, 0)

// Points the cutaway plane away from the camera through the organ's centre, so the
// half nearest the player is always the one removed, from any orbit angle.
export function orientCutaway(plane, cameraPosition, center = ORGAN_CENTER) {
  plane.normal.subVectors(center, cameraPosition)
  if (plane.normal.lengthSq() < 1e-8) plane.normal.set(0, 0, -1)
  plane.normal.normalize()
  plane.constant = -plane.normal.dot(center)
  return plane
}

// Impact profiles from the original pokeBladder() / slapBladder().
const POKE = { radius: 1.4, powerScale: 1.0, velScale: 1.6, dentGain: 0.35, dentCap: 0.6 }
const SLAP = { radius: 1.8, powerScale: 2.2, velScale: 1.0, dentGain: 0.4, dentCap: 0.8 }

// The liquid fills the sac just inside the wall.
const FLUID_INSET = 0.965

const URETER_SEGMENTS = 32

function createUreter(side, baseVertices) {
  // Ureters enter the back of the bladder, above and to the side of the neck.
  const dir = new THREE.Vector3(0.9 * side, 0.3, -0.35).normalize()
  let endIndex = 0
  let best = -Infinity
  const n = new THREE.Vector3()
  baseVertices.forEach((v, i) => {
    const d = n.copy(v).normalize().dot(dir)
    if (d > best) { best = d; endIndex = i }
  })

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.2 * side, 4.2, -1.0),
    new THREE.Vector3(2.4 * side, 2.0, -0.4),
    baseVertices[endIndex].clone(),
  ])
  const geo = new THREE.TubeGeometry(curve, URETER_SEGMENTS, 0.11, 8, false)
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 6)
  return { curve, geo, endIndex, lastEnd: new THREE.Vector3(Infinity, 0, 0) }
}

const outward = new THREE.Vector3()

// Re-routes a ureter so it always ends on the (moving) bladder wall.
function updateUreter(ureter, wallPoint) {
  if (ureter.lastEnd.distanceToSquared(wallPoint) < 0.0004) return
  ureter.lastEnd.copy(wallPoint)
  const [, mid, end] = ureter.curve.points
  end.copy(wallPoint).multiplyScalar(0.97) // sink slightly into the wall
  outward.copy(end).normalize()
  mid.copy(end).addScaledVector(outward, 0.9)
  mid.y += 1.1
  ureter.curve.updateArcLengths()

  const fresh = new THREE.TubeGeometry(ureter.curve, URETER_SEGMENTS, 0.11, 8, false)
  ureter.geo.attributes.position.array.set(fresh.attributes.position.array)
  ureter.geo.attributes.normal.array.set(fresh.attributes.normal.array)
  ureter.geo.attributes.position.needsUpdate = true
  ureter.geo.attributes.normal.needsUpdate = true
  fresh.dispose()
}

export function createOrganRig() {
  const { diffTex, normTex } = generateVascularAndNormalMaps()

  const bladderGeo = new THREE.SphereGeometry(2.35, 64, 48)
  const bPos = bladderGeo.attributes.position
  for (let i = 0; i < bPos.count; i++) {
    let x = bPos.getX(i), y = bPos.getY(i), z = bPos.getZ(i)
    const neckFactor = y < 0 ? Math.max(0.35, 1.0 - Math.abs(y / 2.35) * 0.6) : 1.0
    x *= neckFactor; z *= neckFactor * 0.94; y *= 1.12
    bPos.setXYZ(i, x, y, z)
  }
  bladderGeo.computeVertexNormals()
  // The wall inflates up to ~1.3x, so give raycasting/culling a sphere that always fits.
  bladderGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4.5)

  // The liquid shares the wall's topology so it can follow every dent and wobble.
  const fluidGeo = bladderGeo.clone()
  fluidGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4.5)
  const fPos = fluidGeo.attributes.position

  const baseVertices = []
  for (let i = 0; i < bPos.count; i++) baseVertices.push(new THREE.Vector3(bPos.getX(i), bPos.getY(i), bPos.getZ(i)))
  const velocities = baseVertices.map(() => new THREE.Vector3())
  const dentMemory = new Float32Array(baseVertices.length)
  // Smooth per-vertex phase for the strain tremor (the original used per-vertex noise,
  // which tore the surface into spikes).
  const tremorPhase = baseVertices.map((v) => v.x * 3.1 + v.y * 2.3 + v.z * 4.7)

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

  const ureters = { left: createUreter(-1, baseVertices), right: createUreter(1, baseVertices) }

  const cutawayPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)

  const scratch = new THREE.Vector3()
  const wallPoint = new THREE.Vector3()

  // Pushes vertices near `local` inward and leaves a slowly recovering dent.
  function impact(local, strength, profile) {
    for (let i = 0; i < bPos.count; i++) {
      const vx = bPos.getX(i), vy = bPos.getY(i), vz = bPos.getZ(i)
      const d = scratch.set(vx, vy, vz).distanceTo(local)
      if (d < profile.radius) {
        const power = (1.0 - d / profile.radius) * strength * profile.powerScale
        velocities[i].x -= (vx / 2.35) * power * profile.velScale
        velocities[i].y -= (vy / 2.35) * power * profile.velScale
        velocities[i].z -= (vz / 2.35) * power * profile.velScale
        dentMemory[i] = Math.min(profile.dentCap, dentMemory[i] + power * profile.dentGain)
      }
    }
  }

  const poke = (local, strength) => impact(local, strength, POKE)
  const slap = (local, strength) => impact(local, strength, SLAP)
  const clearDents = () => dentMemory.fill(0)

  // `objects`: live meshes/materials from Organ.jsx refs, plus the camera.
  function update(sim, dt, timeSec, objects) {
    const { wallMat, sphincter, stream, splash, leftDrop, rightDrop, camera, cutaway } = objects
    const phys = physicsOf(sim)

    const fillRatio = Math.max(0.01, sim.volume / sim.maxCapacity)
    const compY = sim.squeezeAmountY || 0
    const scaleY = 1.0 - compY
    const inflationScale = 0.55 + Math.pow(fillRatio, 0.45) * 0.75

    if (cutaway && camera) orientCutaway(cutawayPlane, camera.position)

    // A stretched wall is thinner, so more of the liquid shows through.
    if (wallMat) {
      const stretch = Math.min(1.0, fillRatio)
      wallMat.opacity = THREE.MathUtils.lerp(0.66, 0.36, stretch)
      // Strained muscle throbs, as in the original.
      const strainPulse = sim.sphincterToneStrain > 0.3 ? Math.sin(timeSec * 15.0) * 0.35 + 0.35 : 0
      wallMat.emissiveIntensity = 0.18 + stretch * 0.3 + strainPulse
      wallMat.roughness = THREE.MathUtils.lerp(0.38, 0.12, stretch)
    }
    if (objects.fluidMat) {
      const h = sim.hydration
      objects.fluidMat.color.setRGB(1.0, 0.72 + h * 0.22, 0.1 + h * 0.6)
      objects.fluidCapMat?.color.setRGB(0.86, 0.52 + h * 0.16, 0.06 + h * 0.18)
    }

    // Soft-body wall
    const phase = sim.globalJigglePhase
    const jiggle1 = Math.sin(phase) * sim.jiggleIntensity * 0.18
    const jiggle2 = Math.cos(phase * 1.5) * sim.jiggleIntensity * 0.12
    const bulgeXZ = Math.sqrt(1.0 / Math.max(0.2, (1.0 - compY * (0.45 + fillRatio * 0.45))))
    const wrinkleAmp = Math.pow(1.0 - Math.min(1.0, fillRatio), 1.6) * 0.28
    const sagFactor = Math.max(0, (1.0 - fillRatio * 2.2)) * 0.45
    const tremorAmp = (sim.sphincterToneStrain > 0.3) ? (sim.sphincterToneStrain * 0.045) : 0.0

    // Water balloon: liquid can't compress, so whatever a dent pushes in bulges out
    // everywhere else. A mean radial dent m loses ~3m of volume; scaling by (1 + m)
    // puts it back.
    let dentSum = 0
    for (let i = 0; i < dentMemory.length; i++) {
      dentMemory[i] = Math.max(0, dentMemory[i] - dt * 1.4)
      dentSum += dentMemory[i]
    }
    const balloonBulge = 1.0 + dentSum / dentMemory.length

    for (let i = 0; i < bPos.count; i++) {
      const base = baseVertices[i]
      const cx = bPos.getX(i), cy = bPos.getY(i), cz = bPos.getZ(i)
      const dentOffset = dentMemory[i]

      // Rugae folds of a deflated bladder: broad enough for the mesh to show smoothly.
      const wrinkleNoise = (Math.sin(base.x * 3.5 + base.y * 4.5) * Math.cos(base.z * 4.0 + base.y * 2.5)) * wrinkleAmp
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

      const tp = tremorPhase[i]
      const tremorX = Math.sin(timeSec * 41.0 + tp) * tremorAmp * 0.5
      const tremorY = Math.sin(timeSec * 37.0 + tp * 1.3) * tremorAmp * 0.5
      const tremorZ = Math.sin(timeSec * 43.0 + tp * 0.7) * tremorAmp * 0.5

      const sagY = base.y > 0 ? -sagFactor * (base.y / 2.35) : 0
      const flaccidSpread = base.y < 0 ? (1.0 + (1.0 - fillRatio) * 0.2) : 1.0
      const totalRadMod = Math.max(0.2, (1.0 + jiggleWobble + rippleDisp - dentOffset)) * balloonBulge

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
      fPos.setXYZ(i, nx * FLUID_INSET, ny * FLUID_INSET, nz * FLUID_INSET)
    }
    bPos.needsUpdate = true
    fPos.needsUpdate = true
    bladderGeo.computeVertexNormals()
    fluidGeo.computeVertexNormals()

    // Ureters stay plugged into the wall as it inflates and wobbles.
    for (const ureter of [ureters.left, ureters.right]) {
      wallPoint.fromBufferAttribute(bPos, ureter.endIndex)
      updateUreter(ureter, wallPoint)
    }

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
          const dist = Math.random() * 0.25 * Math.min(1.0, sim.flowRate / 30.0)
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
        ureters.left.curve.getPointAt(progress1, leftDrop.position)
        leftDrop.scale.setScalar(Math.max(0.1, 1.2 * (1.0 - progress1)))
        ureters.right.curve.getPointAt(progress2, rightDrop.position)
        rightDrop.scale.setScalar(Math.max(0.1, 1.2 * (1.0 - progress2)))
      }
    }
  }

  return {
    diffTex, normTex, bladderGeo, fluidGeo, sphincterGeo, streamGeo, splashGeo,
    ureterGeoLeft: ureters.left.geo, ureterGeoRight: ureters.right.geo,
    cutawayPlane, poke, slap, clearDents, update,
  }
}
