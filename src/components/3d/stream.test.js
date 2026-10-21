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
  const drops = new THREE.InstancedMesh(stream.dropGeo, stream.material, stream.maxDrops)
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
      out.push({ y: c.y, r: r / 12 })
    }
    return out
  }
  return { sim, jet, drops, play, rings }
}

describe('urine stream', () => {
  it('leaves a single narrow opening and thins as it falls', () => {
    const { jet, play, rings } = setup(20)
    play(1)
    expect(jet.visible).toBe(true)
    const r = rings()
    expect(r[0].y).toBeCloseTo(OUTLET.y, 6)
    expect(r[0].r).toBeGreaterThan(0.04)
    expect(r[0].r).toBeLessThan(0.1) // narrower than the opening (0.075 × 1.45)
    // Thinner at the breakup point than at the outlet; a long jet at full flow.
    expect(r[31].r).toBeLessThan(r[0].r)
    expect(OUTLET.y - r.at(-1).y).toBeGreaterThan(2.5)
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
    expect(OUTLET.y - rings().at(-1).y).toBeLessThan(0.6)
    expect(drops.count).toBeLessThan(12)
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
