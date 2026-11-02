import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createStream } from './stream'
import { createSimState } from '../../sim/sim'

// Deterministic randomness for the stream's wobbles.
function seeded(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const OUTLET = new THREE.Vector3(0, -3, -0.2)

function setup(flowRate) {
  const stream = createStream(seeded(7))
  const jet = new THREE.Mesh(stream.jetGeo)
  const drops = new THREE.InstancedMesh(stream.dropGeo, stream.dropMaterial, stream.maxDrops)
  const sim = createSimState()
  sim.flowRate = flowRate
  let time = 0
  const play = (seconds) => {
    for (let f = 0; f < seconds * 60; f++) {
      time += 1 / 60
      stream.update(sim, 1 / 60, time, OUTLET, jet, drops)
    }
  }
  // Each ring's centre height and mean radius, from the outlet down.
  const rings = () => {
    const pos = stream.jetGeo.attributes.position
    const out = []
    for (let k = 0; k < pos.count / 12; k++) {
      const c = new THREE.Vector3()
      for (let j = 0; j < 12; j++) c.add(new THREE.Vector3().fromBufferAttribute(pos, k * 12 + j))
      c.divideScalar(12)
      let r = 0
      for (let j = 0; j < 12; j++) r += Math.hypot(pos.getX(k * 12 + j) - c.x, pos.getZ(k * 12 + j) - c.z)
      out.push({ x: c.x, y: c.y, z: c.z, r: r / 12 })
    }
    return out
  }
  // How far the jet's tip ends up from straight below its start.
  const sideways = () => {
    const r = rings()
    return Math.hypot(r.at(-1).x - r[0].x, r.at(-1).z - r[0].z)
  }
  return { stream, sim, jet, drops, play, rings, sideways }
}

describe('urine stream', () => {
  it('comes out of the opening, from just inside it, and thins as it falls', () => {
    const { jet, play, rings } = setup(40)
    play(1)
    expect(jet.visible).toBe(true)
    const r = rings()
    expect(r[0].y).toBeGreaterThan(OUTLET.y)
    expect(r[0].y).toBeLessThan(OUTLET.y + 0.3)
    expect(r[0].r).toBeGreaterThan(0.1)
    expect(r[37].r).toBeLessThan(r[0].r)
    expect(OUTLET.y - r.at(-1).y).toBeGreaterThan(2.5)
  })

  // How far below the opening the jet's end is, once it's running.
  const reach = (q) => {
    const { play, rings } = setup(q)
    play(1)
    return OUTLET.y - rings().at(-1).y
  }
  // How far the fluid falls in the first moments after it leaves: the front of a new jet.
  const frontAfter = (q, seconds) => {
    const { play, rings } = setup(q)
    play(seconds)
    return OUTLET.y - Math.min(...rings().filter((ring) => ring.r > 0.001).map((ring) => ring.y))
  }

  it('has the strength of a hose (requested): the front of the jet shoots out, far and fast', () => {
    expect(frontAfter(40, 0.1)).toBeGreaterThan(2) // a good way down the screen in a tenth of a second
    expect(frontAfter(160, 0.1)).toBeGreaterThan(frontAfter(40, 0.1))
    expect(reach(160)).toBeGreaterThan(reach(40))
    expect(reach(40)).toBeGreaterThan(reach(12))
  })

  it('runs nearly straight at a strong flow; a weak one wanders', () => {
    const offStraight = (q) => {
      const { play, rings, sideways } = setup(q)
      play(1)
      return sideways() / (OUTLET.y - rings().at(-1).y)
    }
    expect(offStraight(160)).toBeLessThan(0.15)
    expect(offStraight(3)).toBeGreaterThan(offStraight(160))
  })

  it('never outgrows the opening, however much is pushing out', () => {
    const widest = (q) => {
      const { play, rings } = setup(q)
      play(0.5)
      return rings()[0].r
    }
    expect(widest(160)).toBeGreaterThan(widest(40))
    expect(widest(3000)).toBeLessThan(0.21)
  })

  it('carries when each bit of it left the opening down the jet, for the streaks to race with it', () => {
    const { play, stream } = setup(40)
    play(1)
    const flow = stream.jetGeo.attributes.aFlow
    const leftAt = (ring) => flow.getX(ring * 12)
    const before = [leftAt(0), leftAt(20), leftAt(47)]
    expect(before[0]).toBeGreaterThan(before[1]) // the outlet's left last
    expect(before[1]).toBeGreaterThan(before[2])
    play(0.5)
    expect(leftAt(20)).toBeCloseTo(before[1] + 0.5, 1)
    expect(flow.getY(0)).toBe(0)
    expect(flow.getY(47 * 12)).toBe(1)
  })

  it('gets further down the screen on an overfilled bladder, as the view backs off', () => {
    const { stream, jet, drops, sim, rings } = setup(160)
    for (let f = 1; f <= 60; f++) stream.update(sim, 1 / 60, f / 60, OUTLET, jet, drops, 2)
    expect(OUTLET.y - rings().at(-1).y).toBeGreaterThan(reach(160) * 1.5)
  })

  it('takes its colour from how hydrated it is, in the jet and the drops', () => {
    const { stream } = setup(40)
    stream.setHydration(1)
    const pale = stream.jetMaterial.uniforms.uColor.value.clone()
    expect(stream.dropMaterial.color.getHex()).toBe(pale.getHex())
    stream.setHydration(0.3)
    const dark = stream.jetMaterial.uniforms.uColor.value
    expect(dark.g).toBeLessThan(pale.g)
    expect(stream.dropMaterial.color.getHex()).toBe(dark.getHex())
  })

  it('breaks into falling drops', () => {
    const { drops, play } = setup(20)
    play(1)
    expect(drops.visible).toBe(true)
    expect(drops.count).toBeGreaterThan(10)
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    for (let i = 0; i < drops.count; i++) {
      drops.getMatrixAt(i, m)
      p.setFromMatrixPosition(m)
      expect(p.y).toBeLessThan(OUTLET.y)
    }
  })

  it('never holds the same shape: the flow, aim and twist wander', () => {
    const { play, rings } = setup(20)
    play(1)
    const a = rings()
    play(0.25)
    const b = rings()
    const diff = Math.max(...a.map((ring, k) => Math.abs(ring.r - b[k].r)))
    expect(diff).toBeGreaterThan(0.005)
  })

  it('dribbles when the flow is weak: a short jet, few drops', () => {
    const { play, rings, drops } = setup(1.6)
    play(1)
    expect(OUTLET.y - rings().at(-1).y).toBeLessThan(0.8)
    expect(drops.count).toBeLessThan(15)
  })

  it('falls away and is gone soon after the flow stops', () => {
    const { sim, jet, drops, play } = setup(20)
    play(1)
    sim.flowRate = 0
    play(1.5)
    expect(jet.visible).toBe(false)
    expect(drops.visible).toBe(false)
  })

  it('a leak comes out in spurts', () => {
    const { sim, play, rings } = setup(12)
    sim.isStressLeaking = true
    const tops = []
    for (let i = 0; i < 60; i++) {
      play(1 / 60)
      tops.push(rings()[0].r)
    }
    expect(Math.min(...tops)).toBeLessThan(0.005) // gaps between spurts
    expect(Math.max(...tops)).toBeGreaterThan(0.03)
  })
})
