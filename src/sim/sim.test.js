import { describe, expect, it } from 'vitest'
import {
  ALCOHOL, CAFFEINE, cough, createSimState, FAILURE_PRESSURE, ingestBeverage, LEAK_FLOW, PEAK_FLOW, resetOrgan,
  RESEAL_STRAIN, SANDBOX_RULES, soothe, startClench, startCommuteChallenge, startPrecisionChallenge, startVoidAttempt,
  stepSim, stopClench, stopVoidAttempt, voidFlow,
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
const expectedPressure = (fill) => 4.0 + Math.pow(fill, 3.0) * 80.0

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
  kegelFatigueRate: 0.11, // the original's 0.22, drains 2x slower
  baseDrip: 1 / 30, // the original's 1 ml/s: 1 ml every 30 s
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
  it.each([0.2, 0.5, 0.8, 1.0])('stays low early and rises steeply near capacity (requested) at fill %s', (fill) => {
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
  it('drains 0.11/s while clenching (2x slower than the original) and recovers 0.64/s after (4x faster)', () => {
    const sim = quietSim(150)
    startClench(sim, [])
    run(sim, 1)
    expect(sim.kegelStamina).toBeCloseTo(0.89, 6)

    sim.isClenching = false
    run(sim, 0.1)
    expect(sim.kegelStamina).toBeCloseTo(0.954, 6)
    run(sim, 1)
    expect(sim.kegelStamina).toBe(1)
  })

  it('a full hold lasts about 9 s', () => {
    const sim = quietSim(150)
    startClench(sim, [])
    run(sim, 8.8)
    expect(sim.isClenching).toBe(true)
    run(sim, 0.2)
    expect(sim.isClenching).toBe(false)
  })

  it('eases the sphincter strain the longer it is held (requested)', () => {
    const sim = quietSim(150)
    sim.sphincterToneStrain = 0.6
    startClench(sim, [])
    run(sim, 1)
    expect(sim.sphincterToneStrain).toBeCloseTo(0.5, 6)
    run(sim, 2)
    expect(sim.sphincterToneStrain).toBeCloseTo(0.3, 6)

    // Letting go keeps the relief but adds no more.
    sim.isClenching = false
    run(sim, 2)
    expect(sim.sphincterToneStrain).toBeCloseTo(0.3, 6)
  })

  it('gives out when exhausted and clears the label above 15%', () => {
    const sim = quietSim(150)
    startClench(sim, [])
    const events = run(sim, 10, { until: (s) => s.clenchExhausted })
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

  it('stops by itself at 10 ml', () => {
    const sim = quietSim(300)
    startVoidAttempt(sim, [])
    const events = run(sim, 30, { until: (s) => !s.isAttemptingVoid })
    expect(sim.volume).toBeLessThanOrEqual(10)
    expect(types(events)).toContain('voidStop')
  })

  it('peaks at 20 ml/s and slows over the last ~150 ml (requested)', () => {
    expect(voidFlow(500, 1)).toBe(PEAK_FLOW)
    expect(voidFlow(160, 1)).toBe(PEAK_FLOW)
    expect(voidFlow(85, 1)).toBeCloseTo(PEAK_FLOW * Math.sqrt(0.5), 9)
    expect(voidFlow(20, 1)).toBeLessThan(6)
    expect(voidFlow(10, 1)).toBeGreaterThan(0) // a last dribble, never stuck

    const sim = quietSim(500)
    startVoidAttempt(sim, [])
    let peak = 0
    run(sim, 60, { until: (s) => { peak = Math.max(peak, s.flowRate); return !s.isAttemptingVoid } })
    expect(peak).toBeCloseTo(PEAK_FLOW, 1)
  })

  it('eases the sphincter strain while it flows', () => {
    const sim = quietSim(400)
    sim.sphincterToneStrain = 0.8
    startVoidAttempt(sim, [])
    run(sim, 1) // latency
    run(sim, 2)
    expect(sim.sphincterToneStrain).toBeCloseTo(0.3, 1)
  })
})

describe('sphincter strain (requested)', () => {
  it('rises with a cough, more the fuller the bladder, without leaking below 100 %', () => {
    const strainAfterCough = (volume) => {
      const sim = quietSim(volume)
      const events = []
      cough(sim, events, fixed(0.5))
      events.push(...run(sim, 1))
      expect(types(events)).not.toContain('leakStart')
      return sim.sphincterToneStrain
    }
    const half = strainAfterCough(375)
    const full = strainAfterCough(600)
    expect(half).toBeGreaterThan(0.02)
    expect(full).toBeGreaterThan(0.1)
    expect(full).toBeLessThan(0.2)
    expect(full).toBeGreaterThan(half * 2)
  })

  it('a clench braces against most of a cough', () => {
    const sim = quietSim(600)
    startClench(sim, [])
    sim.kegelReliefRate = 0 // measure the brace alone
    cough(sim, [], fixed(0.5))
    run(sim, 1)
    expect(sim.sphincterToneStrain).toBeLessThan(0.05)
    expect(sim.sphincterToneStrain).toBeGreaterThan(0)
  })

  it('rises through an unclenched urge wave', () => {
    const sim = quietSim(600) // 80 % full
    sim.urgeWaveTimer = 0
    run(sim, 5)
    expect(sim.sphincterToneStrain).toBeGreaterThan(0.2)
    expect(sim.sphincterToneStrain).toBeLessThan(0.4)
  })

  it('rises under a squeeze', () => {
    const sim = quietSim(600)
    sim.squeezeAmountY = sim.targetSqueezeY = 0.5
    run(sim, 2)
    expect(sim.sphincterToneStrain).toBeGreaterThan(0.1)
  })
})

describe('stress leaks', () => {
  it('only start at 100 % strain: a spurt at 12 ml/s', () => {
    const sim = quietSim(600)
    sim.sphincterToneStrain = 0.99
    expect(types(run(sim, 0.5))).not.toContain('leakStart')

    sim.sphincterToneStrain = 1.0
    const events = run(sim, DT)
    expect(types(events)).toContain('leakStart')
    expect(sim.isStressLeaking).toBe(true)
    expect(sim.flowRate).toBe(LEAK_FLOW)
  })

  it('stop at the target loss and the sphincter regains some grip', () => {
    const sim = quietSim(600)
    sim.sphincterToneStrain = 1.0
    const events = run(sim, 5, { until: (s, e) => types(e).includes('leakEnd') })
    expect(types(events)).toContain('leakEnd')
    expect(sim.totalLeakedVolume).toBeCloseTo(35, 0) // 25 + 0.5·20
    expect(sim.sphincterToneStrain).toBe(RESEAL_STRAIN)
  })

  it('a clench at 100 % holds the leak back, and shuts one already running', () => {
    const sim = quietSim(600)
    sim.sphincterToneStrain = 1.0
    startClench(sim, [])
    expect(types(run(sim, 0.5))).not.toContain('leakStart')

    stopClench(sim, [])
    sim.sphincterToneStrain = 1.0
    run(sim, 0.5)
    expect(sim.isStressLeaking).toBe(true)
    startClench(sim, [])
    const events = run(sim, DT)
    expect(types(events)).toContain('leakEnd')
    expect(sim.isStressLeaking).toBe(false)
  })

  it('holding a clench at 100 % against more strain burns stamina fast', () => {
    const calm = quietSim(700)
    calm.sphincterToneStrain = 1.0
    calm.kegelReliefRate = 0
    startClench(calm, [])
    run(calm, 1)

    const pushed = quietSim(700)
    pushed.sphincterToneStrain = 1.0
    pushed.kegelReliefRate = 0
    startClench(pushed, [])
    pushed.squeezeAmountY = pushed.targetSqueezeY = 0.6
    run(pushed, 1)
    expect(pushed.kegelStamina).toBeLessThan(calm.kegelStamina - 0.1)
  })
})

describe('total sphincter failure', () => {
  it('replaces the spurt at 100 % strain above 65 cmH2O, drains to 70 ml as leaked, then recovers', () => {
    const sim = quietSim(700)
    sim.sphincterToneStrain = 1.0
    const first = run(sim, DT)
    expect(sim.pressure).toBeGreaterThan(FAILURE_PRESSURE)
    expect(types(first)).toContain('failureStart')
    expect(types(first)).not.toContain('leakStart')

    run(sim, DT)
    expect(sim.flowRate).toBeCloseTo(PEAK_FLOW, 6)

    const events = run(sim, 60, { until: (s) => !s.involuntaryVoiding })
    expect(types(events)).toContain('failureEnd')
    expect(sim.volume).toBeLessThanOrEqual(70)
    expect(sim.volume).toBeGreaterThan(69)
    expect(sim.totalLeakedVolume).toBeCloseTo(700 - sim.volume, 3)
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

  it('calm down under a held clench and pass early (freeze and squeeze)', () => {
    const sim = quietSim(600)
    sim.urgeWaveTimer = 0
    run(sim, 0.5)
    expect(sim.detrusorSpasmIntensity).toBeCloseTo(1, 6)
    startClench(sim, [])
    // 0.7/s calms a full spasm in ~1.4 s, well before the wave's 3.5 s are up.
    expect(types(run(sim, 1.3))).not.toContain('urgeEnd')
    expect(run(sim, 0.2)).toContainEqual({ type: 'urgeEnd', suppressed: true })
    expect(sim.isUrgeWaveActive).toBe(false)
    expect(sim.detrusorSpasmIntensity).toBe(0)
  })

  it('pass at once when the clench is already held as they land', () => {
    const sim = quietSim(600)
    startClench(sim, [])
    sim.urgeWaveTimer = 0
    const events = run(sim, DT)
    expect(types(events)).toEqual(expect.arrayContaining(['urgeStart', 'urgeEnd']))
    expect(sim.detrusorSpasmIntensity).toBe(0)
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
  it('water adds 180 ml at 8 ml/s on top of the 1 ml / 30 s drip', () => {
    const sim = createSimState()
    ingestBeverage(sim, [], 'water', fixed(0.5))
    run(sim, 10)
    expect(sim.volume).toBeCloseTo(120 + 80 + 10 / 30, 3)
    run(sim, 20)
    expect(sim.activeBeverages).toHaveLength(0)
    expect(sim.volume).toBeCloseTo(120 + 180 + 1, 3)
  })
})

describe('soothe', () => {
  it('works whenever in the sandbox, and waits out a cooldown where the rules set one', () => {
    const sim = quietSim(400)
    sim.sphincterToneStrain = 0.9
    soothe(sim, [])
    soothe(sim, [])
    expect(sim.sphincterToneStrain).toBeCloseTo(0.2, 6)

    sim.sootheCooldownTime = 20
    sim.sphincterToneStrain = 0.9
    soothe(sim, [])
    const out = []
    soothe(sim, out)
    expect(out).toEqual([])
    expect(sim.sphincterToneStrain).toBeCloseTo(0.55, 6)
    run(sim, 20.1)
    soothe(sim, out)
    expect(types(out)).toEqual(['soothe'])
  })
})

describe('reset', () => {
  it('empties to 40 ml and clears everything', () => {
    const sim = quietSim(700)
    Object.assign(sim, {
      sphincterToneStrain: 0.8, totalLeakedVolume: 50, isUrgeWaveActive: true, activeChallenge: 'arcade',
      arcade: { score: 10 }, idleClenchCost: 3, leakGraceTime: 0.6, urgeWarned: true,
    })
    const out = []
    resetOrgan(sim, out, fixed(0.5))
    expect(sim).toMatchObject({
      volume: 40, sphincterToneStrain: 0, totalLeakedVolume: 0, isUrgeWaveActive: false, activeChallenge: null,
      arcade: null, urgeWarned: false, ...SANDBOX_RULES,
    })
    expect(types(out)).toEqual(['reset', 'agitation'])
  })
})

describe('challenge start', () => {
  it.each([['commute', startCommuteChallenge], ['precision', startPrecisionChallenge]])(
    '%s resets the organ first',
    (_, start) => {
      const out = []
      start(createSimState(), out, fixed(0.5))
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

describe('what drinks do besides fill it (A10)', () => {
  it('caffeine and alcohol build up with each drink, up to a limit, and fade', () => {
    const sim = quietSim(200)
    ingestBeverage(sim, [], 'coffee', fixed(0.5))
    ingestBeverage(sim, [], 'water', fixed(0.5))
    expect(sim.caffeine).toBe(CAFFEINE.dose)
    expect(sim.alcohol).toBe(0)
    for (let i = 0; i < 5; i++) ingestBeverage(sim, [], 'whisky', fixed(0.5))
    expect(sim.alcohol).toBe(ALCOHOL.most)
    run(sim, 30)
    expect(sim.caffeine).toBeCloseTo(CAFFEINE.dose - 30 * CAFFEINE.fade, 6)
    resetOrgan(sim, [], fixed(0.5))
    expect([sim.caffeine, sim.alcohol]).toEqual([0, 0])
  })

  // Seconds until `until` is true, stepping a sim set up by `setup`.
  const secondsUntil = (setup, until) => {
    const sim = quietSim(500)
    setup(sim)
    let t = 0
    run(sim, 20, { until: (s, e) => { t += DT; return until(s, e) } })
    return t
  }
  const waveStarts = (s, e) => e.some((x) => x.type === 'urgeStart')

  it('caffeine brings the next urge wave sooner', () => {
    const withCaffeine = (caffeine) => secondsUntil((sim) => Object.assign(sim, { caffeine, urgeWaveTimer: 10 }), waveStarts)
    expect(withCaffeine(0)).toBeCloseTo(10, 0)
    expect(withCaffeine(1)).toBeLessThan(7.5)
  })

  it('leaves an announced wave its full warning', () => {
    const sim = quietSim(500)
    Object.assign(sim, { urgeWarningTime: 1.2, caffeine: 1.5, urgeWaveTimer: 3 })
    let warnedAt = null
    let t = 0
    run(sim, 10, {
      until: (s, e) => {
        t += DT
        if (warnedAt === null && e.some((x) => x.type === 'urgeWarning')) warnedAt = t
        return e.some((x) => x.type === 'urgeStart')
      },
    })
    expect(t - warnedAt).toBeCloseTo(1.2, 1)
  })

  it('alcohol tires the clench', () => {
    const holdFor = (alcohol) => secondsUntil((sim) => {
      sim.alcohol = alcohol
      startClench(sim, [])
    }, (s) => !s.isClenching)
    expect(holdFor(0)).toBeGreaterThan(8)
    expect(holdFor(1)).toBeLessThan(holdFor(0) * 0.7)
  })
})
