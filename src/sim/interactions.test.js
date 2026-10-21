import { describe, expect, it } from 'vitest'
import { createSimState, fillPressure, MAX_RIPPLES, stepSim, TOUCH_PRESSURE } from './sim'
import { orbitDrag, pokeAt, slapAt, slapRandom, squeezeCancel, squeezeDrag, squeezeRelease, squeezeStart } from './interactions'
import { extractOriginalConst } from '../test/original'

const SQUISH_FORCE = extractOriginalConst('PHYSICS_CONFIGS').jello.squishForce // 2.2

describe('poke (original pokeBladder)', () => {
  it('adds 5 % strain (requested), slosh 2.5×strength and jiggle 0.3×strength', () => {
    const sim = createSimState()
    const out = []
    pokeAt(sim, out, { x: 1, y: 0.5, z: -2 }, SQUISH_FORCE, { touch: true })

    expect(sim.sphincterToneStrain).toBeCloseTo(0.05, 9)
    // First impulse opposes zero velocity, so the original's 0.85 boost applies.
    expect(sim.sloshVelX).toBeCloseTo(1 * 2.5 * SQUISH_FORCE * 0.85, 9)
    expect(sim.sloshVelZ).toBeCloseTo(-2 * 2.5 * SQUISH_FORCE * 0.85, 9)
    expect(sim.fluidCoreVelocity.x).toBeCloseTo(-1 * 2.5 * SQUISH_FORCE * 0.45, 9)
    expect(sim.jiggleIntensity).toBeCloseTo(0.66, 9)
    expect(out).toEqual([{ type: 'poke', local: { x: 1, y: 0.5, z: -2 }, strength: SQUISH_FORCE, touch: true }])
  })

  it('20 pokes strain the sphincter to its limit', () => {
    const sim = createSimState()
    for (let i = 0; i < 19; i++) pokeAt(sim, [], { x: 0, y: 0, z: 2 }, 2.2)
    expect(sim.sphincterToneStrain).toBeLessThan(1)
    pokeAt(sim, [], { x: 0, y: 0, z: 2 }, 2.2)
    expect(sim.sphincterToneStrain).toBeCloseTo(1, 9)
  })

  it('a drag step adds the share of strain it is given', () => {
    const sim = createSimState()
    pokeAt(sim, [], { x: 0, y: 0, z: 2 }, 0.7, { strain: 0.01 })
    expect(sim.sphincterToneStrain).toBeCloseTo(0.01, 9)
  })
})

describe('slap (original slapBladder)', () => {
  it('adds 5 % strain (requested) and a ripple at the hit point', () => {
    const sim = createSimState()
    const out = []
    slapAt(sim, out, { x: 2, y: 0, z: 0 }, 2.0, { haptic: true })

    expect(sim.sphincterToneStrain).toBeCloseTo(0.05, 9)
    expect(sim.ripples).toEqual([{ center: { x: 2, y: 0, z: 0 }, radius: 0.1, maxRadius: 3.8, speed: 7.5, amplitude: 1.3, decay: 3.5 }])
    expect(sim.sloshVelX).toBeCloseTo(2 * 4.0 * 2.0 * 0.85, 9)
    expect(sim.jiggleIntensity).toBe(1)
    expect(out[0]).toMatchObject({ type: 'slap', strength: 2.0, haptic: true })
  })

  it('the Slap button hits the equator at strength 2.4 without vibrating', () => {
    const sim = createSimState()
    const out = []
    slapRandom(sim, out, () => 0.25)
    expect(out[0].local.x).toBeCloseTo(0, 9)
    expect(out[0].local.z).toBeCloseTo(2.2, 9)
    expect(out[0].local.y).toBeCloseTo(-0.2, 9)
    expect(out[0]).toMatchObject({ strength: 2.4, haptic: false })
  })

  it('keeps at most a dozen ripples running, the newest (C12)', () => {
    const sim = createSimState()
    for (let i = 0; i < 40; i++) slapAt(sim, [], { x: i, y: 0, z: 0 }, 2.0)
    expect(sim.ripples).toHaveLength(MAX_RIPPLES)
    expect(sim.ripples.at(-1).center.x).toBe(39)
    expect(sim.ripples[0].center.x).toBe(40 - MAX_RIPPLES)
  })

  it('twenty slaps on a full bladder end in total failure', () => {
    const sim = createSimState()
    sim.volume = 700
    for (let i = 0; i < 19; i++) slapAt(sim, [], { x: 0, y: 0, z: 2.2 }, 2.4)
    stepSim(sim, 1 / 60, [], () => 0.5)
    expect(sim.involuntaryVoiding).toBe(false)
    slapAt(sim, [], { x: 0, y: 0, z: 2.2 }, 2.4)
    stepSim(sim, 1 / 60, [], () => 0.5)
    expect(sim.involuntaryVoiding).toBe(true)
  })
})

describe('squeeze', () => {
  it('starts at 0.35, builds with drag up to 0.65 and lets go on release', () => {
    const sim = createSimState()
    squeezeStart(sim, [])
    expect(sim.targetSqueezeY).toBe(0.35)
    squeezeDrag(sim, [], 10, 20) // +0.08 +0.02
    expect(sim.targetSqueezeY).toBeCloseTo(0.45, 9)
    squeezeDrag(sim, [], 0, 500)
    expect(sim.targetSqueezeY).toBe(0.65)

    const out = []
    squeezeRelease(sim, out)
    expect(sim.targetSqueezeY).toBe(0)
    expect(out).toEqual([{ type: 'squeezeRelease' }])
  })

  it('a cancelled touch lets go silently', () => {
    const sim = createSimState()
    sim.targetSqueezeY = 0.5
    squeezeCancel(sim)
    expect(sim.targetSqueezeY).toBe(0)
  })
})

describe('orbit', () => {
  it('dragging the camera sloshes the fluid', () => {
    const sim = createSimState()
    orbitDrag(sim, [], 20, -10)
    expect(sim.sloshVelX).toBeCloseTo(20 * 0.15 * 0.85, 9)
    expect(sim.sloshVelZ).toBeCloseTo(-10 * 0.15 * 0.85, 9)
  })
})

describe('a full bladder is taut (E)', () => {
  const DT = 1 / 60
  const settled = (volume) => {
    const sim = createSimState()
    sim.baseDrip = 0
    sim.volume = volume
    stepSim(sim, DT, [])
    return sim
  }

  it('jolts the pressure for a moment when poked or slapped full, hardly at all empty, and strains it no more', () => {
    const full = settled(700)
    const base = full.pressure
    pokeAt(full, [], { x: 0, y: 0, z: 2 }, 2.2, { touch: true })
    stepSim(full, DT, [])
    expect(full.pressure - base).toBeGreaterThan(TOUCH_PRESSURE * 0.75)
    expect(full.sphincterToneStrain).toBeCloseTo(0.05, 9)
    for (let i = 0; i < 60; i++) stepSim(full, DT, [])
    expect(full.pressure - base).toBeLessThan(0.05)

    const empty = settled(100)
    slapAt(empty, [], { x: 0, y: 0, z: 2 }, 2.4)
    stepSim(empty, DT, [])
    expect(empty.pressure - fillPressure(100 / 750)).toBeLessThan(TOUCH_PRESSURE * 0.02)
    expect(empty.sphincterToneStrain).toBeCloseTo(0.05, 9)
  })

  it("never turns a spurt into a total failure: the poke that tips the strain to 100 % leaks a spurt", () => {
    const sim = settled(666) // 60 cmH2O: a poke's jolt takes it past the failure threshold (65)
    sim.sphincterToneStrain = 0.97
    pokeAt(sim, [], { x: 0, y: 0, z: 2 }, 2.2, { touch: true })
    const events = []
    stepSim(sim, DT, events)
    expect(sim.pressure).toBeGreaterThan(65)
    expect(events.map((e) => e.type)).toContain('leakStart')
    expect(events.map((e) => e.type)).not.toContain('failureStart')
  })
})

