import * as THREE from 'three'
import { physicsOf } from '../../sim/sim'
import { computeNormals } from './normals'
import { createStream } from './stream'

export { computeNormals }

// Geometry and per-frame deformation for the organ. Kept outside React so
// the 60 fps vertex work never touches component render; `Organ.jsx` wires it up.
// The per-frame loops work on the raw attribute arrays with per-vertex constants
// precomputed, and allocate nothing (M7).


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

// Bladder centre in world space (the organ group sits 0.2 above the origin).
export const ORGAN_CENTER = new THREE.Vector3(0, 0.2, 0)

// Points the cutaway plane away from the camera, so the half nearest the player is always
// the one removed, from any orbit angle. The cut is upright, a section like an anatomy
// book's, so looking up from below doesn't slice the bottom off; seen from straight above
// or below it keeps its last direction.
export function orientCutaway(plane, cameraPosition, center = ORGAN_CENTER) {
  const nx = center.x - cameraPosition.x
  const nz = center.z - cameraPosition.z
  const length = Math.hypot(nx, nz)
  if (length > 1e-4) plane.normal.set(nx / length, 0, nz / length)
  plane.constant = -plane.normal.dot(center)
  return plane
}

// Impact profiles from the original pokeBladder() / slapBladder().
const POKE = { radius: 1.4, powerScale: 1.0, velScale: 1.6, dentGain: 0.35, dentCap: 0.6 }
const SLAP = { radius: 1.8, powerScale: 2.2, velScale: 1.0, dentGain: 0.4, dentCap: 0.8 }

// Urine: Organ.jsx draws the lining's geometry, scaled to the volume held (see
// urineScale). Full, it fills the sac just inside the membrane.
export const FLUID_INSET = 0.965
// Rugae: an emptying bladder keeps a smooth outside and folds only its lining, by up to
// this fraction of the lining's radius. The folds flatten out as it fills.
const RUGAE_DEPTH = 0.1
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
// Where a ureter goes into the wall it narrows, enters at an angle from above and sinks in
// a little: little enough that its rim stays in the full bladder's thin membrane, never
// poking through into the urine.
const URETER_TIP = 0.5 // radius of the last ring, relative to the tube
const URETER_ENTRY = Math.tan(THREE.MathUtils.degToRad(30)) // from square to the wall, toward above
const URETER_SINK = 0.02
// Ring orientation reference: the ureters run roughly in the x–y plane, never along z.
const URETER_REF = new THREE.Vector3(0, 0, 1)
// Arc-length table resolution, so rings and drops are spaced evenly along the tube.
const ARC_SAMPLES = 64

function createUreter(side, baseVertices) {
  // Ureters come down behind the bladder and enter low on its back, either side of the
  // neck (the upper corners of the trigone).
  const dir = new THREE.Vector3(0.5 * side, -0.4, -0.75).normalize()
  let endIndex = 0
  let best = -Infinity
  const n = new THREE.Vector3()
  baseVertices.forEach((v, i) => {
    const d = n.copy(v).normalize().dot(dir)
    if (d > best) { best = d; endIndex = i }
  })

  // From behind and above, past a bend behind the bladder and a short lead-in, to the wall.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.0 * side, 4.4, -2.0), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
  ])
  const end = baseVertices[endIndex]
  routeUreter(curve.points, end, n.copy(end).normalize())
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
    const radius = i === URETER_SEGMENTS ? URETER_RADIUS * URETER_TIP : URETER_RADIUS
    for (let j = 0; j <= URETER_RADIAL; j++) {
      const v = (j / URETER_RADIAL) * Math.PI * 2
      const sin = Math.sin(v)
      const cos = -Math.cos(v)
      const nx = cos * ringN.x + sin * ringB.x
      const ny = cos * ringN.y + sin * ringB.y
      const nz = cos * ringN.z + sin * ringB.z
      nrm[o] = nx; nrm[o + 1] = ny; nrm[o + 2] = nz
      pos[o] = ringCenter.x + radius * nx
      pos[o + 1] = ringCenter.y + radius * ny
      pos[o + 2] = ringCenter.z + radius * nz
      o += 3
    }
  }
  geo.attributes.position.needsUpdate = true
  geo.attributes.normal.needsUpdate = true
}

const UP = new THREE.Vector3(0, 1, 0)
const entry = new THREE.Vector3()

// The bend and the end of a ureter for a wall point and its normal. The lead-in comes from
// a little above square to the wall, so the tube dives into the wall rather than hooking
// up into it from below.
function routeUreter([, bend, leadIn, end], wallPoint, normal) {
  end.copy(wallPoint).addScaledVector(normal, -URETER_SINK)
  entry.copy(UP).addScaledVector(normal, -normal.y).normalize() // up, along the wall
  entry.multiplyScalar(URETER_ENTRY).add(normal).normalize()
  leadIn.copy(end).addScaledVector(entry, 0.3)
  bend.copy(end).addScaledVector(normal, 1.3)
  bend.y += 0.8
}

// Re-routes a ureter so it always ends on the (moving) bladder wall.
function updateUreter(ureter, wallPoint, wallNormal) {
  if (ureter.lastEnd.distanceToSquared(wallPoint) < 0.0004) return
  ureter.lastEnd.copy(wallPoint)
  routeUreter(ureter.curve.points, wallPoint, wallNormal)
  buildTube(ureter)
}

// A drop at arc-length fraction u along the ureter.
function ureterPoint(ureter, u, target) {
  return ureter.curve.getPoint(curveT(ureter.arc, u), target)
}

// The organ is one surface: the bladder from its dome down to the neck, then the
// sphincter ring and the urethra down to the opening, so there's no seam between them,
// they move together and the cutaway sections them together. Rings of RADIAL segments
// (plus a seam vertex for the UVs) from the top down, like a SphereGeometry: the bladder's
// rows are the first BLADDER_ROWS + 1 rings of a 48-row sphere, the rest follow the
// sphincter's profile, hanging from the centre of the bladder's last ring.
const RADIAL = 64
export const RING_VERTICES = RADIAL + 1
const SPHERE_ROWS = 48
const BLADDER_ROWS = 41 // the neck opens 26° up from the bottom of the sphere
export const BLADDER_VERTICES = (BLADDER_ROWS + 1) * RING_VERTICES
export const NECK_ROW = BLADDER_ROWS + 1 // the first row of the sphincter
const NECK_ROWS = 18
// The neck sits forward (anterior, +z) with the bladder's base bulging behind it, as in
// the body, rather than hanging from the middle.
const NECK_FORWARD = 0.5
const NECK_GAP = 0.12 // from the bladder's last ring down to the top of the profile
// The neck doesn't stretch with the dome (the pelvic floor holds it): the lowest rows keep
// about their resting width, so the bladder funnels into the sphincter at any fill.
const NECK_WIDTH = 0.9
const forwardOf = (sy) => NECK_FORWARD * THREE.MathUtils.smoothstep(-sy, 0.1, 1)

// The sphincter's profile, (radius, height) from the bottom up: a lip around the single
// small opening, the urethra up from it, then the thick muscular ring at the bladder neck.
export const OUTLET_Y = -0.62
const NECK_TOP_Y = 0.19
const SPHINCTER_PROFILE = [
  [0.075, OUTLET_Y], [0.1, -0.6], [0.11, -0.48], [0.125, -0.34], [0.15, -0.25],
  [0.26, -0.17], [0.38, -0.09], [0.43, 0.01], [0.42, 0.1], [0.35, NECK_TOP_Y],
]
// Puckered folds around the ring, like a drawstring.
const SPHINCTER_FOLDS = 14
const WALL_COLOR = 0xf43f5e
const SPHINCTER_COLORS = { neck: 0xe11d48, ring: 0xa30f33, urethra: 0xfb7185 }

// How much a height on the profile belongs to the muscle ring, or to the urethra (0..1).
const ringWeight = (y) => THREE.MathUtils.smoothstep(y, -0.27, -0.15) * (1 - THREE.MathUtils.smoothstep(y, 0.16, 0.28))
const urethraWeight = (y) => 1 - THREE.MathUtils.smoothstep(y, -0.3, -0.18)

// Detrusor contraction, in urge waves and while voiding: the wall tightens and rounds out,
// a squeeze runs from the dome down to the neck, and the muscle bundles stand out.
const CONTRACT_TIGHTEN = 0.04
const CONTRACT_SQUEEZE = 0.07
const CONTRACT_BUNDLES = 0.03
const SQUEEZE_SECONDS = 1.6

// Each ring's first and last vertex are the same point (two for the UVs), and so are all
// of the dome's top row. Each copy gets its normal from its own triangles only, which
// shows as a crease down the side and a star on top; they share the average instead.
function weldSeam(geometry) {
  const nrm = geometry.attributes.normal.array
  let x = 0, y = 0, z = 0
  for (let o = 0; o < RADIAL * 3; o += 3) { x += nrm[o]; y += nrm[o + 1]; z += nrm[o + 2] }
  const top = 1 / (Math.hypot(x, y, z) || 1)
  for (let o = 0; o < RING_VERTICES * 3; o += 3) { nrm[o] = x * top; nrm[o + 1] = y * top; nrm[o + 2] = z * top }
  for (let a = RING_VERTICES * 3; a < nrm.length; a += RING_VERTICES * 3) {
    const b = a + RADIAL * 3
    const x = nrm[a] + nrm[b], y = nrm[a + 1] + nrm[b + 1], z = nrm[a + 2] + nrm[b + 2]
    const inv = 1 / (Math.hypot(x, y, z) || 1)
    nrm[a] = nrm[b] = x * inv
    nrm[a + 1] = nrm[b + 1] = y * inv
    nrm[a + 2] = nrm[b + 2] = z * inv
  }
}

// Vertex colours carry the wall's opacity (alpha), so the membrane can be see-through
// while the sphincter stays solid.
function createOrganGeometry() {
  const curve = new THREE.SplineCurve(SPHINCTER_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)))
  const profile = curve.getSpacedPoints(NECK_ROWS - 1).reverse() // top down
  const rows = NECK_ROW + NECK_ROWS
  const count = rows * RING_VERTICES
  const position = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const color = new Float32Array(count * 4)
  const wallColor = new THREE.Color(WALL_COLOR)
  const neck = new THREE.Color(SPHINCTER_COLORS.neck)
  const ring = new THREE.Color(SPHINCTER_COLORS.ring)
  const urethra = new THREE.Color(SPHINCTER_COLORS.urethra)
  const c = new THREE.Color()
  const neckTheta = (BLADDER_ROWS / SPHERE_ROWS) * Math.PI
  const neckTop = 2.35 * Math.cos(neckTheta) * 1.12 - NECK_GAP
  const neckZ = forwardOf(Math.cos(neckTheta))

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix <= RADIAL; ix++) {
      const i = iy * RING_VERTICES + ix
      const phi = (ix / RADIAL) * Math.PI * 2
      const dx = -Math.cos(phi)
      const dz = Math.sin(phi)
      if (iy < NECK_ROW) {
        const theta = (iy / SPHERE_ROWS) * Math.PI
        const sy = Math.cos(theta)
        const r = 2.35 * Math.sin(theta)
        // Narrows toward the neck, easing in gently below the equator so the outline has
        // no crease or shoulder there.
        const neckFactor = sy < 0 ? 1.0 - THREE.MathUtils.smootherstep(-sy, 0, 1) * 0.6 : 1.0
        position[i * 3] = dx * r * neckFactor
        position[i * 3 + 1] = 2.35 * sy * 1.12
        position[i * 3 + 2] = dz * r * neckFactor * 0.94 + forwardOf(sy)
        c.copy(wallColor)
      } else {
        const { x: r, y } = profile[iy - NECK_ROW]
        position[i * 3] = dx * r
        position[i * 3 + 1] = neckTop + y - NECK_TOP_Y
        position[i * 3 + 2] = neckZ + dz * r
        // Colour by part: deep red muscle ring, pinker urethra.
        c.copy(neck).lerp(ring, ringWeight(y)).lerp(urethra, urethraWeight(y))
      }
      color.set([c.r, c.g, c.b, iy < NECK_ROW ? 0.6 : 1], i * 4)
      uv.set([ix / RADIAL, 1 - iy / (rows - 1)], i * 2)
    }
  }

  const index = []
  for (let iy = 0; iy < rows - 1; iy++) {
    for (let ix = 0; ix < RADIAL; ix++) {
      const a = iy * RING_VERTICES + ix + 1
      const b = iy * RING_VERTICES + ix
      const c = (iy + 1) * RING_VERTICES + ix
      const d = (iy + 1) * RING_VERTICES + ix + 1
      if (iy !== 0) index.push(a, b, d) // the dome's top row is a single point
      index.push(b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(index)
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 4))
  computeNormals(geometry)
  weldSeam(geometry)
  // The wall inflates up to ~1.3x, so give raycasting/culling a sphere that always fits,
  // down to the opening.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.5, 0.3), 5)
  return { geometry, profile, neckZ }
}

export function createOrganRig() {
  const { geometry: bladderGeo, profile, neckZ } = createOrganGeometry()
  const bPos = bladderGeo.attributes.position
  const bColor = bladderGeo.attributes.color

  // The soft-body wall is the bladder's rows; the sphincter's rows below follow its neck.
  const count = BLADDER_VERTICES
  const wall = bPos.array
  const baseVertices = []
  for (let i = 0; i < count; i++) baseVertices.push(new THREE.Vector3(bPos.getX(i), bPos.getY(i), bPos.getZ(i)))
  const base = new Float32Array(wall.subarray(0, count * 3)) // rest shape
  const velocity = new Float64Array(count * 3)
  const dentMemory = new Float32Array(count)

  // The lining: the wall's shape with the rugae folded into it, closed off at the neck.
  // The urine is drawn with it.
  const liningGeo = bladderGeo.clone()
  liningGeo.boundingSphere = bladderGeo.boundingSphere.clone()
  const lining = liningGeo.attributes.position.array

  // Per-vertex constants of the deformation below, so a frame only does multiply-adds.
  const wrinkle = new Float64Array(count) // rugae fold pattern, scaled by rugae
  const slump = new Float64Array(count) // how much of the flaccid spread this vertex takes
  const pin = new Float64Array(count) // how much this vertex keeps the neck's width
  const forward = new Float64Array(count) // the neck's forward offset at this height
  const bundle = new Float64Array(count) // detrusor bundles, -0.5..0.5
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
    const sy = y / (2.35 * 1.12)
    // A slack bladder spreads around its middle as the dome sags onto it, fading out
    // smoothly toward the dome and the neck.
    slump[i] = 1.0 - THREE.MathUtils.smootherstep(Math.abs(sy), 0.15, 0.95)
    pin[i] = THREE.MathUtils.smoothstep(-sy, 0.72, 0.9)
    forward[i] = forwardOf(sy)
    const theta = ((i % RING_VERTICES) / RADIAL) * Math.PI * 2
    const yNorm = y / (2.35 * 1.12)
    // Two families of oblique bands that cross in a meshwork, like the detrusor's bundles.
    const b1 = Math.sin(theta * 5.0 + yNorm * 4.0)
    const b2 = Math.sin(theta * 5.0 - yNorm * 4.0)
    bundle[i] = (b1 * b1 + b2 * b2) / 2 - 0.5
    const sin2phi = Math.sin(Math.acos(Math.max(-1, Math.min(1, y / 2.35))) * 2.0)
    jiggleS3[i] = Math.sin(theta * 3.0) * sin2phi
    jiggleC3[i] = Math.cos(theta * 3.0) * sin2phi
    jiggleC2[i] = Math.cos(theta * 2.0)
    jiggleS2[i] = Math.sin(theta * 2.0)
    const tp = x * 3.1 + y * 2.3 + z * 4.7
    tremor.set([Math.cos(tp), Math.sin(tp), Math.cos(tp * 1.3), Math.sin(tp * 1.3), Math.cos(tp * 0.7), Math.sin(tp * 0.7)], i * 6)
  }

  // The sphincter's rows: r, y, x and z of the direction out, fold pattern, sin 4θ, cos 4θ,
  // ring weight, urethra weight per vertex.
  const sCount = NECK_ROWS * RING_VERTICES
  const sphincterBase = new Float64Array(sCount * 9)
  for (let j = 0; j < sCount; j++) {
    const { x: r, y } = profile[Math.floor(j / RING_VERTICES)]
    const theta = ((j % RING_VERTICES) / RADIAL) * Math.PI * 2
    sphincterBase.set([
      r, y, -Math.cos(theta), Math.sin(theta), Math.sin(theta * SPHINCTER_FOLDS),
      Math.sin(theta * 4.0), Math.cos(theta * 4.0), ringWeight(y), urethraWeight(y),
    ], j * 9)
  }
  let clenchLevel = 0 // eases in and out rather than snapping
  let contraction = 0 // detrusor, 0..1
  let squeezePhase = 0
  let wallAlpha = -1

  const stream = createStream()
  const outlet = new THREE.Vector3()
  const neck = new THREE.Vector3()
  const cutCenter = new THREE.Vector3()

  const ureters = [createUreter(-1, baseVertices), createUreter(1, baseVertices)]

  const cutawayPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)

  const scratch = new THREE.Vector3()
  const wallPoint = new THREE.Vector3()
  const wallNormal = new THREE.Vector3()

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
    const { wallMat, urine, leftDrop, rightDrop, camera, cutaway } = objects
    const phys = physicsOf(sim)

    const fillRatio = Math.max(0.01, sim.volume / sim.maxCapacity)
    const compY = sim.squeezeAmountY || 0
    const scaleY = 1.0 - compY
    const inflationScale = inflationOf(fillRatio)

    // The cut runs down through the neck, so it halves the sphincter and the urethra too.
    if (cutaway && camera) orientCutaway(cutawayPlane, camera.position, cutCenter.set(0, ORGAN_CENTER.y, neckZ * inflationScale))

    // The detrusor contracts in an urge wave (involuntarily) and while voiding.
    const voiding = sim.isActivelyVoiding || sim.involuntaryVoiding
    contraction += ((voiding ? 1 : Math.min(1, sim.detrusorSpasmIntensity)) - contraction) * Math.min(1, dt * 4)
    squeezePhase = contraction > 0.01 ? (squeezePhase + dt / SQUEEZE_SECONDS) % 1 : 0

    // A stretched wall is thinner, so more of the liquid shows through; a contracting
    // one thickens and flushes.
    const stretch = Math.min(1.0, fillRatio)
    if (wallMat) {
      // Strained muscle throbs, as in the original.
      const strainPulse = sim.sphincterToneStrain > 0.3 ? Math.sin(timeSec * 15.0) * 0.35 + 0.35 : 0
      wallMat.emissiveIntensity = 0.18 + stretch * 0.3 + strainPulse + contraction * 0.3
      wallMat.roughness = THREE.MathUtils.lerp(0.38, 0.12, stretch)
    }
    const alpha = THREE.MathUtils.lerp(0.66, 0.36, stretch) + contraction * 0.18
    if (Math.abs(alpha - wallAlpha) > 0.004) {
      wallAlpha = alpha
      for (let i = 0; i < count; i++) bColor.array[i * 4 + 3] = alpha
      bColor.needsUpdate = true
    }
    // Urine colour follows hydration, in the bladder and in the stream.
    const h = sim.hydration
    if (objects.fluidMat) objects.fluidMat.color.setRGB(1.0, 0.72 + h * 0.22, 0.1 + h * 0.6)
    stream.setHydration(h)

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
    const rugae = Math.pow(1.0 - Math.min(1.0, fillRatio), 1.6) * RUGAE_DEPTH
    // A contracting bladder is taut: it stops sagging and slumping.
    const relaxed = 1.0 - contraction
    const sagFactor = Math.max(0, (1.0 - fillRatio * 2.2)) * 0.45 * relaxed
    const tremorAmp = (sim.sphincterToneStrain > 0.3) ? (sim.sphincterToneStrain * 0.045) : 0.0
    const tremorHalf = tremorAmp * 0.5
    const s41 = Math.sin(timeSec * 41.0), c41 = Math.cos(timeSec * 41.0)
    const s37 = Math.sin(timeSec * 37.0), c37 = Math.cos(timeSec * 37.0)
    const s43 = Math.sin(timeSec * 43.0), c43 = Math.cos(timeSec * 43.0)
    const sloshX = Math.sin(sim.sloshAngleX) * 0.22
    const sloshZ = Math.sin(sim.sloshAngleZ) * 0.22
    const coreX = sim.fluidCoreOffset.x * 0.35
    const coreZ = sim.fluidCoreOffset.z * 0.35
    const slackSpread = (1.0 - fillRatio) * 0.2 * relaxed
    const ripples = sim.ripples
    const springDt = phys.springK * dt
    const damping = phys.damping
    const tighten = 1.0 - CONTRACT_TIGHTEN * contraction
    const squeezeAt = 1.3 - 2.6 * squeezePhase // the squeeze's height, dome to neck
    const squeezeDepth = CONTRACT_SQUEEZE * contraction
    const bundles = CONTRACT_BUNDLES * contraction

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

      let contract = 1.0
      if (contraction > 0.001) {
        const band = (yNorm / 1.12 - squeezeAt) / 0.35
        contract = tighten - squeezeDepth * Math.exp(-band * band) + bundles * bundle[i]
      }

      const sagY = by > 0 ? -sagFactor * yNorm : 0
      const flaccidSpread = 1.0 + slackSpread * slump[i]
      const totalRadMod = Math.max(0.2, (1.0 + jiggleWobble + rippleDisp - dentMemory[i])) * balloonBulge * contract

      // Width around the neck's axis, which leans forward with the inflating bladder.
      const width = THREE.MathUtils.lerp(flaccidSpread * bulgeXZ * inflationScale, NECK_WIDTH, pin[i])
      const ahead = forward[i]
      const tx = (bx * width + sloshPushX + tremorX) * totalRadMod
      const ty = ((by * scaleY + sagY) * inflationScale + tremorY) * totalRadMod
      const tz = ((bz - ahead) * width + ahead * inflationScale + sloshPushZ + tremorZ) * totalRadMod

      const cx = wall[o], cy = wall[o + 1], cz = wall[o + 2]
      const vx = (velocity[o] + (tx - cx) * springDt) * damping
      const vy = (velocity[o + 1] + (ty - cy) * springDt) * damping
      const vz = (velocity[o + 2] + (tz - cz) * springDt) * damping
      velocity[o] = vx; velocity[o + 1] = vy; velocity[o + 2] = vz
      wall[o] = cx + vx * dt
      wall[o + 1] = cy + vy * dt
      wall[o + 2] = cz + vz * dt
      // Rugae folds, broad enough for the mesh to show smoothly.
      const fold = 1.0 + wrinkle[i] * rugae
      lining[o] = wall[o] * fold
      lining[o + 1] = wall[o + 1] * fold
      lining[o + 2] = wall[o + 2] * fold
    }

    // The neck: the centre of the bladder's last ring, wherever the wall has carried it.
    neck.set(0, 0, 0)
    for (let i = count - RING_VERTICES; i < count - 1; i++) neck.add(scratch.fromArray(wall, i * 3))
    neck.divideScalar(RADIAL)
    const neckTop = neck.y - NECK_GAP

    // Sphincter: a clench clamps the ring and deepens its folds, voiding opens it all
    // up, and strain makes it twitch (the rippling shake of the original's tube).
    const dil = sim.isStressLeaking ? 0.35 : sim.sphincterDilation
    const twitchOsc = Math.sin(timeSec * 38.0) * Math.cos(timeSec * 23.0)
    const twitch = sim.sphincterToneStrain * 0.08 * twitchOsc
    const s30 = Math.sin(timeSec * 30.0), c30 = Math.cos(timeSec * 30.0)
    clenchLevel += ((sim.isClenching ? 1 : 0) - clenchLevel) * Math.min(1, dt * 14)
    const foldDepth = (0.02 + 0.03 * clenchLevel) * (1.0 - dil)
    for (let j = 0; j < sCount; j++) {
      const k = j * 9
      const r = sphincterBase[k], y = sphincterBase[k + 1]
      const ring = sphincterBase[k + 7], urethra = sphincterBase[k + 8]
      const ripple = sphincterBase[k + 5] * c30 + sphincterBase[k + 6] * s30 // sin(4θ + 30t)
      const squeeze = 1.0 - clenchLevel * (0.1 + 0.12 * ring + 0.3 * urethra)
      const closed = (r + sphincterBase[k + 4] * foldDepth * ring + ripple * twitch) * squeeze
      const open = r * (1.0 + 0.25 * ring + 0.45 * urethra) // a narrow opening, not a nozzle
      const radius = THREE.MathUtils.lerp(closed, open, dil)
      const o = (count + j) * 3
      wall[o] = neck.x + sphincterBase[k + 2] * radius
      wall[o + 1] = neckTop + y - NECK_TOP_Y
      wall[o + 2] = neck.z + sphincterBase[k + 3] * radius
      // The urine stops at the neck.
      lining[o] = neck.x; lining[o + 1] = neck.y; lining[o + 2] = neck.z
    }
    bPos.needsUpdate = true
    computeNormals(bladderGeo)
    weldSeam(bladderGeo)
    liningGeo.attributes.position.needsUpdate = true
    computeNormals(liningGeo)
    weldSeam(liningGeo)

    // Urine: the lining's shape scaled about a point low in the sac, free to slosh within
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
      wallNormal.fromBufferAttribute(bladderGeo.attributes.normal, ureter.endIndex)
      updateUreter(ureter, wallPoint, wallNormal)
    }

    // Stream from the opening at the bottom of the urethra.
    stream.update(sim, dt, timeSec, outlet.set(neck.x, neckTop + OUTLET_Y - NECK_TOP_Y, neck.z), objects.stream, objects.drops)

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
    bladderGeo, liningGeo, stream,
    ureterGeoLeft: ureters[0].geo, ureterGeoRight: ureters[1].geo,
    cutawayPlane, poke, slap, clearDents, update,
  }
}
