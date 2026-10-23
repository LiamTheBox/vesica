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

// Urine: Organ.jsx draws the wall's shape, scaled to the volume held (see urineScale).
// Full, it fills the sac just inside the membrane.
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

// The bladder's outline, measured from the front and side renders of the realistic model
// (requested): from the top of the dome down to the neck, the height and the half-width seen
// from the front (x). A flattened dome, widest a third of the way down, tapering into a
// funnel. 2.35 across at the widest, the size the bladder always had; the origin is a little
// below the widest point, near the middle of what it holds.
const OUTLINE = [
  [0, 2.01], [0.57, 1.965], [0.69, 1.931], [0.83, 1.898], [1.0, 1.842], [1.13, 1.786], [1.37, 1.675],
  [1.56, 1.563], [1.8, 1.395], [1.99, 1.228], [2.16, 1.005], [2.27, 0.781], [2.32, 0.558], [2.35, 0.335],
  [2.344, 0.167], [2.32, 0], [2.24, -0.223], [2.08, -0.558], [1.86, -0.893], [1.56, -1.228], [1.19, -1.563],
  [0.876, -1.898], [0.7, -2.177], [0.642, -2.344], [0.592, -2.512],
]
// Its depth front to back, as a share of its width, by height: round at the top of the dome
// and down the funnel, flatter (0.82) where it's widest.
const DEPTH = [[2.01, 1], [1.9, 1], [1.786, 0.98], [1.563, 0.91], [1.228, 0.84], [1.005, 0.82], [0.335, 0.82], [-0.223, 0.85], [-1.228, 0.865], [-1.563, 0.885], [-1.898, 0.94], [-2.344, 1]]
export const DOME_TOP_Y = OUTLINE[0][1]
// The dome is the part above this height, where the bladder is widest.
export const DOME_BASE_Y = 0.3
export const depthAt = (y) => {
  if (y >= DEPTH[0][0]) return DEPTH[0][1]
  for (let k = 1; k < DEPTH.length; k++) {
    const [y1, d1] = DEPTH[k]
    const [y0, d0] = DEPTH[k - 1]
    if (y >= y1) return THREE.MathUtils.lerp(d1, d0, THREE.MathUtils.smoothstep(y, y1, y0))
  }
  return DEPTH[DEPTH.length - 1][1]
}

// The organ is one surface: the bladder from its dome down to the neck, then the
// sphincter ring and the urethra down to the opening, so there's no seam between them,
// they move together and the cutaway sections them together. Rings of RADIAL segments
// (plus a seam vertex for the UVs) from the top down: the bladder's rings evenly spaced
// along its outline (the first is the single point at the top), the rest along the
// sphincter's profile, hanging from the centre of the bladder's last ring.
export const RADIAL = 64
export const RING_VERTICES = RADIAL + 1
const BLADDER_ROWS = 41
export const BLADDER_VERTICES = (BLADDER_ROWS + 1) * RING_VERTICES
export const NECK_ROW = BLADDER_ROWS + 1 // the first row of the sphincter
export const NECK_ROWS = 18
export const NECK_GAP = 0.1 // from the bladder's last ring down to the top of the profile
// The neck doesn't stretch with the dome (the pelvic floor holds it): the funnel's lowest
// rings keep their resting width, so the bladder narrows into the sphincter at any fill.
export const NECK_WIDTH = 1

// The sphincter's profile, (radius, height) from the bottom up: a lip around the single
// small opening, the urethra up from it (the model's long tube, shortened), the thick
// muscular ring where it leaves the funnel, then the bottom of the funnel, as wide as the
// bladder's last ring.
export const OUTLET_Y = -2.4
export const NECK_TOP_Y = 0
const SPHINCTER_PROFILE = [
  [0.11, OUTLET_Y], [0.17, -2.36], [0.205, -2.26], [0.21, -1.95], [0.215, -1.65], [0.225, -1.38], [0.25, -1.17],
  [0.3, -1.02], [0.44, -0.88], [0.53, -0.74], [0.54, -0.6], [0.48, -0.46], [0.48, -0.32], [0.53, -0.15], [0.58, NECK_TOP_Y],
]
// Puckered folds around the ring, like a drawstring.
export const SPHINCTER_FOLDS = 14
const WALL_COLOR = 0xffffff // the tissue texture carries the colour
const SPHINCTER_COLORS = { neck: 0xffffff, ring: 0x9b2335, urethra: 0xe8a0a0 }

// How much a height on the profile belongs to the muscle ring, or to the urethra (0..1).
export const ringWeight = (y) => THREE.MathUtils.smoothstep(y, -0.95, -0.8) * (1 - THREE.MathUtils.smoothstep(y, -0.5, -0.38))
export const urethraWeight = (y) => 1 - THREE.MathUtils.smoothstep(y, -1.05, -0.9)

// The sphincter's rows, evenly spaced along its profile from the top down, and the row
// where the muscle ring is.
const PROFILE = new THREE.SplineCurve(SPHINCTER_PROFILE.map(([r, y]) => new THREE.Vector2(r, y))).getSpacedPoints(NECK_ROWS - 1).reverse()
export const RING_ROW = NECK_ROW + PROFILE.reduce((best, p, k) => (ringWeight(p.y) > ringWeight(PROFILE[best].y) ? k : best), 0)

export const BOUNDS_RADIUS = 5.2
const BOUNDS_CENTER = new THREE.Vector3(0, -1.2, 0)

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
// while the sphincter stays solid. `rings`: each bladder ring's place along the outline
// (0 at the top, 1 at the neck), for the rig.
export function createOrganGeometry() {
  const outline = new THREE.SplineCurve(OUTLINE.map(([r, y]) => new THREE.Vector2(r, y))).getSpacedPoints(BLADDER_ROWS)
  outline[0].x = 0 // the top is a single point
  const profile = PROFILE.map((p) => p.clone())
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
  const neckTop = outline[BLADDER_ROWS].y - NECK_GAP
  const rings = outline.map((_, iy) => iy / BLADDER_ROWS)

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix <= RADIAL; ix++) {
      const i = iy * RING_VERTICES + ix
      const phi = (ix / RADIAL) * Math.PI * 2
      const dx = -Math.cos(phi)
      const dz = Math.sin(phi)
      if (iy < NECK_ROW) {
        const { x: r, y } = outline[iy]
        position[i * 3] = dx * r
        position[i * 3 + 1] = y
        position[i * 3 + 2] = dz * r * depthAt(y)
        c.copy(wallColor)
      } else {
        const { x: r, y } = profile[iy - NECK_ROW]
        position[i * 3] = dx * r
        position[i * 3 + 1] = neckTop + y - NECK_TOP_Y
        position[i * 3 + 2] = dz * r
        // Colour by part: deep red muscle ring, paler urethra.
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
  geometry.boundingSphere = new THREE.Sphere(BOUNDS_CENTER.clone(), BOUNDS_RADIUS)
  return { geometry, profile, rings }
}
