import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { BOLUS_SPEED, createUreter, FLARE_RINGS, REST_INTERVAL, URETER_RING, URETER_SINK } from './ureter'

const DT = 1 / 60

// A ureter routed onto a plain sphere for a wall.
function setup(side = -1) {
  const sphere = new THREE.SphereGeometry(2.4, 32, 24).attributes.position
  const vertices = Array.from({ length: sphere.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(sphere, i))
  const ureter = createUreter(side, vertices)
  const point = vertices[ureter.endIndex]
  const normal = point.clone().normalize()
  ureter.route(point, normal)
  ureter.step(DT, 0)
  return { ureter, point, normal }
}

const ringCount = (ureter) => ureter.geo.attributes.position.count / URETER_RING
const ring = (ureter, i) => Array.from({ length: URETER_RING - 1 }, (_, j) => new THREE.Vector3().fromBufferAttribute(ureter.geo.attributes.position, i * URETER_RING + j))
const radius = (points) => {
  const centre = points.reduce((c, p) => c.add(p), new THREE.Vector3()).divideScalar(points.length)
  return points.reduce((sum, p) => sum + p.distanceTo(centre), 0) / points.length
}
// The tube's widest ring short of the flare, and how wide it is.
const widest = (ureter) => {
  let best = { index: -1, radius: 0 }
  for (let i = 0; i < ringCount(ureter) - FLARE_RINGS - 1; i++) {
    const r = radius(ring(ureter, i))
    if (r > best.radius) best = { index: i, radius: r }
  }
  return best
}

describe('ureter', () => {
  it('flares into a root that follows the wall, its rim just under the surface', () => {
    const { ureter } = setup()
    const rim = ring(ureter, ringCount(ureter) - 1)
    // Under the sphere's surface all round (a flat bell would stick out where it curves away).
    for (const p of rim) {
      const under = 2.4 - p.length()
      expect(under).toBeGreaterThan(URETER_SINK * 0.99)
      expect(under).toBeLessThan(URETER_SINK + 0.02)
    }
    // Wide across: it comes in at a shallow angle, so the rim is pressed into an oval.
    const span = Math.max(...rim.flatMap((p) => rim.map((q) => p.distanceTo(q))))
    expect(span).toBeGreaterThan(2 * radius(ring(ureter, 10)) * 1.8)
  })

  it('squeezes each bolus down at an even pace, swollen where it is, and squirts it in', () => {
    const { ureter } = setup()
    const plain = radius(ring(ureter, 10))
    let t = 0
    while (ureter.boluses.length === 0) { ureter.step(DT, 0); t += DT }
    const start = t
    const path = []
    let arrived = 0
    while (!arrived) {
      arrived = ureter.step(DT, 0)
      t += DT
      if (ureter.boluses[0] > 0.1 && ureter.boluses[0] < 0.85 && path.length < 3 && Math.round((t - start) * 60) % 30 === 0) path.push(widest(ureter))
    }
    expect(arrived).toBe(1)
    expect(t - start).toBeCloseTo(1 / BOLUS_SPEED, 1)
    // The swelling travels down the tube with it, the same distance each half second.
    expect(path).toHaveLength(3)
    for (const p of path) expect(p.radius).toBeGreaterThan(plain * 1.3)
    const gaps = [path[1].index - path[0].index, path[2].index - path[1].index]
    expect(gaps[0]).toBeGreaterThan(0)
    expect(Math.abs(gaps[1] - gaps[0])).toBeLessThanOrEqual(1)
  })

  it('squeezes more often while drinks are being filtered', () => {
    const count = (filtration) => {
      const { ureter } = setup()
      let squirts = 0
      for (let f = 0; f < 60 * 60; f++) squirts += ureter.step(DT, filtration)
      return squirts
    }
    const resting = count(0)
    expect(resting).toBeGreaterThanOrEqual(Math.floor(60 / REST_INTERVAL) - 1)
    expect(count(16)).toBeGreaterThan(resting * 4)
  })
})
