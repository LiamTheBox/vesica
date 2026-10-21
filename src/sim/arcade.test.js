import { describe, expect, it } from 'vitest'
import { createSimState, ingestBeverage, resetOrgan, SANDBOX_RULES, startClench, startVoidAttempt, stopClench } from './sim'
import { ARCADE_RULES, fillMultiplier, quitArcadeRun, scoreArcade, startArcadeRun, stepGame } from './arcade'

const DT = 1 / 60
const fixed = (value) => () => value

// Steps the game for `seconds` and returns every event emitted along the way.
function run(sim, seconds, { rng = fixed(0.5), until } = {}) {
  const events = []
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    stepGame(sim, DT, events, rng)
    if (until?.(sim, events)) break
  }
  return events
}

// A player action during a run, scored the way the engine does it.
function play(sim, action, ...args) {
  const out = []
  action(sim, out, ...args)
  scoreArcade(sim, out)
  return out
}

const types = (events) => events.map((e) => e.type)
const points = (events, reason) => events.filter((e) => e.type === 'arcadePoints' && e.reason === reason)

// A run with its drinks and sneezes held off, so a test controls what happens.
function quietRun(volume = 600) {
  const sim = createSimState()
  startArcadeRun(sim, [], fixed(0.5))
  sim.baseDrip = 0
  sim.volume = volume
  sim.arcade.serveTimer = 999
  sim.arcade.sneezeTimer = 999
  return sim
}

describe('starting a run', () => {
  it('resets the organ, sets the arcade rules and announces the start', () => {
    const sim = createSimState()
    sim.sphincterToneStrain = 0.7
    const out = []
    startArcadeRun(sim, out, fixed(0.5))
    expect(sim).toMatchObject({ volume: 300, sphincterToneStrain: 0, activeChallenge: 'arcade', ...ARCADE_RULES })
    expect(sim.arcade).toMatchObject({ score: 0, level: 1, combo: 0 })
    expect(out).toContainEqual({ type: 'challengeStart', challenge: 'arcade' })
    expect(out.filter((e) => e.type === 'voice')).toEqual([])
  })

  it('ends without a result on a reset or when the player quits', () => {
    const sim = quietRun()
    resetOrgan(sim, [], fixed(0.5))
    expect(sim).toMatchObject({ arcade: null, activeChallenge: null, ...SANDBOX_RULES })

    const quit = quietRun()
    const out = []
    quitArcadeRun(quit, out)
    expect(quit).toMatchObject({ arcade: null, activeChallenge: null, ...SANDBOX_RULES })
    expect(types(out)).toEqual(['arcadeQuit'])
  })
})

describe('urge waves', () => {
  it('are announced 1.2 s ahead', () => {
    const sim = quietRun()
    sim.urgeWaveTimer = 2
    const events = run(sim, 0.81)
    expect(types(events)).toContain('urgeWarning')
    expect(sim.urgeWarned).toBe(true)
    expect(types(events)).not.toContain('urgeStart')
    expect(types(run(sim, 1.25))).toContain('urgeStart')
    expect(sim.urgeWarned).toBe(false)
  })

  it('a clench on the warning calms the wave at once: perfect, combo, stamina back', () => {
    const sim = quietRun()
    sim.urgeWaveTimer = 1
    run(sim, 0.1)
    expect(sim.urgeWarned).toBe(true)
    sim.kegelStamina = 0.5
    play(sim, startClench)
    const events = run(sim, 1.5, { until: (s, e) => types(e).includes('urgeEnd') })
    expect(events).toContainEqual({ type: 'urgeEnd', suppressed: true })
    expect(points(events, 'perfect')).toEqual([{ type: 'arcadePoints', reason: 'perfect', points: 50, combo: 1 }])
    expect(sim.kegelStamina).toBeGreaterThan(0.5) // ~1.1 s of clench, then 0.15 back
    expect(sim.sphincterToneStrain).toBe(0)
  })

  it('a clench well after the wave lands still calms it, for fewer points', () => {
    const sim = quietRun()
    sim.urgeWaveTimer = 0.01
    run(sim, 1.5) // warned, then 0.3 s into the wave
    expect(sim.isUrgeWaveActive).toBe(true)
    run(sim, 0.4)
    play(sim, startClench)
    const events = run(sim, 2.5)
    expect(points(events, 'good')).toHaveLength(1)
    expect(points(events, 'perfect')).toEqual([])
    expect(sim.arcade.combo).toBe(0)
  })

  it('a wave nobody calms breaks the combo', () => {
    const sim = quietRun()
    sim.arcade.combo = 4
    sim.urgeWaveTimer = 0.01
    const events = run(sim, 5)
    expect(events).toContainEqual({ type: 'urgeEnd', suppressed: false })
    expect(points(events, 'missed')).toHaveLength(1)
    expect(sim.arcade.combo).toBe(0)
  })

  it('get stronger, closer together and slower to calm as the levels go up', () => {
    const sim = quietRun(300) // below the urge threshold, so nothing ends the run
    const level1 = { strength: sim.urgeStrength, interval: sim.urgeIntervalScale, calm: sim.urgeSuppressRate, relief: sim.kegelReliefRate }
    const events = run(sim, 90.1)
    expect(events.filter((e) => e.type === 'arcadeLevel').map((e) => e.level)).toEqual([2, 3, 4])
    expect(sim.urgeStrength).toBeGreaterThan(level1.strength)
    expect(sim.urgeIntervalScale).toBeLessThan(level1.interval)
    expect(sim.urgeSuppressRate).toBeLessThan(level1.calm)
    expect(sim.kegelReliefRate).toBeLessThan(level1.relief)
  })
})

describe('clench economy', () => {
  it('costs 3x and eases no strain with nothing to hold back', () => {
    const sim = quietRun(300)
    sim.sphincterToneStrain = 0.5
    play(sim, startClench)
    run(sim, 1)
    expect(sim.kegelStamina).toBeCloseTo(1 - 0.33, 6)
    expect(sim.sphincterToneStrain).toBeCloseTo(0.5, 6)
  })

  it('needs 30 % stamina back after giving out', () => {
    const sim = quietRun(300)
    play(sim, startClench)
    run(sim, 4, { until: (s) => s.clenchExhausted })
    expect(sim.clenchExhausted).toBe(true)
    run(sim, 0.2)
    play(sim, startClench)
    expect(sim.isClenching).toBe(false)
    run(sim, 0.3)
    play(sim, startClench)
    expect(sim.isClenching).toBe(true)
  })
})

describe('leaks', () => {
  it('give 0.6 s at 100 % strain to clench: a save scores', () => {
    const sim = quietRun(450)
    sim.sphincterToneStrain = 1
    const warned = run(sim, 0.3)
    expect(types(warned)).toContain('leakWarning')
    expect(sim.isStressLeaking).toBe(false)
    play(sim, startClench)
    const events = run(sim, DT)
    expect(types(events)).toContain('leakSaved')
    expect(points(events, 'saved')).toHaveLength(1)
  })

  it('cost points and the combo when the grace runs out', () => {
    const sim = quietRun(450)
    sim.arcade.score = 500
    sim.arcade.combo = 3
    sim.sphincterToneStrain = 1
    const events = run(sim, 0.7)
    expect(types(events)).toContain('leakStart')
    expect(sim.arcade).toMatchObject({ combo: 0, leaks: 1 })
    expect(sim.arcade.score).toBeGreaterThan(400) // 500 + ~12 for holding through the grace − 100
    expect(sim.arcade.score).toBeLessThan(420)
  })

  it('a total failure ends the run, unbanked', () => {
    const sim = quietRun(720)
    sim.arcade.score = 1234
    sim.sphincterToneStrain = 1
    const events = run(sim, 0.7)
    const result = events.find((e) => e.type === 'challengeResult')
    expect(result).toMatchObject({ challenge: 'arcade', success: false, leaks: 0 })
    expect(result.score).toBeGreaterThanOrEqual(1234)
    expect(sim).toMatchObject({ arcade: null, activeChallenge: null, ...SANDBOX_RULES })
  })
})

describe('scoring', () => {
  it('pays for holding, more the fuller the bladder', () => {
    expect([0.3, 0.5, 0.8, 1.0, 1.2].map(fillMultiplier)).toEqual([1, 2, 3, 5, 5])
    const half = quietRun(300)
    run(half, 2)
    const full = quietRun(760)
    full.urgeWaveTimer = 999
    run(full, 2)
    expect(half.arcade.score).toBeCloseTo(20, 0)
    expect(full.arcade.score).toBeCloseTo(100, 0)
  })

  it('serves drinks on its own; choosing to drink earns a bonus', () => {
    const sim = quietRun(300)
    sim.arcade.serveTimer = 0.01
    const served = run(sim, DT)
    expect(served.find((e) => e.type === 'ingest')).toMatchObject({ served: true })
    expect(points(served, 'drink')).toEqual([])

    const chosen = play(sim, ingestBeverage, 'water', fixed(0.5))
    expect(points(chosen, 'drink')).toEqual([{ type: 'arcadePoints', reason: 'drink', points: 90, combo: 0 }])
    // Any drink from the menu, by its volume.
    const fromMenu = play(sim, ingestBeverage, 'bubbleTea', fixed(0.5))
    expect(points(fromMenu, 'drink')).toEqual([{ type: 'arcadePoints', reason: 'drink', points: 225, combo: 0 }])
  })

  it('announces sneezes from level 2; bracing for one scores', () => {
    const sim = quietRun(300)
    sim.arcade.time = 30
    sim.arcade.sneezeTimer = 1.2
    const warned = run(sim, 0.3)
    expect(types(warned)).toContain('sneezeWarning')
    expect(sim.coughWarned).toBe(true)
    play(sim, startClench)
    const events = run(sim, 1)
    expect(types(events)).toContain('cough')
    expect(points(events, 'braced')).toEqual([{ type: 'arcadePoints', reason: 'braced', points: 40, combo: 1 }])
    play(sim, stopClench)
  })

  it('emptying banks the score: volume times the fill multiplier, then the run ends', () => {
    const sim = quietRun(600)
    sim.arcade.score = 1000
    play(sim, startVoidAttempt)
    const events = run(sim, 1.1)
    expect(points(events, 'bank')).toEqual([{ type: 'arcadePoints', reason: 'bank', points: 1800, combo: 0 }])
    expect(events.find((e) => e.type === 'challengeResult')).toMatchObject({ challenge: 'arcade', success: true })
    expect(events.find((e) => e.type === 'challengeResult').score).toBeGreaterThan(2800)
    expect(sim.arcade).toBe(null)
    expect(sim.isActivelyVoiding).toBe(true) // the void carries on
  })
})
