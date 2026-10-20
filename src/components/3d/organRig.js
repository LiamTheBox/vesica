import * as THREE from 'three'
import { physicsOf } from '../../sim/sim'

// Geometry and per-frame deformation for the organ. Kept outside React so
// the 60 fps vertex work never touches component render; `Organ.jsx` wires it up.
// The per-frame loops work on the raw attribute arrays with per-vertex constants
// precomputed, and allocate nothing (M7).

const SPLASH_COUNT = 180
const STREAM_SEGMENTS = 24

export function createOrganTextures() {
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

// Same result as BufferGeometry.computeVertexNormals() for indexed geometry, on the raw
// arrays. Three's version reads every corner through a Vector3, which made it the
// largest single cost of a frame on a throttled phone profile.
export function computeNormals(geometry) {
  const pos = geometry.attributes.position.array
  const nrm = geometry.attributes.normal.array
  const idx = geometry.index.array
  nrm.fill(0)
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
    const cbx = pos[c] - pos[b], cby = pos[c + 1] - pos[b + 1], cbz = pos[c + 2] - pos[b + 2]
    const abx = pos[a] - pos[b], aby = pos[a + 1] - pos[b + 1], abz = pos[a + 2] - pos[b + 2]
    const nx = cby * abz - cbz * aby
    const ny = cbz * abx - cbx * abz
    const nz = cbx * aby - cby * abx
    nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz
    nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz
    nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const inv = 1 / (Math.sqrt(nrm[i] * nrm[i] + nrm[i + 1] * nrm[i + 1] + nrm[i + 2] * nrm[i + 2]) || 1)
    nrm[i] *= inv; nrm[i + 1] *= inv; nrm[i + 2] *= inv
  }
  geometry.attributes.normal.needsUpdate = true
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

// Urine: Organ.jsx draws the wall's geometry again, scaled to the volume held (see
// urineScale). Full, it fills the sac just inside the membrane.
export const FLUID_INSET = 0.965
// What's left after voiding: the bladder counts as empty at or below this.
export const RESIDUAL_ML = 10
// The urine shrinks toward this point, 35 % of the way from the centre to the bottom of
// the wall at rest, so what's left pools low, by the neck.
const URINE_PIVOT_Y = -0.35 * 2.35 * 1.12

const inflationOf = (fillRatio) => 0.55 + Math.pow(fillRatio, 0.45) * 0.75

// Linear size of the urine relative to the wall. The urine's volume is the simulation's;
// the wall's size is a visual function of fill that never drops below about half, so
// whatever the urine doesn't fill is muscle wall: thick when empty, the thin membrane
// (FLUID_INSET) when stretched full. A bladder holds no air.
export function urineScale(volume, maxCapacity) {
  const urine = Math.max(0, (volume - RESIDUAL_ML) / (maxCapacity - RESIDUAL_ML))
  if (urine === 0) return 0
  const wallGrowth = inflationOf(1) / inflationOf(Math.max(0.01, volume / maxCapacity))
  return Math.min(FLUID_INSET, FLUID_INSET * wallGrowth * Math.cbrt(urine))
}

const URETER_SEGMENTS = 32
const URETER_RADIAL = 8
const URETER_RADIUS = 0.11
// Ring orientation reference: the ureters run roughly in the x–y plane, never along z.
const URETER_REF = new THREE.Vector3(0, 0, 1)
// Arc-length table resolution, so rings and drops are spaced evenly along the tube.
const ARC_SAMPLES = 64

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
  // Only the topology (index, uvs) is kept; buildTube() writes the vertices.
  const geo = new THREE.TubeGeometry(curve, URETER_SEGMENTS, URETER_RADIUS, URETER_RADIAL, false)
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 6)
  const ureter = { curve, geo, endIndex, arc: new Float64Array(ARC_SAMPLES + 1), lastEnd: new THREE.Vector3(Infinity, 0, 0) }
  buildTube(ureter)
  return ureter
}

const arcPoint = new THREE.Vector3()
const arcPrev = new THREE.Vector3()

// Curve parameter t at arc-length fraction u (what Curve.getPointAt does, without its allocations).
function curveT(arc, u) {
  const target = u * arc[ARC_SAMPLES]
  let lo = 0
  let hi = ARC_SAMPLES
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (arc[mid] < target) lo = mid
    else hi = mid
  }
  const span = arc[hi] - arc[lo]
  return (lo + (span > 0 ? (target - arc[lo]) / span : 0)) / ARC_SAMPLES
}

const ringCenter = new THREE.Vector3()
const ringAhead = new THREE.Vector3()
const ringBehind = new THREE.Vector3()
const ringT = new THREE.Vector3()
const ringN = new THREE.Vector3()
const ringB = new THREE.Vector3()

// Writes the tube around the curve into the existing buffers (TubeGeometry would
// allocate a whole new geometry every time the wall moves).
function buildTube({ curve, geo, arc }) {
  curve.getPoint(0, arcPrev)
  arc[0] = 0
  for (let k = 1; k <= ARC_SAMPLES; k++) {
    curve.getPoint(k / ARC_SAMPLES, arcPoint)
    arc[k] = arc[k - 1] + arcPoint.distanceTo(arcPrev)
    arcPrev.copy(arcPoint)
  }

  const pos = geo.attributes.position.array
  const nrm = geo.attributes.normal.array
  let o = 0
  for (let i = 0; i <= URETER_SEGMENTS; i++) {
    const t = curveT(arc, i / URETER_SEGMENTS)
    curve.getPoint(t, ringCenter)
    curve.getPoint(Math.min(1, t + 0.001), ringAhead)
    curve.getPoint(Math.max(0, t - 0.001), ringBehind)
    ringT.subVectors(ringAhead, ringBehind).normalize()
    ringN.crossVectors(ringT, URETER_REF).normalize()
    ringB.crossVectors(ringT, ringN)
    for (let j = 0; j <= URETER_RADIAL; j++) {
      const v = (j / URETER_RADIAL) * Math.PI * 2
      const sin = Math.sin(v)
      const cos = -Math.cos(v)
      const nx = cos * ringN.x + sin * ringB.x
      const ny = cos * ringN.y + sin * ringB.y
      const nz = cos * ringN.z + sin * ringB.z
      nrm[o] = nx; nrm[o + 1] = ny; nrm[o + 2] = nz
      pos[o] = ringCenter.x + URETER_RADIUS * nx
      pos[o + 1] = ringCenter.y + URETER_RADIUS * ny
      pos[o + 2] = ringCenter.z + URETER_RADIUS * nz
      o += 3
    }
  }
  geo.attributes.position.needsUpdate = true
  geo.attributes.normal.needsUpdate = true
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
  buildTube(ureter)
}

// A drop at arc-length fraction u along the ureter.
function ureterPoint(ureter, u, target) {
  return ureter.curve.getPoint(curveT(ureter.arc, u), target)
}

// The sphincter as a surface of revolution, (radius, height) from the bottom up: the
// urethra down to the outlet, the thick muscular ring at the bladder neck, then the
// neck rising into the bladder (hidden inside the wall). It spans the same height as
// the original's tube, so it sits and attaches where that did.
const SPHINCTER_PROFILE = [
  [0.1, -0.6], [0.11, -0.48], [0.125, -0.34], [0.15, -0.25],
  [0.26, -0.17], [0.38, -0.09], [0.43, 0.01], [0.42, 0.1], [0.35, 0.19],
  [0.28, 0.3], [0.29, 0.45], [0.32, 0.6],
]
// Puckered folds around the ring, like a drawstring.
const SPHINCTER_FOLDS = 14
const SPHINCTER_COLORS = { neck: 0xe11d48, ring: 0xa30f33, urethra: 0xfb7185 }

// How much a height on the profile belongs to the muscle ring, or to the urethra (0..1).
export const ringWeight = (y) => THREE.MathUtils.smoothstep(y, -0.27, -0.15) * (1 - THREE.MathUtils.smoothstep(y, 0.16, 0.28))
export const urethraWeight = (y) => 1 - THREE.MathUtils.smoothstep(y, -0.3, -0.18)

export function createSphincterGeometry() {
  const curve = new THREE.SplineCurve(SPHINCTER_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)))
  const geo = new THREE.LatheGeometry(curve.getPoints(40), 48)
  // Colour by part: deep red muscle ring, pinker urethra.
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const neck = new THREE.Color(SPHINCTER_COLORS.neck)
  const ring = new THREE.Color(SPHINCTER_COLORS.ring)
  const urethra = new THREE.Color(SPHINCTER_COLORS.urethra)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    c.copy(neck).lerp(ring, ringWeight(y)).lerp(urethra, urethraWeight(y)).toArray(colors, i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

export function createOrganRig() {
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

  const count = bPos.count
  const wall = bPos.array
  const baseVertices = []
  for (let i = 0; i < count; i++) baseVertices.push(new THREE.Vector3(bPos.getX(i), bPos.getY(i), bPos.getZ(i)))
  const base = new Float32Array(wall) // rest shape
  const velocity = new Float64Array(count * 3)
  const dentMemory = new Float32Array(count)

  // Per-vertex constants of the deformation below, so a frame only does multiply-adds.
  const wrinkle = new Float64Array(count) // rugae fold pattern, scaled by wrinkleAmp
  const jiggleS3 = new Float64Array(count) // sin 3θ · sin 2φ
  const jiggleC3 = new Float64Array(count) // cos 3θ · sin 2φ
  const jiggleC2 = new Float64Array(count) // cos 2θ
  const jiggleS2 = new Float64Array(count) // sin 2θ
  // Smooth per-vertex phase for the strain tremor (the original used per-vertex noise,
  // which tore the surface into spikes): cos/sin of tp, 1.3 tp and 0.7 tp.
  const tremor = new Float64Array(count * 6)
  for (let i = 0; i < count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2]
    wrinkle[i] = Math.sin(x * 3.5 + y * 4.5) * Math.cos(z * 4.0 + y * 2.5)
    const theta = Math.atan2(z, x)
    const sin2phi = Math.sin(Math.acos(Math.max(-1, Math.min(1, y / 2.35))) * 2.0)
    jiggleS3[i] = Math.sin(theta * 3.0) * sin2phi
    jiggleC3[i] = Math.cos(theta * 3.0) * sin2phi
    jiggleC2[i] = Math.cos(theta * 2.0)
    jiggleS2[i] = Math.sin(theta * 2.0)
    const tp = x * 3.1 + y * 2.3 + z * 4.7
    tremor.set([Math.cos(tp), Math.sin(tp), Math.cos(tp * 1.3), Math.sin(tp * 1.3), Math.cos(tp * 0.7), Math.sin(tp * 0.7)], i * 6)
  }

  const sphincterGeo = createSphincterGeometry()
  const sPos = sphincterGeo.attributes.position
  const sCount = sPos.count
  // r, y, cos θ, sin θ, fold pattern, sin 4θ, cos 4θ, ring weight, urethra weight per vertex
  const sphincterBase = new Float64Array(sCount * 9)
  for (let i = 0; i < sCount; i++) {
    const x = sPos.getX(i), y = sPos.getY(i), z = sPos.getZ(i)
    const theta = Math.atan2(z, x)
    sphincterBase.set([
      Math.hypot(x, z), y, Math.cos(theta), Math.sin(theta), Math.sin(theta * SPHINCTER_FOLDS),
      Math.sin(theta * 4.0), Math.cos(theta * 4.0), ringWeight(y), urethraWeight(y),
    ], i * 9)
  }
  let clenchLevel = 0 // eases in and out rather than snapping

  const streamGeo = new THREE.CylinderGeometry(0.12, 0.08, 6.0, 16, STREAM_SEGMENTS, true)
  const streamPos = streamGeo.attributes.position
  // The original's stream indexing (segment from i % 24, angle from i / 24) gives its
  // twisting look; keep it, precomputed.
  const streamBase = new Float64Array(streamPos.count * 3) // segY, cos θ, sin θ
  for (let i = 0; i < streamPos.count; i++) {
    const theta = ((i / STREAM_SEGMENTS) % 16) * (Math.PI * 2 / 16)
    streamBase.set([(i % STREAM_SEGMENTS) / STREAM_SEGMENTS, Math.cos(theta), Math.sin(theta)], i * 3)
  }

  const splashGeo = new THREE.BufferGeometry()
  const splashPositions = new Float32Array(SPLASH_COUNT * 3)
  for (let i = 0; i < SPLASH_COUNT; i++) splashPositions[i * 3 + 1] = -999
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3))

  const ureters = [createUreter(-1, baseVertices), createUreter(1, baseVertices)]

  const cutawayPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)

  const scratch = new THREE.Vector3()
  const wallPoint = new THREE.Vector3()

  // Pushes vertices near `local` inward and leaves a slowly recovering dent.
  function impact(local, strength, profile) {
    for (let i = 0; i < count; i++) {
      const vx = wall[i * 3], vy = wall[i * 3 + 1], vz = wall[i * 3 + 2]
      const d = scratch.set(vx, vy, vz).distanceTo(local)
      if (d < profile.radius) {
        const power = (1.0 - d / profile.radius) * strength * profile.powerScale
        velocity[i * 3] -= (vx / 2.35) * power * profile.velScale
        velocity[i * 3 + 1] -= (vy / 2.35) * power * profile.velScale
        velocity[i * 3 + 2] -= (vz / 2.35) * power * profile.velScale
        dentMemory[i] = Math.min(profile.dentCap, dentMemory[i] + power * profile.dentGain)
      }
    }
  }

  const poke = (local, strength) => impact(local, strength, POKE)
  const slap = (local, strength) => impact(local, strength, SLAP)
  const clearDents = () => dentMemory.fill(0)

  // `objects`: live meshes/materials from Organ.jsx refs, plus the camera.
  function update(sim, dt, timeSec, objects) {
    const { wallMat, urine, sphincter, stream, splash, leftDrop, rightDrop, camera, cutaway } = objects
    const phys = physicsOf(sim)

    const fillRatio = Math.max(0.01, sim.volume / sim.maxCapacity)
    const compY = sim.squeezeAmountY || 0
    const scaleY = 1.0 - compY
    const inflationScale = inflationOf(fillRatio)

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
    }

    // Soft-body wall
    const phase = sim.globalJigglePhase
    const jiggle1 = Math.sin(phase) * sim.jiggleIntensity * 0.18
    const jiggle2 = Math.cos(phase * 1.5) * sim.jiggleIntensity * 0.12
    // sin(3θ + phase)·sin 2φ·j1 + cos(2θ − 1.2 phase)·j2, expanded with the angle-sum identities
    const jA = Math.cos(phase) * jiggle1
    const jB = Math.sin(phase) * jiggle1
    const jC = Math.cos(phase * 1.2) * jiggle2
    const jD = Math.sin(phase * 1.2) * jiggle2
    const bulgeXZ = Math.sqrt(1.0 / Math.max(0.2, (1.0 - compY * (0.45 + fillRatio * 0.45))))
    const wrinkleAmp = Math.pow(1.0 - Math.min(1.0, fillRatio), 1.6) * 0.28
    const sagFactor = Math.max(0, (1.0 - fillRatio * 2.2)) * 0.45
    const tremorAmp = (sim.sphincterToneStrain > 0.3) ? (sim.sphincterToneStrain * 0.045) : 0.0
    const tremorHalf = tremorAmp * 0.5
    const s41 = Math.sin(timeSec * 41.0), c41 = Math.cos(timeSec * 41.0)
    const s37 = Math.sin(timeSec * 37.0), c37 = Math.cos(timeSec * 37.0)
    const s43 = Math.sin(timeSec * 43.0), c43 = Math.cos(timeSec * 43.0)
    const sloshX = Math.sin(sim.sloshAngleX) * 0.22
    const sloshZ = Math.sin(sim.sloshAngleZ) * 0.22
    const coreX = sim.fluidCoreOffset.x * 0.35
    const coreZ = sim.fluidCoreOffset.z * 0.35
    const lowerSpread = 1.0 + (1.0 - fillRatio) * 0.2
    const ripples = sim.ripples
    const springDt = phys.springK * dt
    const damping = phys.damping

    // Water balloon: liquid can't compress, so whatever a dent pushes in bulges out
    // everywhere else. A mean radial dent m loses ~3m of volume; scaling by (1 + m)
    // puts it back.
    let dentSum = 0
    for (let i = 0; i < count; i++) {
      dentMemory[i] = Math.max(0, dentMemory[i] - dt * 1.4)
      dentSum += dentMemory[i]
    }
    const balloonBulge = 1.0 + dentSum / count

    for (let i = 0; i < count; i++) {
      const o = i * 3
      const bx = base[o], by = base[o + 1], bz = base[o + 2]
      const yNorm = by / 2.35

      // Rugae folds of a deflated bladder: broad enough for the mesh to show smoothly.
      const wrinkleNoise = wrinkle[i] * wrinkleAmp
      const sloshPushX = sloshX * yNorm + coreX
      const sloshPushZ = sloshZ * yNorm + coreZ
      const jiggleWobble = jiggleS3[i] * jA + jiggleC3[i] * jB + jiggleC2[i] * jC + jiggleS2[i] * jD

      let rippleDisp = 0
      for (let r = 0; r < ripples.length; r++) {
        const rip = ripples[r]
        const dx = bx - rip.center.x, dy = by - rip.center.y, dz = bz - rip.center.z
        const waveDist = Math.abs(Math.sqrt(dx * dx + dy * dy + dz * dz) - rip.radius)
        if (waveDist < 0.65) rippleDisp += Math.cos((waveDist / 0.65) * (Math.PI / 2)) * rip.amplitude
      }

      let tremorX = 0, tremorY = 0, tremorZ = 0
      if (tremorHalf > 0) {
        const t6 = i * 6
        tremorX = (s41 * tremor[t6] + c41 * tremor[t6 + 1]) * tremorHalf
        tremorY = (s37 * tremor[t6 + 2] + c37 * tremor[t6 + 3]) * tremorHalf
        tremorZ = (s43 * tremor[t6 + 4] + c43 * tremor[t6 + 5]) * tremorHalf
      }

      const sagY = by > 0 ? -sagFactor * yNorm : 0
      const flaccidSpread = by < 0 ? lowerSpread : 1.0
      const totalRadMod = Math.max(0.2, (1.0 + jiggleWobble + rippleDisp - dentMemory[i])) * balloonBulge

      const tx = ((bx * flaccidSpread * bulgeXZ + wrinkleNoise) * inflationScale + sloshPushX + tremorX) * totalRadMod
      const ty = ((by * scaleY + sagY + wrinkleNoise * 0.5) * inflationScale + tremorY) * totalRadMod
      const tz = ((bz * flaccidSpread * bulgeXZ + wrinkleNoise) * inflationScale + sloshPushZ + tremorZ) * totalRadMod

      const cx = wall[o], cy = wall[o + 1], cz = wall[o + 2]
      const vx = (velocity[o] + (tx - cx) * springDt) * damping
      const vy = (velocity[o + 1] + (ty - cy) * springDt) * damping
      const vz = (velocity[o + 2] + (tz - cz) * springDt) * damping
      velocity[o] = vx; velocity[o + 1] = vy; velocity[o + 2] = vz
      wall[o] = cx + vx * dt
      wall[o + 1] = cy + vy * dt
      wall[o + 2] = cz + vz * dt
    }
    bPos.needsUpdate = true
    computeNormals(bladderGeo)

    // Urine: the wall's shape scaled about a point low in the sac, free to slosh within
    // whatever wall thickness there is around it.
    if (urine) {
      const k = urineScale(sim.volume, sim.maxCapacity)
      urine.visible = k > 0.002
      const room = 1 - k / FLUID_INSET
      urine.scale.setScalar(Math.max(k, 1e-4))
      urine.position.set(sim.fluidCoreOffset.x * 0.4 * room, URINE_PIVOT_Y * inflationScale * scaleY * (1 - k), sim.fluidCoreOffset.z * 0.4 * room)
    }

    // Ureters stay plugged into the wall as it inflates and wobbles.
    for (const ureter of ureters) {
      wallPoint.fromBufferAttribute(bPos, ureter.endIndex)
      updateUreter(ureter, wallPoint)
    }

    // Sphincter: a clench clamps the ring and deepens its folds, voiding opens it all
    // up, and strain makes it twitch (the rippling shake of the original's tube).
    const dil = sim.isStressLeaking ? 0.35 : sim.sphincterDilation
    const twitchOsc = Math.sin(timeSec * 38.0) * Math.cos(timeSec * 23.0)
    const twitch = sim.sphincterToneStrain * 0.08 * twitchOsc
    const s30 = Math.sin(timeSec * 30.0), c30 = Math.cos(timeSec * 30.0)
    clenchLevel += ((sim.isClenching ? 1 : 0) - clenchLevel) * Math.min(1, dt * 14)
    const foldDepth = (0.02 + 0.03 * clenchLevel) * (1.0 - dil)
    const sArr = sPos.array
    for (let i = 0; i < sCount; i++) {
      const k = i * 9
      const r = sphincterBase[k], y = sphincterBase[k + 1]
      const ring = sphincterBase[k + 7], urethra = sphincterBase[k + 8]
      const ripple = sphincterBase[k + 5] * c30 + sphincterBase[k + 6] * s30 // sin(4θ + 30t)
      const squeeze = 1.0 - clenchLevel * (0.1 + 0.12 * ring + 0.3 * urethra)
      const closed = (r + sphincterBase[k + 4] * foldDepth * ring + ripple * twitch) * squeeze
      const open = r * (1.0 + 0.25 * ring + 1.3 * urethra)
      const radius = THREE.MathUtils.lerp(closed, open, dil)
      sArr[i * 3] = sphincterBase[k + 2] * radius
      sArr[i * 3 + 1] = y
      sArr[i * 3 + 2] = sphincterBase[k + 3] * radius
    }
    sPos.needsUpdate = true
    computeNormals(sphincterGeo)

    if (sphincter) sphincter.position.y = -2.35 * inflationScale * scaleY - 0.45

    // Stream & splash
    const exitY = sphincter ? sphincter.position.y - 0.55 : -2.5
    const streaming = sim.flowRate > 0
    if (stream) stream.visible = streaming
    if (splash) splash.visible = streaming
    if (streaming) {
      const streamArr = streamPos.array
      const streamRadius = THREE.MathUtils.lerp(0.04, 0.16, dil)
      const flowScale = 0.5 + Math.min(1.0, sim.flowRate / 30.0) * 0.5
      const sx = Math.sin(sim.sloshAngleX) * 0.4
      const sz = Math.sin(sim.sloshAngleZ) * 0.4
      for (let i = 0; i < streamPos.count; i++) {
        const segY = streamBase[i * 3]
        const r = (streamRadius * (1.0 - segY * 0.35) + Math.sin(timeSec * 24.0 + segY * 18.0) * (0.015 * segY)) * flowScale
        streamArr[i * 3] = streamBase[i * 3 + 1] * r + sx * segY
        streamArr[i * 3 + 1] = exitY - (segY * 5.5)
        streamArr[i * 3 + 2] = streamBase[i * 3 + 2] * r + sz * segY
      }
      streamPos.needsUpdate = true
      computeNormals(streamGeo)

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
      splashGeo.attributes.position.needsUpdate = true
    } else if (splashPositions[1] !== -999) {
      for (let i = 0; i < SPLASH_COUNT; i++) splashPositions[i * 3 + 1] = -999
      splashGeo.attributes.position.needsUpdate = true
    }

    // Drops travelling down the ureters while drinks are being filtered
    const hasBeverage = sim.activeBeverages.length > 0
    if (leftDrop && rightDrop) {
      leftDrop.visible = hasBeverage
      rightDrop.visible = hasBeverage
      if (hasBeverage) {
        const progress1 = (timeSec * 0.8) % 1.0
        const progress2 = ((timeSec * 0.8) + 0.5) % 1.0
        ureterPoint(ureters[0], progress1, leftDrop.position)
        leftDrop.scale.setScalar(Math.max(0.1, 1.2 * (1.0 - progress1)))
        ureterPoint(ureters[1], progress2, rightDrop.position)
        rightDrop.scale.setScalar(Math.max(0.1, 1.2 * (1.0 - progress2)))
      }
    }
  }

  return {
    bladderGeo, sphincterGeo, streamGeo, splashGeo,
    ureterGeoLeft: ureters[0].geo, ureterGeoRight: ureters[1].geo,
    cutawayPlane, poke, slap, clearDents, update,
  }
}
