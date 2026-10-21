import * as THREE from 'three'
import { computeNormals } from './normals'

// The organ's shape at rest: one surface from the bladder's dome down through the
// sphincter and urethra, how big it is at a fill, and where the cutaway cuts it.
// organRig.js deforms it every frame.

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

// Urine: Organ.jsx draws the lining's geometry, scaled to the volume held (see
// urineScale). Full, it fills the sac just inside the membrane.
export const FLUID_INSET = 0.965
// What's left after voiding: the bladder counts as empty at or below this.
export const RESIDUAL_ML = 10

// The wall's scale at a fill: 0.55 empty, 1.3 full, and growing on past full.
export const inflationOf = (fillRatio) => 0.55 + Math.pow(fillRatio, 0.45) * 0.75

// The arcade's bladder has no limit, and neither has its size. Past the most the sandbox's
// holds (125 %) it outgrows the camera's frame, so the camera backs off by this much
// (StageFit), while the sphincter, the urethra and the ureter tubes keep their size beside it.
export const SANDBOX_MOST = 1.25
export const INFLATION_SANDBOX_MOST = inflationOf(SANDBOX_MOST)
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
export const RADIAL = 64
export const RING_VERTICES = RADIAL + 1
const SPHERE_ROWS = 48
const BLADDER_ROWS = 41 // the neck opens 26° up from the bottom of the sphere
export const BLADDER_VERTICES = (BLADDER_ROWS + 1) * RING_VERTICES
export const NECK_ROW = BLADDER_ROWS + 1 // the first row of the sphincter
export const NECK_ROWS = 18
// The neck sits forward (anterior, +z) with the bladder's base bulging behind it, as in
// the body, rather than hanging from the middle.
const NECK_FORWARD = 0.5
export const NECK_GAP = 0.12 // from the bladder's last ring down to the top of the profile
// The neck doesn't stretch with the dome (the pelvic floor holds it): the lowest rows keep
// about their resting width, so the bladder funnels into the sphincter at any fill.
export const NECK_WIDTH = 0.9
export const forwardOf = (sy) => NECK_FORWARD * THREE.MathUtils.smoothstep(-sy, 0.1, 1)

// The sphincter's profile, (radius, height) from the bottom up: a lip around the single
// small opening, the urethra up from it, then the thick muscular ring at the bladder neck.
export const OUTLET_Y = -0.62
export const NECK_TOP_Y = 0.19
const SPHINCTER_PROFILE = [
  [0.075, OUTLET_Y], [0.1, -0.6], [0.11, -0.48], [0.125, -0.34], [0.15, -0.25],
  [0.26, -0.17], [0.38, -0.09], [0.43, 0.01], [0.42, 0.1], [0.35, NECK_TOP_Y],
]
// Puckered folds around the ring, like a drawstring.
export const SPHINCTER_FOLDS = 14
const WALL_COLOR = 0xf43f5e
const SPHINCTER_COLORS = { neck: 0xe11d48, ring: 0xa30f33, urethra: 0xfb7185 }

// How much a height on the profile belongs to the muscle ring, or to the urethra (0..1).
export const ringWeight = (y) => THREE.MathUtils.smoothstep(y, -0.27, -0.15) * (1 - THREE.MathUtils.smoothstep(y, 0.16, 0.28))
export const urethraWeight = (y) => 1 - THREE.MathUtils.smoothstep(y, -0.3, -0.18)

export const BOUNDS_RADIUS = 5

// Each ring's first and last vertex are the same point (two for the UVs), and so are all
// of the dome's top row. Each copy gets its normal from its own triangles only, which
// shows as a crease down the side and a star on top; they share the average instead.
export function weldSeam(geometry) {
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
export function createOrganGeometry() {
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
