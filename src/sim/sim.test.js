import { describe, expect, it } from 'vitest'
import {
  ambientVoiceCategory, cough, createSimState, ingestBeverage, resetOrgan, startClench,
  startCommuteChallenge, startPrecisionChallenge, startVoidAttempt, stepSim, stopVoidAttempt,
} from './sim'
import { extractOriginalConst } from '../test/original'

const DT = 1 / 60
const fixed = (value) => () => value

// Steps the sim for `seconds` and returns every event emitted along the way.
function run(sim, seconds, { dt = DT, rng = fixed(0.5), until } = {}) {
  const events = []
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    stepSim(sim, dt, events, rng)
    if (until?.(sim, events)) break
  }
  return events
}

const types = (events) => events.map((e) => e.type)
const expectedPressure = (fill) => 4.0 + Math.pow(fill, 2.6) * 56.0

// A quiet bladder: no kidney drip, so volume only changes when the test says so.
function quietSim(volume) {
  const sim = createSimState()
  sim.baseDrip = 0
  sim.volume = volume
  return sim
}

// Deliberate departures from the original, each one requested.
const CHANGED_FROM_ORIGINAL = {
  kegelRecoverRate: 0.64, // the original's 0.16, made 4x faster
}

describe('initial state', () => {
  it('matches every shared field of the original `sim`, apart from the requested changes', () => {
    const original = extractOriginalConst('sim')
    const port = createSimState()
    const shared = Object.keys(original).filter((key) => key in port)
    expect(shared.length).toBeGreaterThan(40)
    for (const key of shared) {
      if (key in CHANGED_FROM_ORIGINAL) {
        expect(original[key], key).not.toEqual(CHANGED_FROM_ORIGINAL[key])
        expect(port[key], key).toEqual(CHANGED_FROM_ORIGINAL[key])
      } else {
        expect(port[key], key).toEqual({ ...original }[key])
      }
    }
  })
})

describe('pressure', () => {
  it.each([0.2, 0.5, 0.8, 1.0])('follows the original curve at fill %s', (fill) => {
    const sim = quietSim(750 * fill)
    run(sim, DT)
    expect(sim.pressure).toBeCloseTo(expectedPressure(fill), 6)
  })

  it('adds 38 cmH2O for a cough, decaying at 3.5/s', () => {
    const sim = quietSim(150)
    cough(sim, [], fixed(0.5))
    run(sim, DT)
    expect(sim.pressure).toBeCloseTo(expectedPressure(0.2) + 38 * (1 - 3.5 * DT), 6)
  })
})

describe('kegel stamina', () => {
  it('drains 0.22/s while clenching and recovers 0.64/s after (4x the original)', () => {
    const sim = quietSim(150)
    startClench(sim, [])
    run(sim, 1)
    expect(sim.kegelStamina).toBeCloseTo(0.78, 6)

    sim.isClenching = false
    run(sim, 0.25)
    expect(sim.kegelStamina).toBeCloseTo(0.94, 6)
    run(sim, 1)
    expect(sim.kegelStamina).toBe(1)
  })

  it('gives out when exhausted and clears the label above 15%', () => {
    const sim = quietSim(150)
    startClench(sim, [])
    const events = run(sim, 6, { until: (s) => s.clenchExhausted })
    expect(types(events)).toContain('clenchExhausted')
    expect(sim.isClenching).toBe(false)
    expect(sim.clenchExhausted).toBe(true)

    run(sim, 0.1)
    expect(sim.clenchExhausted).toBe(true) // ~0.08 stamina, still below 15%
    run(sim, 0.2)
    expect(sim.clenchExhausted).toBe(false)
  })

  it('cannot start a clench below 5% stamina', () => {
    const sim = quietSim(150)
    sim.kegelStamina = 0.05
    const out = []
    startClench(sim, out)
    expect(sim.isClenching).toBe(false)
    expect(out).toEqual([])
  })
})

describe('voiding', () => {
  it('starts flowing after exactly 1.0 s of holding', () => {
    const sim = quietSim(400)
    startVoidAttempt(sim, [])
    run(sim, 0.95)
    expect(sim.isActivelyVoiding).toBe(false)
    const events = run(sim, 0.1)
    expect(sim.isActivelyVoiding).toBe(true)
    expect(types(events)).toContain('voidStart')
  })

  it('cannot start while clenching', () => {
    const sim = quietSim(400)
    startClench(sim, [])
    startVoidAttempt(sim, [])
    expect(sim.isAttemptingVoid).toBe(false)
  })

  it('stops by itself at 10 ml and says a deflated line', () => {
    const sim = quietSim(300)
    startVoidAttempt(sim, [])
    const events = run(sim, 30, { until: (s) => !s.isAttemptingVoid })
    expect(sim.volume).toBeLessThanOrEqual(10)
    expect(types(events)).toContain('voidStop')
    expect(events).toContainEqual({ type: 'voice', category: 'deflated' })
  })
})

describe('stress leaks', () => {
  it('leak when pressure beats the sphincter above 50% fill', () => {
    const sim = quietSim(600) // fill 0.8: ~32 cmH2O, a cough adds 38
    cough(sim, [], fixed(0.5))
    const events = run(sim, DT)
    expect(types(events)).toContain('leakStart')
    expect(sim.isStressLeaking).toBe(true)
    expect(sim.sphincterToneStrain).toBeCloseTo(0.25, 6)
    expect(sim.flowRate).toBe(18)
  })

  it('never leak at or below 50% fill, however high the pressure', () => {
    const sim = quietSim(337) // fill 0.45
    sim.squeezeAmountY = sim.targetSqueezeY = 0.65
    cough(sim, [], fixed(0.5))
    run(sim, DT)
    expect(sim.pressure).toBeGreaterThan(50)
    expect(sim.isStressLeaking).toBe(false)
  })

  it('a clench raises the threshold 2.5x and blocks the same cough', () => {
    const sim = quietSim(600)
    startClench(sim, [])
    cough(sim, [], fixed(0.5))
    run(sim, DT)
    expect(sim.isStressLeaking).toBe(false)
  })

  it('lose 22 ml/s until the target loss is reached', () => {
    const sim = quietSim(600)
    cough(sim, [], fixed(0.5))
    const events = run(sim, 3, { until: (s) => !s.isStressLeaking })
    expect(types(events)).toContain('leakEnd')
    // Pressure drops below the reseal threshold well before the 35 ml target.
    expect(sim.totalLeakedVolume).toBeGreaterThan(0)
    expect(sim.totalLeakedVolume).toBeLessThanOrEqual(35 + 22 * DT)
  })
})

describe('total sphincter failure', () => {
  it('starts at full strain above 65 cmH2O, drains to 70 ml, then recovers', () => {
    const sim = quietSim(700)
    sim.sphincterToneStrain = 1.0
    cough(sim, [], fixed(0.5))
    const first = run(sim, DT)
    expect(types(first)).toContain('failureStart')
    expect(sim.flowRate).toBe(28)

    const events = run(sim, 40, { until: (s) => !s.involuntaryVoiding })
    expect(types(events)).toContain('failureEnd')
    expect(sim.volume).toBeLessThanOrEqual(70)
    expect(sim.volume).toBeGreaterThan(69)
    expect(sim.sphincterToneStrain).toBe(0)
    expect(sim.kegelStamina).toBe(1)
  })
})

describe('urge waves', () => {
  it('arrive within 18 s once over 45% full and add up to 24 cmH2O', () => {
    const sim = quietSim(375) // fill 0.5
    const events = run(sim, 18.1, { until: (s) => s.isUrgeWaveActive })
    expect(types(events)).toContain('urgeStart')
    run(sim, 0.5)
    expect(sim.detrusorSpasmIntensity).toBeCloseTo(1, 6)
    expect(sim.pressure).toBeCloseTo(expectedPressure(0.5) + 24, 6)

    const ending = run(sim, 3.1)
    expect(types(ending)).toContain('urgeEnd')
    expect(sim.urgeWaveTimer).toBeGreaterThan(0)
  })

  it('come sooner as the bladder fills (18 s → 7 s)', () => {
    const sim = quietSim(600)
    sim.urgeWaveTimer = 0
    run(sim, DT)
    expect(sim.urgeWaveTimer).toBeCloseTo(18 + (7 - 18) * 0.8, 6)
  })

  it('never start at or below 45% full', () => {
    const sim = quietSim(300) // fill 0.4
    const events = run(sim, 30)
    expect(types(events)).not.toContain('urgeStart')
    expect(sim.detrusorSpasmIntensity).toBe(0)
  })
})

describe('tension creaks', () => {
  it('sound above 46 cmH2O with a 2–4 s cooldown', () => {
    const sim = quietSim(740)
    const events = run(sim, 1, { rng: fixed(0.9) })
    expect(types(events).filter((t) => t === 'creak')).toHaveLength(1)
    expect(sim.creakCooldown).toBeGreaterThan(2.5)
  })
})

describe('drinks', () => {
  it('water adds 180 ml at 8 ml/s on top of the 1 ml/s drip', () => {
    const sim = createSimState()
    ingestBeverage(sim, [], 'water', fixed(0.5))
    run(sim, 10)
    expect(sim.volume).toBeCloseTo(120 + 80 + 10, 3)
    run(sim, 20)
    expect(sim.activeBeverages).toHaveLength(0)
    expect(sim.volume).toBeCloseTo(120 + 180 + 30, 3)
  })
})

describe('reset', () => {
  it('empties to 40 ml, clears everything and says a deflated line', () => {
    const sim = quietSim(700)
    Object.assign(sim, { sphincterToneStrain: 0.8, totalLeakedVolume: 50, isUrgeWaveActive: true, activeChallenge: 'commute' })
    const out = []
    resetOrgan(sim, out, fixed(0.5))
    expect(sim).toMatchObject({ volume: 40, sphincterToneStrain: 0, totalLeakedVolume: 0, isUrgeWaveActive: false, activeChallenge: null })
    expect(types(out)).toEqual(['reset', 'agitation', 'voice'])
    expect(out[2].category).toBe('deflated')
  })
})

describe('challenge start', () => {
  it.each([['commute', startCommuteChallenge], ['precision', startPrecisionChallenge]])(
    '%s resets without the "deflated" line (the bladder is refilled at once)',
    (_, start) => {
      const out = []
      start(createSimState(), out, fixed(0.5))
      expect(out.filter((e) => e.type === 'voice')).toEqual([])
      expect(types(out)).toContain('reset')
    },
  )
})

describe('commute challenge', () => {
  it('fails when the potholes force leaks', () => {
    const sim = createSimState()
    startCommuteChallenge(sim, [], fixed(0.5))
    expect(sim.volume).toBe(580)
    const events = run(sim, 61)
    const result = events.find((e) => e.type === 'challengeResult')
    expect(result).toMatchObject({ challenge: 'commute', success: false })
    expect(result.leaked).toBeGreaterThan(20)
    expect(events.filter((e) => e.type === 'cough').length).toBeGreaterThanOrEqual(6)
    expect(sim.activeChallenge).toBe(null)
  })

  it('is won when nothing leaks in 60 s', () => {
    const sim = createSimState()
    startCommuteChallenge(sim, [], fixed(0.5))
    sim.volume = 100
    const events = run(sim, 61)
    expect(events.find((e) => e.type === 'challengeResult')).toMatchObject({ challenge: 'commute', success: true, leaked: 0 })
  })
})

describe('precision challenge', () => {
  function voidUntil(sim, target) {
    startVoidAttempt(sim, [])
    run(sim, 30, { until: (s) => s.precisionStartVolume - s.volume >= target })
    const out = []
    stopVoidAttempt(sim, out)
    return out.find((e) => e.type === 'challengeResult')
  }

  it('succeeds within ±10 ml of 200 ml', () => {
    const sim = createSimState()
    startPrecisionChallenge(sim, [], fixed(0.5))
    sim.baseDrip = 0
    const result = voidUntil(sim, 200)
    expect(result).toMatchObject({ challenge: 'precision', success: true })
    expect(Math.abs(result.voided - 200)).toBeLessThanOrEqual(10)
  })

  it('fails when stopped too early', () => {
    const sim = createSimState()
    startPrecisionChallenge(sim, [], fixed(0.5))
    sim.baseDrip = 0
    expect(voidUntil(sim, 100)).toMatchObject({ challenge: 'precision', success: false })
  })
})

describe('ambient voice', () => {
  it.each([
    [100, 0, null],
    [200, 0, 'nominal'],
    [400, 0, 'distended'],
    [600, 0, 'full'],
    [700, 0, 'critical'],
    [200, 0.8, 'critical'],
  ])('volume %s ml, strain %s → %s', (volume, strain, category) => {
    const sim = quietSim(volume)
    sim.sphincterToneStrain = strain
    expect(ambientVoiceCategory(sim)).toBe(category)
  })

  it('stays quiet while voiding or leaking', () => {
    const sim = quietSim(700)
    sim.isStressLeaking = true
    expect(ambientVoiceCategory(sim)).toBe(null)
  })
})
