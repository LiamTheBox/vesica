import * as THREE from 'three'
import { physicsOf } from '../../sim/sim'
import { computeNormals } from './normals'
import { createStream } from './stream'
import { createUreter } from './ureter'

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

// How the wall feels with fill, from slack to full: slack it's soft (deep dents, slow
// springs, a floppy wobble, ripples that die out), full it's taut (shallow dents that
// spring back fast, a tight wobble, ripples that carry).
const FEEL = {
  dent: [1.4, 0.55], // times the impact profiles' push and dent (never deeper than their cap)
  spring: [0.7, 1.5], // times the physics preset's spring
  wobble: [1.3, 0.7], // times the jiggle
  ripple: [0.7, 1.35], // times the ripples' height
}
const feel = (key, fill) => THREE.MathUtils.lerp(FEEL[key][0], FEEL[key][1], Math.min(1, fill))

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

// The arcade's bladder has no limit, and neither has its size. Past the most the sandbox's
// holds (125 %) it outgrows the camera's frame, so the camera backs off by this much
// (StageFit), while the sphincter, the urethra and the ureter tubes keep their size beside it.
const SANDBOX_MOST = 1.25
const INFLATION_SANDBOX_MOST = inflationOf(SANDBOX_MOST)
export const overfillGrowth = (fillRatio) => Math.max(1, inflationOf(fillRatio) / INFLATION_SANDBOX_MOST)

// Linear size of the urine relative to the wall. The urine's volume is the simulation's;
// the wall's size is a visual function of fill that never drops below about half, so
// whatever the urine doesn't fill is muscle wall: thick when empty, the thin membrane
// (FLUID_INSET) when stretched full. A bladder holds no air.
export function urineScale(volume, maxCapacity) {
  const urine = Math.max(0, (volume - RESIDUAL_ML) / (maxCapacity - RESIDUAL_ML))
  if (urine === 0) return 0
  if (volume >= maxCapacity) return FLUID_INSET // full or more: it fills the sac
  const wallGrowth = inflationOf(1) / inflationOf(Math.max(0.01, volume / maxCapacity))
  return Math.min(FLUID_INSET, FLUID_INSET * wallGrowth * Math.cbrt(urine))
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

// A slack bladder folds like a deflated balloon: soft pleats gathered toward the neck, like
// a balloon's toward its knot, and a few broad crumples. They pull out as it fills, and
// as it contracts.
const PLEATS = 7
const PLEAT_DEPTH = 0.12
const CRUMPLE_DEPTH = 0.08

// A squirt from a ureter kicks the wall out where it comes in (the springs make the gulp),
// and sends a ripple across the urine from there.
const SQUIRT = { radius: 1.1, kick: 0.9 }
const INFLOW_SECONDS = 1.6
const INFLOW_RIPPLE = 0.04
const RIPPLE_SPEED = 2.4

// Body language. It breathes, by mood: breaths a second, and how deep as a share of its
// size (slow and deep asleep, quick and shallow in a panic).
const BREATH = {
  sleepy: [0.16, 0.02], calm: [0.25, 0.012], uneasy: [0.35, 0.01], desperate: [0.55, 0.008], panic: [0.9, 0.006],
  relieved: [0.2, 0.018], embarrassed: [0.4, 0.008], annoyed: [0.45, 0.012], proud: [0.3, 0.014],
}
const STILL = [0, 0]
// And it moves when something happens (emote): a happy bounce stretches it up from the neck
// and back (a spring: rad/s, damping ratio, kick); a sigh or a huff swells it all round and
// lets it settle; a shudder shakes it; when the clench gives out it droops, and it slumps a
// little when sleepy. A blush and a flash colour the wall's glow. These move the whole organ
// (objects.body), about the neck: through the wall's springs, which lag ~0.7 s behind their
// targets, anything quicker than a breath would be smoothed away.
const HOP = { omega: 13, damping: 0.25, kick: 1.0 }
const PUFF = { omega: 5, damping: 0.5, sigh: 0.22, huff: 0.35, creak: 0.12 }
const SHUDDER = { amp: 0.06, seconds: 0.8 }
const NERVOUS_SHAKE = 0.015 // while a warned urge or sneeze is on its way
const DROOP = { height: 0.06, seconds: 2.5, sleepy: 0.35 }
export const WALL_EMISSIVE = new THREE.Color(0x881337)
const BLUSH_COLOR = new THREE.Color(0xff2d75)

const EMOTE_FOR = {
  leakStart: 'shudder', failureStart: 'shudder', clenchExhausted: 'droop', creak: 'creak',
  leakSaved: 'hop', arcadeLevel: 'hop', microWin: 'hop', leakEnd: 'sigh', voidStop: 'sigh', soothe: 'sigh',
}
// What the bladder does when `event` happens, feeling `mood` (feedback/mood.js), if anything.
export function emoteFor(event, mood) {
  if (event.type === 'urgeEnd') return event.suppressed ? 'sigh' : null
  if (event.type === 'arcadePoints') return event.reason === 'perfect' || event.reason === 'braced' ? 'hop' : null
  if ((event.type === 'poke' && event.touch) || event.type === 'slap') return mood === 'annoyed' ? 'huff' : null
  return EMOTE_FOR[event.type] ?? null
}

const BOUNDS_RADIUS = 5

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
  // The wall inflates up to ~1.4x in the sandbox, so give raycasting/culling a sphere that
  // always fits, down to the opening; it grows with an overfilled bladder (update).
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.5, 0.3), BOUNDS_RADIUS)
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
  const balloon = new Float64Array(count) // deflated-balloon folds: radius change when fully slack
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
    // Two families of oblique bands that cross in a meshwork, like the detrusor's bundles.
    const b1 = Math.sin(theta * 5.0 + sy * 4.0)
    const b2 = Math.sin(theta * 5.0 - sy * 4.0)
    bundle[i] = (b1 * b1 + b2 * b2) / 2 - 0.5
    // Pleats: sharp creases between soft ridges, wavering a little on their way up from
    // the neck and fading out near the top of the dome; then the crumples.
    const u = theta * PLEATS + 0.7 * Math.sin(sy * 3.0 + theta * 2.0)
    const pleat = (2 * Math.abs(Math.sin(u / 2)) - 1) * (1 - THREE.MathUtils.smoothstep(sy, 0.25, 1.0)) * (1 - 0.7 * pin[i])
    const crumple = Math.sin(x * 1.3 + y * 1.9 + 0.7) * Math.sin(z * 1.7 - y * 1.1 + 2.1) + 0.6 * Math.sin(x * 2.3 - z * 1.7 + y * 1.3 + 0.4)
    balloon[i] = PLEAT_DEPTH * pleat + CRUMPLE_DEPTH * crumple / 1.6
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
  // Body language: breathing, the bounce and swell springs, and fading effects.
  let breathPhase = 0, breathRate = 0, breathDepth = 0
  let hop = 0, hopV = 0
  let puff = 0, puffV = 0
  let shudder = 0, droop = 0, flash = 0, blush = 0, nervous = 0
  let lastFill = 0.16 // for impacts, which come between frames
  const bodyScale = new THREE.Vector3(1, 1, 1)
  const bodyOffset = new THREE.Vector3()

  const stream = createStream()
  const outlet = new THREE.Vector3()
  const neck = new THREE.Vector3()
  const cutCenter = new THREE.Vector3()

  const ureters = [createUreter(-1, baseVertices), createUreter(1, baseVertices)]
  // Each vertex's rest distance from each ureter's opening, and the time since its last squirt.
  const fromOpening = ureters.map(({ endIndex }) => Float64Array.from(baseVertices, (v) => v.distanceTo(baseVertices[endIndex])))
  const inflowAge = [Infinity, Infinity]
  const rippleAt = new Float64Array(2)
  const rippleHeight = new Float64Array(2)

  const cutawayPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)

  const scratch = new THREE.Vector3()
  const wallPoint = new THREE.Vector3()
  const wallNormal = new THREE.Vector3()

  // Pushes vertices near `local` inward and leaves a slowly recovering dent: deeper the
  // slacker the wall.
  function impact(local, strength, profile) {
    const give = feel('dent', lastFill)
    for (let i = 0; i < count; i++) {
      const vx = wall[i * 3], vy = wall[i * 3 + 1], vz = wall[i * 3 + 2]
      const d = scratch.set(vx, vy, vz).distanceTo(local)
      if (d < profile.radius) {
        const power = (1.0 - d / profile.radius) * strength * profile.powerScale * give
        velocity[i * 3] -= (vx / 2.35) * power * profile.velScale
        velocity[i * 3 + 1] -= (vy / 2.35) * power * profile.velScale
        velocity[i * 3 + 2] -= (vz / 2.35) * power * profile.velScale
        dentMemory[i] = Math.min(profile.dentCap * Math.min(1, give), dentMemory[i] + power * profile.dentGain)
      }
    }
  }

  // Pushes the wall out around ureter k's opening.
  function squirt(k) {
    const near = fromOpening[k]
    for (let i = 0; i < count; i++) {
      if (near[i] >= SQUIRT.radius) continue
      const push = (1.0 - near[i] / SQUIRT.radius) * SQUIRT.kick / 2.35
      velocity[i * 3] += wall[i * 3] * push
      velocity[i * 3 + 1] += wall[i * 3 + 1] * push
      velocity[i * 3 + 2] += wall[i * 3 + 2] * push
    }
  }

  const poke = (local, strength) => impact(local, strength, POKE)
  const slap = (local, strength) => impact(local, strength, SLAP)
  const clearDents = () => dentMemory.fill(0)

  // Starts one of emoteFor's moves.
  function emote(kind) {
    if (kind === 'hop') {
      hopV += HOP.kick
      flash = Math.max(flash, 0.8)
    } else if (kind === 'sigh' || kind === 'huff') {
      puffV += PUFF[kind]
    } else if (kind === 'creak') {
      puffV += PUFF.creak
      flash = Math.max(flash, 0.6)
    } else if (kind === 'shudder') {
      shudder = 1
    } else if (kind === 'droop') {
      droop = 1
    }
  }

  // `objects`: live meshes/materials from Organ.jsx refs (`body`: the group the organ's body
  // language moves), the camera, how the bladder feels (`mood`, for its breathing, slump
  // and blush; without one it holds still), and what to call when a ureter squirts
  // (onSquirt(side), -1 left, 1 right).
  function update(sim, dt, timeSec, objects) {
    const { wallMat, urine, camera, cutaway } = objects
    const phys = physicsOf(sim)

    const fillRatio = Math.max(0.01, sim.volume / sim.maxCapacity)
    lastFill = fillRatio
    const compY = sim.squeezeAmountY || 0
    const scaleY = 1.0 - compY
    const inflationScale = inflationOf(fillRatio)
    // Overfilled past the sandbox's most (the arcade), the shape stays the same and grows.
    const shapeFill = Math.min(fillRatio, SANDBOX_MOST)
    const growth = Math.max(1, inflationScale / INFLATION_SANDBOX_MOST)
    bladderGeo.boundingSphere.radius = liningGeo.boundingSphere.radius = BOUNDS_RADIUS * growth

    // The cut runs down through the neck, so it halves the sphincter and the urethra too.
    if (cutaway && camera) orientCutaway(cutawayPlane, camera.position, cutCenter.set(0, ORGAN_CENTER.y, neckZ * inflationScale))

    // The detrusor contracts in an urge wave (involuntarily) and while voiding.
    const voiding = sim.isActivelyVoiding || sim.involuntaryVoiding
    contraction += ((voiding ? 1 : Math.min(1, sim.detrusorSpasmIntensity)) - contraction) * Math.min(1, dt * 4)
    squeezePhase = contraction > 0.01 ? (squeezePhase + dt / SQUEEZE_SECONDS) % 1 : 0

    // Body language: the springs and fading effects move on, breathing follows the mood.
    const mood = objects.mood
    const [rate, depth] = mood ? BREATH[mood] ?? BREATH.calm : STILL
    const ease = Math.min(1, dt * 1.5)
    breathRate += (rate - breathRate) * ease
    breathDepth += (depth - breathDepth) * ease
    breathPhase = (breathPhase + Math.PI * 2 * breathRate * dt) % (Math.PI * 2)
    hopV -= (HOP.omega * HOP.omega * hop + 2 * HOP.damping * HOP.omega * hopV) * dt
    hop += hopV * dt
    puffV -= (PUFF.omega * PUFF.omega * puff + 2 * PUFF.damping * PUFF.omega * puffV) * dt
    puff += puffV * dt
    shudder = Math.max(0, shudder - dt / SHUDDER.seconds)
    droop = Math.max(0, droop - dt / DROOP.seconds)
    flash = Math.max(0, flash - dt * 2.5)
    blush += ((mood === 'embarrassed' ? 1 : 0) - blush) * Math.min(1, dt * 2)
    nervous += ((sim.urgeWarned || sim.coughWarned ? 1 : 0) - nervous) * Math.min(1, dt * 8)

    // A stretched wall is thinner, so more of the liquid shows through; a contracting
    // one thickens and flushes.
    const stretch = Math.min(1.0, fillRatio)
    if (wallMat) {
      // Strained muscle throbs, as in the original.
      const strainPulse = sim.sphincterToneStrain > 0.3 ? Math.sin(timeSec * 15.0) * 0.35 + 0.35 : 0
      wallMat.emissiveIntensity = 0.18 + stretch * 0.3 + strainPulse + contraction * 0.3 + flash * 0.6 + blush * 0.35
      wallMat.emissive.copy(WALL_EMISSIVE).lerp(BLUSH_COLOR, blush)
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
    const wobble = sim.jiggleIntensity * feel('wobble', fillRatio)
    const jiggle1 = Math.sin(phase) * wobble * 0.18
    const jiggle2 = Math.cos(phase * 1.5) * wobble * 0.12
    // sin(3θ + phase)·sin 2φ·j1 + cos(2θ − 1.2 phase)·j2, expanded with the angle-sum identities
    const jA = Math.cos(phase) * jiggle1
    const jB = Math.sin(phase) * jiggle1
    const jC = Math.cos(phase * 1.2) * jiggle2
    const jD = Math.sin(phase * 1.2) * jiggle2
    const bulgeXZ = Math.sqrt(1.0 / Math.max(0.2, (1.0 - compY * (0.45 + shapeFill * 0.45))))
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
    const slackSpread = (1.0 - shapeFill) * 0.2 * relaxed
    const ripples = sim.ripples
    const springDt = phys.springK * feel('spring', fillRatio) * dt
    const rippleGain = feel('ripple', fillRatio)
    const damping = phys.damping
    const tighten = 1.0 - CONTRACT_TIGHTEN * contraction
    const squeezeAt = 1.3 - 2.6 * squeezePhase // the squeeze's height, dome to neck
    const squeezeDepth = CONTRACT_SQUEEZE * contraction
    const bundles = CONTRACT_BUNDLES * contraction
    const deflated = Math.pow(1.0 - Math.min(1.0, fillRatio), 1.4) * relaxed
    // Squirts arriving: the ripple's reach and height from each opening.
    let inflow = false
    rippleHeight.fill(0)
    for (let k = 0; k < 2; k++) {
      inflowAge[k] += dt
      if (inflowAge[k] >= INFLOW_SECONDS) continue
      inflow = true
      rippleAt[k] = RIPPLE_SPEED * inflowAge[k]
      rippleHeight[k] = INFLOW_RIPPLE * Math.exp(-2.2 * inflowAge[k])
    }

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
        if (waveDist < 0.65) rippleDisp += Math.cos((waveDist / 0.65) * (Math.PI / 2)) * rip.amplitude * rippleGain
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
      let ripple = 0
      if (inflow) {
        for (let k = 0; k < 2; k++) {
          const w = (fromOpening[k][i] - rippleAt[k]) / 0.35
          ripple += rippleHeight[k] * Math.exp(-w * w)
        }
      }

      const totalRadMod = Math.max(0.2, (1.0 + jiggleWobble + rippleDisp - dentMemory[i] + deflated * balloon[i])) * balloonBulge * contract

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
      const fold = 1.0 + wrinkle[i] * rugae + ripple
      lining[o] = wall[o] * fold
      lining[o + 1] = wall[o + 1] * fold
      lining[o + 2] = wall[o + 2] * fold
    }

    // The neck: the centre of the bladder's last ring, wherever the wall has carried it.
    neck.set(0, 0, 0)
    for (let i = count - RING_VERTICES; i < count - 1; i++) neck.add(scratch.fromArray(wall, i * 3))
    neck.divideScalar(RADIAL)
    const neckTop = neck.y - NECK_GAP

    // Body language: breathing and swelling, a bounce up or a droop down, about the neck,
    // which stays put; and a shake.
    const swell = 1 + breathDepth * Math.sin(breathPhase) + puff
    const sag = Math.max(droop, mood === 'sleepy' ? DROOP.sleepy : 0) * DROOP.height
    bodyScale.set(swell * (1 - 0.5 * hop + 0.5 * sag), swell * (1 + hop - sag), swell * (1 - 0.5 * hop + 0.5 * sag))
    const shake = SHUDDER.amp * shudder + NERVOUS_SHAKE * nervous
    bodyOffset.set(
      neck.x * (1 - bodyScale.x) + shake * Math.sin(timeSec * 47.0),
      neck.y * (1 - bodyScale.y) + shake * 0.5 * Math.sin(timeSec * 53.0 + 1.0),
      neck.z * (1 - bodyScale.z) + shake * Math.sin(timeSec * 41.0 + 2.0),
    )
    if (objects.body) {
      objects.body.scale.copy(bodyScale)
      objects.body.position.copy(bodyOffset)
    }

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

    // Ureters stay plugged into the wall as it inflates and wobbles, and squeeze urine
    // down: faster while drinks are being filtered. Each squirt is heard from its side.
    let filtration = 0
    for (const b of sim.activeBeverages) filtration += b.rate
    ureters.forEach((ureter, k) => {
      wallPoint.fromBufferAttribute(bPos, ureter.endIndex)
      wallNormal.fromBufferAttribute(bladderGeo.attributes.normal, ureter.endIndex)
      ureter.route(wallPoint, wallNormal, growth)
      if (ureter.step(dt, filtration) > 0) {
        inflowAge[k] = 0
        squirt(k)
        objects.onSquirt?.(k === 0 ? -1 : 1)
      }
    })

    // Stream from the opening at the bottom of the urethra, wherever the body has moved it.
    outlet.set(neck.x, neckTop + OUTLET_Y - NECK_TOP_Y, neck.z).multiply(bodyScale).add(bodyOffset)
    stream.update(sim, dt, timeSec, outlet, objects.stream, objects.drops)
  }

  return {
    bladderGeo, liningGeo, stream,
    ureterGeoLeft: ureters[0].geo, ureterGeoRight: ureters[1].geo,
    cutawayPlane, poke, slap, clearDents, emote, update,
  }
}
