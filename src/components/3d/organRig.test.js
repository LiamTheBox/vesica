import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  BLADDER_VERTICES, computeNormals, createOrganRig, FLUID_INSET, NECK_ROW, ORGAN_CENTER, orientCutaway, RESIDUAL_ML, RING_VERTICES, urineScale,
} from './organRig'
import { FLARE_RINGS, URETER_RING } from './ureter'
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
    'below at an angle': new THREE.Vector3(3, -9, 5),
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
      // An upright section: looking up from below doesn't slice the bottom off.
      expect(plane.normal.y).toBe(0)
    })
  }

  it('keeps its last direction when seen from straight above', () => {
    orientCutaway(plane, new THREE.Vector3(12, 0.2, 0))
    const normal = plane.normal.clone()
    orientCutaway(plane, new THREE.Vector3(0, 14, 0))
    expect(plane.normal).toEqual(normal)
  })
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
      for (let j = pos.count - URETER_RING; j < pos.count - 1; j++) c.add(new THREE.Vector3().fromBufferAttribute(pos, j))
      return c.divideScalar(URETER_RING - 1)
    }
    for (let f = 0; f < 120; f++) {
      sim.volume = 120 + f * 5
      sim.jiggleIntensity = 0.8
      sim.globalJigglePhase = f * 0.2
      rig.update(sim, 1 / 60, f / 60, {})
    }
    for (const geo of [rig.ureterGeoLeft, rig.ureterGeoRight]) {
      const end = lastRing(geo)
      // Nearest wall vertex: the ureter's flared end lies on the wall at its attachment point.
      let nearest = Infinity
      for (let i = 0; i < wall.count; i++) nearest = Math.min(nearest, end.distanceTo(new THREE.Vector3().fromBufferAttribute(wall, i)))
      expect(nearest).toBeLessThan(0.15)
      const normals = geo.attributes.normal
      for (let i = 0; i < normals.count; i++) expect(new THREE.Vector3().fromBufferAttribute(normals, i).length()).toBeCloseTo(1, 5)
    }
  })
})

describe('ureters', () => {
  const settled = (ml) => {
    const rig = createOrganRig()
    const sim = createSimState()
    const urine = { visible: true, scale: new THREE.Vector3(), position: new THREE.Vector3() }
    sim.volume = ml
    for (let f = 0; f < 240; f++) rig.update(sim, 1 / 60, f / 60, { urine })
    return { rig, urine }
  }
  // Centres of the tube's rings, from the top down to where it joins the wall.
  const centreline = (geo) => {
    const pos = geo.attributes.position
    const points = []
    for (let o = 0; o < pos.count; o += URETER_RING) {
      const c = new THREE.Vector3()
      for (let j = 0; j < URETER_RING - 1; j++) c.add(new THREE.Vector3().fromBufferAttribute(pos, o + j))
      points.push(c.divideScalar(URETER_RING - 1))
    }
    return points
  }
  // Whether `p` lies inside `geo`'s surface: closer to the centre than the surface is in its
  // direction (the shapes are all star-shaped about their centre).
  const raycaster = new THREE.Raycaster()
  const inside = (geo, p) => {
    raycaster.set(new THREE.Vector3(), p.clone().normalize())
    const [hit] = raycaster.intersectObject(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })))
    return p.length() < hit.distance
  }

  for (const ml of [120, 400, 750]) {
    it(`enter low on the back, either side of the neck, from outside the wall (${ml} ml)`, () => {
      const { rig, urine } = settled(ml)
      const wall = rig.bladderGeo.attributes.position
      let bottom = Infinity, back = Infinity
      for (let i = 0; i < BLADDER_VERTICES; i++) {
        bottom = Math.min(bottom, wall.getY(i))
        back = Math.min(back, wall.getZ(i))
      }
      for (const [geo, side] of [[rig.ureterGeoLeft, -1], [rig.ureterGeoRight, 1]]) {
        const line = centreline(geo)
        const end = line[line.length - 1]
        expect(end.y).toBeLessThan(bottom * 0.25) // well below the middle
        expect(end.z).toBeLessThan(back * 0.4) // on the back
        expect(end.x * side).toBeGreaterThan(0.3) // beside the neck, not on it
        // Outside the wall all the way down to the flare, which lies on it.
        for (const p of line.slice(0, -FLARE_RINGS - 1)) expect(inside(rig.bladderGeo, p)).toBe(false)
        // Its end stays in the wall: no part of the tube pokes into the urine.
        const pos = geo.attributes.position
        for (let i = 0; i < pos.count; i++) {
          const local = new THREE.Vector3().fromBufferAttribute(pos, i).sub(urine.position).divideScalar(urine.scale.x)
          expect(inside(rig.liningGeo, local)).toBe(false)
        }
      }
    })
  }
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

// The organ is one surface: the bladder's rows, then the sphincter's down to the opening.
const rowCount = (rig) => rig.bladderGeo.attributes.position.count / RING_VERTICES
const rowCentre = (rig, row) => {
  const pos = rig.bladderGeo.attributes.position
  const centre = new THREE.Vector3()
  for (let ix = 0; ix < RING_VERTICES - 1; ix++) centre.add(new THREE.Vector3().fromBufferAttribute(pos, row * RING_VERTICES + ix))
  return centre.divideScalar(RING_VERTICES - 1)
}
// Mean radius of a row around its own centre.
const rowRadius = (rig, row) => {
  const pos = rig.bladderGeo.attributes.position
  const centre = rowCentre(rig, row)
  let sum = 0
  for (let ix = 0; ix < RING_VERTICES - 1; ix++) {
    const i = row * RING_VERTICES + ix
    sum += Math.hypot(pos.getX(i) - centre.x, pos.getZ(i) - centre.z)
  }
  return sum / (RING_VERTICES - 1)
}
const play = (rig, sim, seconds, from = 0) => {
  for (let f = 0; f < seconds * 60; f++) rig.update(sim, 1 / 60, from + f / 60, {})
}

describe('sphincter', () => {
  const ring = (rig) => Math.max(...Array.from({ length: rowCount(rig) - NECK_ROW }, (_, r) => rowRadius(rig, NECK_ROW + r)))
  const outlet = (rig) => rowRadius(rig, rowCount(rig) - 1)

  it('is a muscular ring above a narrower urethra', () => {
    const rig = createOrganRig()
    play(rig, createSimState(), 0.5)
    expect(ring(rig)).toBeGreaterThan(outlet(rig) * 2.5)
  })

  it('hangs from the bladder neck, which sits forward of the middle, at any fill', () => {
    for (const ml of [20, 300, 750]) {
      const rig = createOrganRig()
      const sim = createSimState()
      sim.volume = ml
      play(rig, sim, 3)
      const neck = rowCentre(rig, NECK_ROW - 1)
      const top = rowCentre(rig, NECK_ROW)
      expect(Math.hypot(top.x - neck.x, top.z - neck.z)).toBeLessThan(1e-3)
      expect(neck.y - top.y).toBeCloseTo(0.12, 3)
      expect(neck.z).toBeGreaterThan(0.2)
      // The opening is the lowest point, under the neck.
      const bottom = rowCentre(rig, rowCount(rig) - 1)
      const pos = rig.bladderGeo.attributes.position
      for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBeGreaterThanOrEqual(bottom.y - 1e-6)
    }
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
    // It opens, but stays a narrow opening rather than a wide nozzle (requested).
    expect(outlet(rig)).toBeGreaterThan(rest.outlet * 1.3)
    expect(outlet(rig)).toBeLessThan(rest.outlet * 1.6)
  })

  it('shakes under strain and holds still without', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    // The sphincter's shape around the neck, so the wall settling doesn't count.
    const shape = (t) => {
      rig.update(sim, 1 / 60, t, {})
      const pos = rig.bladderGeo.attributes.position
      const neck = rowCentre(rig, NECK_ROW - 1)
      const out = []
      for (let i = NECK_ROW * RING_VERTICES; i < pos.count; i++) out.push(pos.getX(i) - neck.x, pos.getY(i) - neck.y, pos.getZ(i) - neck.z)
      return out
    }
    const change = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))
    play(rig, sim, 0.5)
    expect(change(shape(1.0), shape(1.05))).toBeLessThan(1e-6)
    sim.sphincterToneStrain = 0.85
    expect(change(shape(2.0), shape(2.05))).toBeGreaterThan(0.01)
  })
})

describe('bladder wall', () => {
  const meanRadius = (rig) => {
    const pos = rig.bladderGeo.attributes.position
    let sum = 0
    for (let i = 0; i < BLADDER_VERTICES; i++) sum += Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i))
    return sum / BLADDER_VERTICES
  }

  it('contracts in an urge wave and while voiding, then relaxes', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    sim.volume = 400
    play(rig, sim, 3)
    const rest = meanRadius(rig)
    sim.detrusorSpasmIntensity = 1
    play(rig, sim, 1, 3)
    expect(meanRadius(rig)).toBeLessThan(rest * 0.98)
    sim.detrusorSpasmIntensity = 0
    play(rig, sim, 3, 4)
    expect(meanRadius(rig)).toBeCloseTo(rest, 2)
    sim.isActivelyVoiding = true
    play(rig, sim, 1, 7)
    expect(meanRadius(rig)).toBeLessThan(rest * 0.98)
  })

  // How sharply a ring of the wall bends anywhere around it: the largest second difference
  // of its radius, relative to the radius (creases score high; a smooth oval scores ~0).
  const crease = (rig, row) => {
    const pos = rig.bladderGeo.attributes.position
    const centre = rowCentre(rig, row)
    const r = Array.from({ length: RING_VERTICES - 1 }, (_, ix) => {
      const i = row * RING_VERTICES + ix
      return Math.hypot(pos.getX(i) - centre.x, pos.getZ(i) - centre.z)
    })
    const mean = r.reduce((a, b) => a + b) / r.length
    return Math.max(...r.map((v, j) => Math.abs(r[(j + r.length - 1) % r.length] - 2 * v + r[(j + 1) % r.length]))) / mean
  }

  it('folds like a deflated balloon when slack, and pulls smooth when full or contracting', () => {
    const at = (state) => {
      const rig = createOrganRig()
      const sim = createSimState()
      Object.assign(sim, state)
      play(rig, sim, 3)
      return crease(rig, 30)
    }
    const slack = at({ volume: 30 })
    expect(slack).toBeGreaterThan(0.04)
    expect(at({ volume: 750 })).toBeLessThan(0.01)
    expect(at({ volume: 30, detrusorSpasmIntensity: 1 })).toBeLessThan(slack / 2)
  })

  it('swells where a ureter squirts urine in', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    sim.volume = 300
    const pos = rig.bladderGeo.attributes.position
    const radiusAt = (i) => new THREE.Vector3().fromBufferAttribute(pos, i).length()
    // The left ureter's first bolus arrives 4.5 s in.
    play(rig, sim, 4.4)
    // The wall vertex under the left ureter's flared end, and one on the dome.
    const ureterEnd = new THREE.Vector3()
    const end = rig.ureterGeoLeft.attributes.position
    for (let j = end.count - URETER_RING; j < end.count - 1; j++) ureterEnd.add(new THREE.Vector3().fromBufferAttribute(end, j))
    ureterEnd.divideScalar(URETER_RING - 1)
    let opening = 0
    for (let i = 1; i < BLADDER_VERTICES; i++) {
      if (new THREE.Vector3().fromBufferAttribute(pos, i).distanceTo(ureterEnd) < new THREE.Vector3().fromBufferAttribute(pos, opening).distanceTo(ureterEnd)) opening = i
    }
    const before = { opening: radiusAt(opening), dome: radiusAt(RING_VERTICES * 2) }
    play(rig, sim, 0.25, 4.4)
    expect(radiusAt(opening)).toBeGreaterThan(before.opening * 1.005)
    expect(Math.abs(radiusAt(RING_VERTICES * 2) / before.dome - 1)).toBeLessThan(0.002)
  })

  it('is a see-through membrane that thins as it fills, over a solid sphincter', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    const alpha = (i) => rig.bladderGeo.attributes.color.getW(i)
    sim.volume = 100
    play(rig, sim, 0.1)
    const empty = alpha(0)
    sim.volume = 750
    play(rig, sim, 0.1, 0.1)
    expect(alpha(0)).toBeLessThan(empty)
    expect(alpha(BLADDER_VERTICES - 1)).toBeLessThan(1)
    expect(alpha(BLADDER_VERTICES)).toBe(1)
  })
})
