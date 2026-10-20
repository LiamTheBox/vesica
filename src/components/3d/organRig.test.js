import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { computeNormals, createOrganRig, FLUID_INSET, ORGAN_CENTER, orientCutaway, RESIDUAL_ML, urineScale } from './organRig'
import { createSimState } from '../../sim/sim'

// Three.js clips points whose signed distance to a clipping plane is negative.
const isClipped = (plane, point) => plane.distanceToPoint(point) < 0

describe('cutaway faces the player', () => {
  const plane = new THREE.Plane()
  const cases = {
    front: new THREE.Vector3(0, 1.7, 12),
    back: new THREE.Vector3(0, 1.7, -12),
    side: new THREE.Vector3(12, 0.2, 0),
    'above at an angle': new THREE.Vector3(-6, 9, 6),
  }

  for (const [name, camera] of Object.entries(cases)) {
    it(`removes the near half and keeps the far half (${name})`, () => {
      orientCutaway(plane, camera)
      const towardCamera = camera.clone().sub(ORGAN_CENTER).normalize()
      const nearWall = ORGAN_CENTER.clone().addScaledVector(towardCamera, 2)
      const farWall = ORGAN_CENTER.clone().addScaledVector(towardCamera, -2)
      expect(isClipped(plane, nearWall)).toBe(true)
      expect(isClipped(plane, farWall)).toBe(false)
      expect(plane.distanceToPoint(ORGAN_CENTER)).toBeCloseTo(0, 9)
    })
  }
})

describe('per-frame geometry work (M7)', () => {
  it('computes the same normals as Three.js', () => {
    const shapes = [new THREE.SphereGeometry(2.35, 64, 48), new THREE.CylinderGeometry(0.35, 0.22, 1.2, 48, 16, false)]
    for (const geo of shapes) {
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i, pos.getX(i) * (1 + 0.2 * Math.sin(i)), pos.getY(i) * 1.1, pos.getZ(i) + 0.05 * Math.cos(i * 0.7))
      }
      const reference = geo.clone()
      reference.computeVertexNormals()
      computeNormals(geo)
      expect(Array.from(geo.attributes.normal.array)).toEqual(Array.from(reference.attributes.normal.array))
    }
  })

  // The tubes are rebuilt in place rather than by TubeGeometry; they must still end on the wall.
  it('keeps both ureters plugged into the wall as it inflates and wobbles', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    const wall = rig.bladderGeo.attributes.position
    const lastRing = (geo) => {
      const pos = geo.attributes.position
      const c = new THREE.Vector3()
      for (let j = pos.count - 9; j < pos.count; j++) c.add(new THREE.Vector3().fromBufferAttribute(pos, j))
      return c.divideScalar(9)
    }
    for (let f = 0; f < 120; f++) {
      sim.volume = 120 + f * 5
      sim.jiggleIntensity = 0.8
      sim.globalJigglePhase = f * 0.2
      rig.update(sim, 1 / 60, f / 60, {})
    }
    for (const geo of [rig.ureterGeoLeft, rig.ureterGeoRight]) {
      const end = lastRing(geo)
      // Nearest wall vertex: the ureter sinks 3 % into the wall at its attachment point.
      let nearest = Infinity
      for (let i = 0; i < wall.count; i++) nearest = Math.min(nearest, end.distanceTo(new THREE.Vector3().fromBufferAttribute(wall, i).multiplyScalar(0.97)))
      expect(nearest).toBeLessThan(0.15)
      const normals = geo.attributes.normal
      for (let i = 0; i < normals.count; i++) expect(new THREE.Vector3().fromBufferAttribute(normals, i).length()).toBeCloseTo(1, 5)
    }
  })

  it('moves the filtering drops at an even pace along the ureter', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    sim.activeBeverages = [{}]
    const drop = { visible: false, position: new THREE.Vector3(), scale: { setScalar() {} } }
    const other = { ...drop, position: new THREE.Vector3() }
    const at = (u) => {
      rig.update(sim, 1 / 60, u / 0.8, { leftDrop: drop, rightDrop: other })
      return drop.position.clone()
    }
    rig.update(sim, 1 / 60, 0, {}) // settle the ureters on the wall first
    const steps = [0.1, 0.3, 0.5, 0.7, 0.9].map(at)
    const gaps = steps.slice(1).map((p, i) => p.distanceTo(steps[i]))
    for (const gap of gaps) expect(gap / gaps[0]).toBeCloseTo(1, 1)
  })
})

describe('urine inside the wall', () => {
  it('is gone when the bladder is empty and fills the sac when full', () => {
    expect(urineScale(0, 750)).toBe(0)
    expect(urineScale(RESIDUAL_ML, 750)).toBe(0)
    expect(urineScale(750, 750)).toBeCloseTo(FLUID_INSET, 9)
    expect(urineScale(900, 750)).toBeLessThanOrEqual(FLUID_INSET) // overfull: still inside the wall
  })

  it('grows steadily with the volume, leaving a thick wall when nearly empty', () => {
    let previous = 0
    for (let ml = RESIDUAL_ML + 1; ml <= 750; ml += 7) {
      const k = urineScale(ml, 750)
      expect(k).toBeGreaterThan(previous)
      previous = k
    }
    expect(urineScale(20, 750)).toBeLessThan(0.5)
  })
})

describe('sphincter', () => {
  const widest = (rig, inBand) => {
    const pos = rig.sphincterGeo.attributes.position
    let max = 0
    for (let i = 0; i < pos.count; i++) if (inBand(pos.getY(i))) max = Math.max(max, Math.hypot(pos.getX(i), pos.getZ(i)))
    return max
  }
  const ring = (rig) => widest(rig, (y) => Math.abs(y - 0.01) < 0.06)
  const outlet = (rig) => widest(rig, (y) => y < -0.55)
  const play = (rig, sim, seconds, from = 0) => {
    for (let f = 0; f < seconds * 60; f++) rig.update(sim, 1 / 60, from + f / 60, {})
  }

  it('is a muscular ring above a narrower urethra', () => {
    const rig = createOrganRig()
    play(rig, createSimState(), 0.5)
    expect(ring(rig)).toBeGreaterThan(outlet(rig) * 2.5)
  })

  it('clamps on a clench and opens to void', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    play(rig, sim, 0.5)
    const rest = { ring: ring(rig), outlet: outlet(rig) }
    sim.isClenching = true
    play(rig, sim, 0.5, 0.5)
    expect(ring(rig)).toBeLessThan(rest.ring * 0.9)
    sim.isClenching = false
    sim.sphincterDilation = 1
    play(rig, sim, 0.5, 1)
    expect(outlet(rig)).toBeGreaterThan(rest.outlet * 2)
  })

  it('shakes under strain and holds still without', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    const shape = (t) => {
      rig.update(sim, 1 / 60, t, {})
      return Array.from(rig.sphincterGeo.attributes.position.array)
    }
    play(rig, sim, 0.5)
    const still = shape(1.0)
    expect(shape(1.05)).toEqual(still)
    sim.sphincterToneStrain = 0.85
    const a = shape(2.0)
    const b = shape(2.05)
    expect(Math.max(...a.map((v, i) => Math.abs(v - b[i])))).toBeGreaterThan(0.01)
  })
})
