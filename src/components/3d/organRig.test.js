import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createOrganRig } from './organRig'
import {
  BLADDER_VERTICES, FLUID_INSET, NECK_ROW, ORGAN_CENTER, orientCutaway, overfillGrowth, RESIDUAL_ML, RING_VERTICES, urineScale,
} from './organGeometry'
import { WALL_EMISSIVE } from './bodyLanguage'
import { emoteFor } from '../../feedback/emotes'
import { computeNormals } from './normals'
import { ORGAN_HALF_HEIGHT } from './stageFit'
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

  it('says which side each squirt comes from, so it can be heard there (B)', () => {
    const rig = createOrganRig()
    const sim = createSimState()
    const sides = []
    for (let f = 0; f < 12 * 60; f++) rig.update(sim, 1 / 60, f / 60, { onSquirt: (side) => sides.push(side) })
    expect(sides).toEqual([-1, 1]) // left at 4.5 s, right at 9 s
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

describe('overfilled (the arcade has no limit)', () => {
  const settle = (ml) => {
    const rig = createOrganRig()
    const sim = createSimState()
    sim.volume = ml
    play(rig, sim, 3)
    return rig
  }
  const highest = (rig) => {
    const pos = rig.bladderGeo.attributes.position
    let top = -Infinity
    for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i))
    return top + ORGAN_CENTER.y
  }

  it('keeps growing without limit, and the view backing off by overfillGrowth keeps it in frame', () => {
    expect(overfillGrowth(0.5)).toBe(1)
    expect(overfillGrowth(1.25)).toBeCloseTo(1, 9)
    const sizes = [937, 2000, 4000, 20000].map((ml) => ({ ml, rig: settle(ml) }))
    for (let i = 1; i < sizes.length; i++) expect(highest(sizes[i].rig)).toBeGreaterThan(highest(sizes[i - 1].rig) + 0.3)
    for (const { ml, rig } of sizes) expect(highest(rig)).toBeLessThan(ORGAN_HALF_HEIGHT * overfillGrowth(ml / 750))
    // The urine still fills it, however much there is.
    expect(urineScale(20000, 750)).toBe(FLUID_INSET)
  })

  it('keeps the sphincter its size, the ureters plugged in from outside it, and pokes landing on it', () => {
    const ring = (rig) => rowRadius(rig, NECK_ROW + 9)
    const small = settle(937)
    const huge = settle(20000)
    expect(ring(huge)).toBeCloseTo(ring(small), 2)
    // Each ureter starts above the swollen dome, and still ends on the wall.
    const tube = huge.ureterGeoLeft.attributes.position
    const start = new THREE.Vector3().fromBufferAttribute(tube, 0)
    expect(start.y + ORGAN_CENTER.y).toBeGreaterThan(highest(huge))
    // Every vertex is inside the bounds raycasting checks first.
    for (const geo of [huge.bladderGeo, huge.ureterGeoLeft]) {
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i += 7) expect(geo.boundingSphere.containsPoint(new THREE.Vector3().fromBufferAttribute(pos, i))).toBe(true)
    }
  })
})

describe('feel (E)', () => {
  // A settled bladder holding `ml`, and its wall vertex facing +z near the equator.
  const settled = (ml) => {
    const rig = createOrganRig()
    const sim = createSimState()
    sim.volume = ml
    play(rig, sim, 3)
    const i = 24 * RING_VERTICES + 48 // row 24, θ = 3π/2: the front
    return { rig, sim, i }
  }
  const radius = (rig, i) => new THREE.Vector3().fromBufferAttribute(rig.bladderGeo.attributes.position, i).length()

  it('dents deep when slack, and only a little when taut', () => {
    const dent = (ml) => {
      const { rig, sim, i } = settled(ml)
      const rest = radius(rig, i)
      rig.poke(new THREE.Vector3().fromBufferAttribute(rig.bladderGeo.attributes.position, i), 2.2)
      let deepest = rest
      for (let f = 0; f < 30; f++) {
        rig.update(sim, 1 / 60, 3 + f / 60, {})
        deepest = Math.min(deepest, radius(rig, i))
      }
      return (rest - deepest) / rest
    }
    const slack = dent(60)
    const taut = dent(700)
    expect(taut).toBeGreaterThan(0.02)
    expect(slack).toBeGreaterThan(taut * 1.5)
  })

  it("carries a slap's ripple further when full", () => {
    const wave = (ml) => {
      const { rig, sim, i } = settled(ml)
      const rest = radius(rig, i)
      // A ripple from the back, reaching the front.
      sim.ripples.push({ center: { x: 0, y: 0, z: -2.3 }, radius: 4.0, maxRadius: 6, speed: 0, amplitude: 0.5, decay: 0 })
      let most = 0
      for (let f = 0; f < 30; f++) {
        rig.update(sim, 1 / 60, 3 + f / 60, {})
        most = Math.max(most, radius(rig, i) / rest - 1)
      }
      return most
    }
    expect(wave(700)).toBeGreaterThan(wave(60) * 1.5)
  })
})

describe('body language (D)', () => {
  const DOME = RING_VERTICES * 2
  const SIDE = BLADDER_VERTICES / 2
  // Where a vertex of the wall ends up, with the body's transform.
  const at = (rig, body, i) => new THREE.Vector3().fromBufferAttribute(rig.bladderGeo.attributes.position, i).multiply(body.scale).add(body.position)
  // Runs `seconds` from `from` and records `measure` every frame.
  const track = (rig, sim, seconds, from, objects, measure) => {
    const out = []
    for (let f = 0; f < seconds * 60; f++) {
      rig.update(sim, 1 / 60, from + f / 60, objects)
      out.push(measure())
    }
    return out
  }
  // A settled bladder, breathing (if it feels a mood) for 3 s.
  const settled = (mood) => {
    const rig = createOrganRig()
    const sim = createSimState()
    const body = new THREE.Object3D()
    sim.volume = 300
    play(rig, sim, 3)
    track(rig, sim, 3, 3, { body, mood }, () => 0)
    return { rig, sim, body }
  }
  const swing = (values) => Math.max(...values) - Math.min(...values)
  // Breaths a second: how often it crosses its middle size on the way up.
  const breathsPerSecond = (values, seconds) => {
    const mid = (Math.max(...values) + Math.min(...values)) / 2
    let ups = 0
    for (let i = 1; i < values.length; i++) if (values[i - 1] < mid && values[i] >= mid) ups++
    return ups / seconds
  }

  it('breathes, slow and deep when sleepy, quick and shallow in a panic, and holds still without a mood', () => {
    const breathing = (mood) => {
      const { rig, sim, body } = settled(mood)
      return track(rig, sim, 12, 6, { body, mood }, () => at(rig, body, DOME).y)
    }
    const sleepy = breathing('sleepy')
    const panic = breathing('panic')
    expect(swing(sleepy)).toBeGreaterThan(swing(panic) * 2)
    // Counted over 12 s, so to within 1/12 of a breath a second.
    expect(Math.abs(breathsPerSecond(sleepy, 12) - 0.16)).toBeLessThan(0.1)
    expect(Math.abs(breathsPerSecond(panic, 12) - 0.9)).toBeLessThan(0.1)
    expect(swing(breathing(undefined))).toBeLessThan(1e-4)
  })

  it('bounces up from the neck when pleased, squashes back past rest, and settles', () => {
    const { rig, sim, body } = settled()
    const rest = at(rig, body, DOME).y
    const neck = () => at(rig, body, BLADDER_VERTICES - 2).y
    const neckRest = neck()
    rig.emote('hop')
    const heights = track(rig, sim, 2, 6, { body }, () => at(rig, body, DOME).y)
    expect(Math.max(...heights) - rest).toBeGreaterThan(0.2)
    expect(Math.min(...heights)).toBeLessThan(rest - 0.05)
    expect(Math.abs(heights.at(-1) - rest)).toBeLessThan(0.01)
    expect(neck()).toBeCloseTo(neckRest, 2)
  })

  it('sighs: swells all round, then lets it out', () => {
    const { rig, sim, body } = settled()
    const size = () => at(rig, body, SIDE).distanceTo(at(rig, body, DOME))
    const rest = size()
    rig.emote('sigh')
    const sizes = track(rig, sim, 3, 6, { body }, size)
    expect(Math.max(...sizes)).toBeGreaterThan(rest * 1.02)
    expect(Math.abs(sizes.at(-1) / rest - 1)).toBeLessThan(0.002)
  })

  it('shudders on a leak, and droops when the clench gives out', () => {
    const { rig, sim, body } = settled()
    const frameToFrame = (seconds, from) => {
      const places = track(rig, sim, seconds, from, { body }, () => at(rig, body, SIDE))
      return Math.max(...places.slice(1).map((p, i) => p.distanceTo(places[i])))
    }
    expect(frameToFrame(0.3, 6)).toBeLessThan(1e-4)
    rig.emote('shudder')
    expect(frameToFrame(0.3, 6.3)).toBeGreaterThan(0.02)
    play(rig, sim, 0.5, 6.6)
    expect(frameToFrame(0.3, 7.1)).toBeLessThan(1e-4)

    const rest = at(rig, body, DOME).y
    rig.emote('droop')
    const heights = track(rig, sim, 4, 8, { body }, () => at(rig, body, DOME).y)
    expect(rest - Math.min(...heights)).toBeGreaterThan(0.2)
    expect(Math.abs(heights.at(-1) - rest)).toBeLessThan(0.01)
  })

  it('shivers while a warned urge or sneeze is on its way', () => {
    const { rig, sim, body } = settled()
    const place = () => at(rig, body, SIDE)
    const moved = (seconds, from) => swing(track(rig, sim, seconds, from, { body }, () => place().x))
    expect(moved(0.5, 6)).toBeLessThan(1e-4)
    sim.urgeWarned = true
    expect(moved(0.5, 6.5)).toBeGreaterThan(0.01)
  })

  it('trembles when strained, and shakes less with reduced motion asked for (A4)', () => {
    const { rig, sim, body } = settled()
    const moved = (seconds, from, objects) => swing(track(rig, sim, seconds, from, { body, ...objects }, () => at(rig, body, SIDE).x))
    sim.sphincterToneStrain = 0.25
    expect(moved(0.5, 6)).toBeLessThan(1e-3)
    sim.sphincterToneStrain = 0.9
    const strained = moved(0.5, 6.5)
    expect(strained).toBeGreaterThan(0.01)

    sim.sphincterToneStrain = 0
    play(rig, sim, 1, 7)
    rig.emote('shudder')
    const shudder = moved(0.3, 8)
    play(rig, sim, 1, 8.3)
    rig.emote('shudder')
    expect(moved(0.3, 9.3, { reducedMotion: true })).toBeLessThan(shudder * 0.5)
  })

  it('moves the stream with it, from the opening', () => {
    const { rig, sim, body } = settled()
    sim.isActivelyVoiding = true
    sim.sphincterDilation = 1
    sim.flowRate = 15
    rig.emote('droop')
    track(rig, sim, 0.15, 6, { body }, () => 0)
    const outlet = rowCentre(rig, rowCount(rig) - 1).multiply(body.scale).add(body.position)
    expect(outlet.distanceTo(rowCentre(rig, rowCount(rig) - 1))).toBeGreaterThan(0.03) // the droop moved it
    const jet = rig.stream.jetGeo.attributes.position
    let nearest = Infinity
    for (let i = 0; i < jet.count; i++) nearest = Math.min(nearest, new THREE.Vector3().fromBufferAttribute(jet, i).distanceTo(outlet))
    expect(nearest).toBeLessThan(0.1)
  })

  it('blushes while embarrassed, and flashes when it creaks', () => {
    const { rig, sim, body } = settled()
    const wallMat = { emissive: new THREE.Color(), emissiveIntensity: 0, roughness: 0 }
    rig.update(sim, 1 / 60, 6, { body, wallMat, mood: 'calm' })
    const calm = { color: wallMat.emissive.clone(), glow: wallMat.emissiveIntensity }
    expect(calm.color.equals(WALL_EMISSIVE)).toBe(true)
    track(rig, sim, 2, 6, { body, wallMat, mood: 'embarrassed' }, () => 0)
    expect(wallMat.emissive.r).toBeGreaterThan(calm.color.r + 0.2)
    expect(wallMat.emissiveIntensity).toBeGreaterThan(calm.glow + 0.25)
    track(rig, sim, 3, 8, { body, wallMat, mood: 'calm' }, () => 0)
    expect(wallMat.emissiveIntensity).toBeCloseTo(calm.glow, 2)
    rig.emote('creak')
    rig.update(sim, 1 / 60, 11, { body, wallMat, mood: 'calm' })
    expect(wallMat.emissiveIntensity).toBeGreaterThan(calm.glow + 0.3)
  })

  it('knows what to do when things happen, and huffs at a poke only when annoyed', () => {
    expect(emoteFor({ type: 'leakStart' })).toBe('shudder')
    expect(emoteFor({ type: 'clenchExhausted' })).toBe('droop')
    expect(emoteFor({ type: 'arcadePoints', reason: 'perfect' })).toBe('hop')
    expect(emoteFor({ type: 'arcadePoints', reason: 'drink' })).toBe(null)
    expect(emoteFor({ type: 'urgeEnd', suppressed: true })).toBe('sigh')
    expect(emoteFor({ type: 'urgeEnd', suppressed: false })).toBe(null)
    expect(emoteFor({ type: 'voidStop' })).toBe('sigh')
    expect(emoteFor({ type: 'poke', touch: true }, 'calm')).toBe(null)
    expect(emoteFor({ type: 'poke', touch: true }, 'annoyed')).toBe('huff')
    expect(emoteFor({ type: 'creak' })).toBe('creak')
  })
})
