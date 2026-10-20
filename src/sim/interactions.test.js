import { describe, expect, it } from 'vitest'
import { cough, createSimState, stepSim } from './sim'
import { orbitDrag, pokeAt, slapAt, slapRandom, squeezeCancel, squeezeDrag, squeezeRelease, squeezeStart } from './interactions'
import { extractOriginalConst } from '../test/original'

const SQUISH_FORCE = extractOriginalConst('PHYSICS_CONFIGS').jello.squishForce // 2.2

describe('poke (original pokeBladder)', () => {
  it('adds 0.08 strain, slosh 2.5×strength and jiggle 0.3×strength', () => {
    const sim = createSimState()
    const out = []
    pokeAt(sim, out, { x: 1, y: 0.5, z: -2 }, SQUISH_FORCE, { touch: true })

    expect(sim.sphincterToneStrain).toBeCloseTo(0.08, 9)
    // First impulse opposes zero velocity, so the original's 0.85 boost applies.
    expect(sim.sloshVelX).toBeCloseTo(1 * 2.5 * SQUISH_FORCE * 0.85, 9)
    expect(sim.sloshVelZ).toBeCloseTo(-2 * 2.5 * SQUISH_FORCE * 0.85, 9)
    expect(sim.fluidCoreVelocity.x).toBeCloseTo(-1 * 2.5 * SQUISH_FORCE * 0.45, 9)
    expect(sim.jiggleIntensity).toBeCloseTo(0.66, 9)
    expect(out).toEqual([{ type: 'poke', local: { x: 1, y: 0.5, z: -2 }, strength: SQUISH_FORCE, touch: true }])
  })

  it('13 pokes strain the sphincter to its limit', () => {
    const sim = createSimState()
    for (let i = 0; i < 12; i++) pokeAt(sim, [], { x: 0, y: 0, z: 2 }, 0.7)
    expect(sim.sphincterToneStrain).toBeLessThan(1)
    pokeAt(sim, [], { x: 0, y: 0, z: 2 }, 0.7)
    expect(sim.sphincterToneStrain).toBe(1)
  })
})

describe('slap (original slapBladder)', () => {
  it('adds 0.15 strain and a ripple at the hit point', () => {
    const sim = createSimState()
    const out = []
    slapAt(sim, out, { x: 2, y: 0, z: 0 }, 2.0, { haptic: true })

    expect(sim.sphincterToneStrain).toBeCloseTo(0.15, 9)
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

  it('a few slaps on a full bladder can end in total failure', () => {
    const sim = createSimState()
    sim.volume = 700
    for (let i = 0; i < 7; i++) slapAt(sim, [], { x: 0, y: 0, z: 2.2 }, 2.4)
    expect(sim.sphincterToneStrain).toBe(1)
    const out = []
    cough(sim, out, () => 0.5)
    stepSim(sim, 1 / 60, out, () => 0.5)
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
