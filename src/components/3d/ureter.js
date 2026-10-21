import * as THREE from 'three'

// A ureter: the tube from the kidney, down behind the bladder, into the low back of its
// wall (the upper corners of the trigone). At the wall it flares into a bell pressed flat
// against it, its rim tucked just under the surface, so it grows out of the wall instead
// of poking into it. Urine comes down it in boluses, each pushed along by a squeeze of the
// tube (peristalsis); `step` reports when one squirts into the bladder.

const SEGMENTS = 64
const RADIAL = 10
export const URETER_RING = RADIAL + 1
const RADIUS = 0.1
// The bell: its last rings, closely spaced over its own short length at the wall end.
export const FLARE_RINGS = 10
const FLARE_LENGTH = 0.32
const FLARE_WIDTH = 2.2 // the rim, relative to the tube
// How far the rim sits under the wall's surface: less than the full bladder's membrane, so
// it never shows through into the urine.
export const URETER_SINK = 0.02
// Like a real ureter, the tube comes down along the wall and slips into it at a shallow
// angle (the lead-in's angle off the wall's surface), rather than stabbing in square.
const ENTRY = THREE.MathUtils.degToRad(25)
// Ring orientation reference: the ureters run roughly in the x–y plane, never along z.
const REF = new THREE.Vector3(0, 0, 1)
const UP = new THREE.Vector3(0, 1, 0)
// Arc-length table resolution, so rings and boluses are spaced evenly along the tube.
const ARC_SAMPLES = 96

// Pale tan like a real ureter, blending toward the wall at the rim; urine shows amber.
const COLOR = new THREE.Color(0xe6d2a0)
const RIM_COLOR = new THREE.Color(0xc0485a) // close to the wall's rose
const URINE_COLOR = new THREE.Color(0xe9a92a)

// Peristalsis: a bolus swells the tube, with a squeeze close behind it that pushes it on.
export const BOLUS_SPEED = 0.4 // tube lengths per second
const BOLUS_WIDTH = 0.035
const BOLUS_SWELL = 0.55
const SQUEEZE = 0.3
const SQUEEZE_BEHIND = 0.07
// Seconds between boluses: a few a minute at rest, faster while drinks are filtered.
export const REST_INTERVAL = 9
const intervalFor = (filtration) => (filtration > 0 ? THREE.MathUtils.clamp(24 / filtration, 1, REST_INTERVAL) : REST_INTERVAL)

const arcPoint = new THREE.Vector3()
const arcPrev = new THREE.Vector3()
const ahead = new THREE.Vector3()
const behind = new THREE.Vector3()
const tangent = new THREE.Vector3()
const ringN = new THREE.Vector3()
const ringB = new THREE.Vector3()
const entry = new THREE.Vector3()
const color = new THREE.Color()

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

// `side` -1 is the left, 1 the right; `wallVertices` the bladder's rest shape, to find
// where it enters.
export function createUreter(side, wallVertices) {
  const dir = new THREE.Vector3(0.5 * side, -0.4, -0.75).normalize()
  let endIndex = 0
  let best = -Infinity
  const n = new THREE.Vector3()
  wallVertices.forEach((v, i) => {
    const d = n.copy(v).normalize().dot(dir)
    if (d > best) { best = d; endIndex = i }
  })

  // From behind and above, past a bend behind the bladder and a short lead-in, to the wall.
  const start = new THREE.Vector3(3.0 * side, 4.4, -2.0)
  const curve = new THREE.CatmullRomCurve3([start.clone(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
  const rings = SEGMENTS + 1
  // Only the topology (index, uvs) is kept; the vertices are written by shape().
  const geo = new THREE.TubeGeometry(curve, SEGMENTS, RADIUS, RADIAL, false)
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rings * URETER_RING * 3), 3))
  const bounds = new THREE.Sphere(new THREE.Vector3(0, 1, -1), 6.5)
  geo.boundingSphere = bounds.clone()

  const arc = new Float64Array(ARC_SAMPLES + 1)
  const along = new Float64Array(rings) // each ring's arc-length fraction
  const frames = new Float64Array(rings * 9) // centre, N, B per ring
  const wallPoint = new THREE.Vector3()
  const wallNormal = new THREE.Vector3()
  const lastEnd = new THREE.Vector3(Infinity, 0, 0)
  let lastReach = 1
  const boluses = [] // arc-length fractions, 0 at the kidney end
  let timer = side < 0 ? 2 : 6.5 // the two sides take turns
  let dirty = true

  // The bend and the end of the tube for a wall point and its normal; then each ring's
  // place and frame along it. `reach` moves the start out with an overfilled bladder (the
  // arcade's grows without limit), so it never swallows the tube; the tube keeps its width.
  function route(point, normal, reach = 1) {
    if (lastEnd.distanceToSquared(point) < 0.0004 && reach === lastReach) return
    lastEnd.copy(point)
    lastReach = reach
    wallPoint.copy(point)
    wallNormal.copy(normal)
    const [first, bend, leadIn, end] = curve.points
    first.copy(start).multiplyScalar(reach)
    geo.boundingSphere.center.copy(bounds.center).multiplyScalar(reach)
    geo.boundingSphere.radius = bounds.radius * reach
    end.copy(point).addScaledVector(normal, -URETER_SINK)
    entry.copy(UP).addScaledVector(normal, -normal.y).normalize() // up, along the wall
    entry.multiplyScalar(Math.cos(ENTRY)).addScaledVector(normal, Math.sin(ENTRY))
    leadIn.copy(end).addScaledVector(entry, 0.5)
    // The bend is behind and well above the opening, so the tube comes down onto the
    // wall instead of dipping below it and hooking back up.
    bend.copy(end).addScaledVector(normal, 1.1)
    bend.y += 1.5

    curve.getPoint(0, arcPrev)
    arc[0] = 0
    for (let k = 1; k <= ARC_SAMPLES; k++) {
      curve.getPoint(k / ARC_SAMPLES, arcPoint)
      arc[k] = arc[k - 1] + arcPoint.distanceTo(arcPrev)
      arcPrev.copy(arcPoint)
    }
    const flareStart = Math.max(0.5, 1 - FLARE_LENGTH / arc[ARC_SAMPLES])
    const body = SEGMENTS - FLARE_RINGS
    for (let i = 0; i < rings; i++) {
      along[i] = i <= body ? flareStart * (i / body) : flareStart + (1 - flareStart) * ((i - body) / FLARE_RINGS)
      const t = curveT(arc, along[i])
      curve.getPoint(t, arcPoint)
      curve.getPoint(Math.min(1, t + 0.001), ahead)
      curve.getPoint(Math.max(0, t - 0.001), behind)
      tangent.subVectors(ahead, behind).normalize()
      const o = i * 9
      arcPoint.toArray(frames, o)
      ringN.crossVectors(tangent, REF).normalize().toArray(frames, o + 3)
      ringB.crossVectors(tangent, ringN).toArray(frames, o + 6)
    }
    dirty = true
  }

  // Writes the tube from its frames: swollen where a bolus is, squeezed behind it, and
  // flared and pressed onto the wall at the end.
  function shape() {
    const pos = geo.attributes.position.array
    const nrm = geo.attributes.normal.array
    const col = geo.attributes.color.array
    let o = 0
    for (let i = 0; i < rings; i++) {
      const s = along[i]
      let swell = 1
      let urine = 0
      for (const b of boluses) {
        const d = (s - b) / BOLUS_WIDTH
        const q = (s - b + SQUEEZE_BEHIND) / BOLUS_WIDTH
        const g = Math.exp(-d * d)
        swell += BOLUS_SWELL * g - SQUEEZE * Math.exp(-q * q)
        urine = Math.max(urine, g)
      }
      const f = Math.max(0, (i - (SEGMENTS - FLARE_RINGS)) / FLARE_RINGS)
      const flare = f * f * (3 - 2 * f)
      const radius = RADIUS * swell * (1 + (FLARE_WIDTH - 1) * flare * flare)
      color.copy(COLOR).lerp(RIM_COLOR, flare).lerp(URINE_COLOR, urine * 0.85)
      const k = i * 9
      for (let j = 0; j <= RADIAL; j++) {
        const v = (j / RADIAL) * Math.PI * 2
        const sin = Math.sin(v)
        const cos = -Math.cos(v)
        let nx = cos * frames[k + 3] + sin * frames[k + 6]
        let ny = cos * frames[k + 4] + sin * frames[k + 7]
        let nz = cos * frames[k + 5] + sin * frames[k + 8]
        let px = frames[k] + radius * nx
        let py = frames[k + 1] + radius * ny
        let pz = frames[k + 2] + radius * nz
        if (flare > 0) {
          // Pressed onto the plane just under the wall early on, so the translucent wall
          // covers most of the bell; facing out of the wall.
          const press = Math.sqrt(flare)
          const h = (px - wallPoint.x) * wallNormal.x + (py - wallPoint.y) * wallNormal.y + (pz - wallPoint.z) * wallNormal.z + URETER_SINK
          px -= wallNormal.x * h * press
          py -= wallNormal.y * h * press
          pz -= wallNormal.z * h * press
          nx += (wallNormal.x - nx) * flare
          ny += (wallNormal.y - ny) * flare
          nz += (wallNormal.z - nz) * flare
          const inv = 1 / (Math.hypot(nx, ny, nz) || 1)
          nx *= inv; ny *= inv; nz *= inv
        }
        pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz
        nrm[o] = nx; nrm[o + 1] = ny; nrm[o + 2] = nz
        col[o] = color.r; col[o + 1] = color.g; col[o + 2] = color.b
        o += 3
      }
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.normal.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  }

  // Moves the boluses on (and starts new ones) for `filtration` ml/s of drinks being
  // filtered; returns how many squirted into the bladder.
  function step(dt, filtration) {
    timer -= dt
    if (timer <= 0) {
      boluses.push(0)
      timer = intervalFor(filtration)
    }
    let arrived = 0
    for (let b = boluses.length - 1; b >= 0; b--) {
      const was = boluses[b]
      boluses[b] += BOLUS_SPEED * dt
      if (was < 1 && boluses[b] >= 1) arrived++
      // Gone once the squeeze behind it has reached the wall too.
      if (boluses[b] >= 1 + SQUEEZE_BEHIND + 2 * BOLUS_WIDTH) boluses.splice(b, 1)
    }
    if (boluses.length > 0 || arrived > 0) dirty = true
    if (dirty) shape()
    dirty = false
    return arrived
  }

  return { geo, endIndex, boluses, route, step }
}
