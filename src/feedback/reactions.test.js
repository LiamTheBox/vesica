import { describe, expect, it } from 'vitest'
import { CHATTER, LINES } from '../audio/lines'
import { DRINKS } from '../sim/drinks'
import { createSimState, startCommuteChallenge, startPrecisionChallenge } from '../sim/sim'
import { startArcadeRun } from '../sim/arcade'
import { startMicroRun } from '../sim/micro/runner'
import { createMood, feel, SLEEPY_AFTER, stepMood } from './mood'
import { chatterLine, fullnessLine, PLEAD_AFTER, reactionLine, SULK_AFTER } from './reactions'
import { createCameraWatch, watchCamera } from './camera'

// Every event the simulation and the arcade emit that the bladder might talk about.
const EVENTS = [
  ...Object.keys(DRINKS).map((beverage) => ({ type: 'ingest', beverage })),
  { type: 'clenchStart' }, { type: 'clenchExhausted' },
  { type: 'urgeWarning' }, { type: 'sneezeWarning' }, { type: 'urgeStart' },
  { type: 'urgeEnd', suppressed: true }, { type: 'urgeEnd', suppressed: false },
  { type: 'leakSaved' }, { type: 'leakStart' }, { type: 'leakEnd' },
  { type: 'failureStart' }, { type: 'failureEnd' }, { type: 'voidStart' },
  { type: 'agitation', strength: 2.5 }, { type: 'soothe' },
  { type: 'poke', touch: true }, { type: 'slap' }, { type: 'squeezeStart' },
  { type: 'arcadePoints', reason: 'perfect' }, { type: 'arcadePoints', reason: 'braced' }, { type: 'arcadeLevel', level: 2 },
  { type: 'voidStop' }, { type: 'reset' }, { type: 'cough' },
  { type: 'cutaway' }, { type: 'tooClose' }, { type: 'dizzy' },
]

const at = (volume, state = {}) => Object.assign(createSimState(), { volume }, state)
const said = (event, sim = at(300), mood = createMood()) => reactionLine(event, sim, mood)
const annoyed = () => {
  const mood = createMood()
  for (let i = 0; i < 4; i++) feel(mood, { type: 'poke', touch: true })
  return mood
}

describe('what the bladder says when something happens (B)', () => {
  it('has something to say where it used to stay quiet', () => {
    expect(said({ type: 'squeezeStart' })).toBe('squeezed')
    expect(said({ type: 'clenchExhausted' })).toBe('exhausted')
    expect(said({ type: 'leakSaved' })).toBe('saved')
    expect(said({ type: 'leakEnd' })).toBe('leakOver')
    expect(said({ type: 'urgeEnd', suppressed: true })).toBe('urgePassed')
    expect(said({ type: 'urgeWarning' })).toBe('urgeIncoming')
    expect(said({ type: 'sneezeWarning' })).toBe('sneezeIncoming')
    expect(said({ type: 'arcadePoints', reason: 'perfect' })).toBe('proud')
    expect(said({ type: 'arcadeLevel', level: 3 })).toBe('levelUp')
    expect(said({ type: 'arcadePoints', reason: 'drink' })).toBe(null)
  })

  it('tells water, coffee, beer and a big bottle apart', () => {
    const drink = (beverage) => said({ type: 'ingest', beverage })
    expect([drink('water'), drink('coffee'), drink('beer'), drink('bottle'), drink('milk')])
      .toEqual(['drinkWater', 'drinkCaffeine', 'drinkAlcohol', 'drinkBig', 'drinkOther'])
  })
})

describe('what it says depends on how full it is and how it feels (C)', () => {
  it('finds a poke ticklish when empty and alarming when full, and runs out of patience', () => {
    const poke = { type: 'poke', touch: true }
    expect(said(poke, at(100))).toBe('pokeEmpty')
    expect(said(poke, at(350))).toBe('poked')
    expect(said(poke, at(600))).toBe('pokeFull')
    expect(said(poke, at(350, { sphincterToneStrain: 0.6 }))).toBe('pokeFull')
    expect(said(poke, at(100), annoyed())).toBe('annoyed')
    expect(said({ type: 'slap' }, at(600))).toBe('slapFull')
    expect(said({ type: 'squeezeStart' }, at(100))).toBe('squeezeEmpty')
  })

  it('protests a drink when full, wonders why it clenches for nothing, and gloats over a braced sneeze', () => {
    expect(said({ type: 'ingest', beverage: 'water' }, at(600))).toBe('drinkFull')
    expect(said({ type: 'clenchStart' }, at(100))).toBe('clenchIdle')
    expect(said({ type: 'clenchStart' }, at(100, { isUrgeWaveActive: true }))).toBe('clench')
    expect(said({ type: 'clenchStart' }, at(400))).toBe('clench')
    expect(said({ type: 'cough' }, at(400, { isClenching: true }))).toBe('coughBraced')
    expect(said({ type: 'cough' }, at(400))).toBe('cough')
  })

  it('murmurs when sleepy, and keeps its fill chatter to itself while embarrassed', () => {
    const mood = createMood()
    expect(chatterLine(at(100), mood)).toBe(null)
    stepMood(mood, SLEEPY_AFTER)
    expect(chatterLine(at(100), mood)).toBe('sleepy')
    expect(chatterLine(at(400), mood)).toBe('distended')
    feel(mood, { type: 'leakEnd' })
    expect(chatterLine(at(400), mood)).toBe(null)
  })

  it('only names lines that exist, and every line gets said by something', () => {
    const sims = [at(100), at(350), at(600), at(400, { isClenching: true })]
    const moods = [createMood(), annoyed()]
    const lines = new Set()
    for (const event of EVENTS) {
      for (const sim of sims) for (const mood of moods) lines.add(reactionLine(event, sim, mood))
    }
    lines.delete(null)
    for (const category of lines) expect(LINES[category], category).toBeDefined()
    for (const category of Object.keys(LINES)) expect(lines.has(category) || CHATTER.has(category), category).toBe(true)
  })

  it("says nothing but the voiding while it voids, then speaks again when it's done (bug fix)", () => {
    const voiding = at(600, { isActivelyVoiding: true })
    const others = [
      { type: 'poke', touch: true }, { type: 'slap' }, { type: 'squeezeStart' }, { type: 'ingest', beverage: 'water' },
      { type: 'urgeEnd', suppressed: false }, { type: 'clenchStart' }, { type: 'agitation', strength: 2.5 },
      { type: 'cough' }, { type: 'soothe' }, { type: 'arcadePoints', reason: 'bank' },
    ]
    for (const event of others) expect(said(event, voiding), event.type).toBe(null)
    expect(said({ type: 'voidStart' }, voiding)).toBe('voiding')

    const failing = at(600, { involuntaryVoiding: true })
    expect(said({ type: 'failureStart' }, failing)).toBe('involuntary')
    expect(said({ type: 'poke', touch: true }, failing)).toBe(null)

    // Done: the line about it, then back to normal.
    expect(said({ type: 'voidStop' }, at(10))).toBe('emptied')
    expect(said({ type: 'failureEnd' }, at(70))).toBe('aftermath')
    expect(said({ type: 'poke', touch: true }, at(10))).toBe('pokeEmpty')
  })
})

describe('lines the simulation used to choose (C2)', () => {
  it('says it is emptied after a void under 150 ml or a reset', () => {
    expect(said({ type: 'voidStop' }, at(149))).toBe('emptied')
    expect(said({ type: 'voidStop' }, at(300))).toBe(null)
    expect(said({ type: 'reset' }, at(40))).toBe('emptied')
  })

  it.each([
    ['commute', startCommuteChallenge], ['precision', startPrecisionChallenge], ['arcade', startArcadeRun], ['microgames', startMicroRun],
  ])('says nothing as a %s start resets the organ (it is refilled at once)', (_, start) => {
    const sim = createSimState()
    const out = []
    start(sim, out, () => 0.5)
    expect(out.map((e) => said(e, sim)).filter(Boolean)).toEqual([])
  })

  it('is shaken by a good shake once it is getting full', () => {
    expect(said({ type: 'agitation', strength: 2.5 }, at(400))).toBe('shaken')
    expect(said({ type: 'agitation', strength: 2.0 }, at(400))).toBe(null)
    expect(said({ type: 'agitation', strength: 2.5 }, at(250))).toBe(null)
  })

  it.each([
    [100, 0, null],
    [200, 0, 'nominal'],
    [400, 0, 'distended'],
    [600, 0, 'full'],
    [700, 0, 'critical'],
    [200, 0.8, 'critical'],
  ])('chats about its fill: %s ml, strain %s → %s', (volume, strain, category) => {
    expect(fullnessLine(at(volume, { sphincterToneStrain: strain }))).toBe(category)
  })

  it('keeps its fill to itself while voiding or leaking', () => {
    expect(fullnessLine(at(700, { isStressLeaking: true }))).toBe(null)
    expect(fullnessLine(at(700, { isActivelyVoiding: true }))).toBe(null)
  })
})

describe('being looked at (A5)', () => {
  it('minds the cutaway and a close look, which embarrass it a little', () => {
    const mood = createMood()
    feel(mood, { type: 'cutaway' })
    expect(said({ type: 'cutaway' }, at(300), mood)).toBe('cutaway')
    expect(mood.embarrassment).toBeGreaterThan(0)
    expect(said({ type: 'tooClose' })).toBe('tooClose')
    expect(said({ type: 'dizzy' })).toBe('dizzy')
  })

  it('notices a zoom right in once, until the view backs off again', () => {
    const watch = createCameraWatch()
    const seen = [1, 0.6, 0.35, 0.3, 0.5, 0.35, 0.7, 0.3].map((zoom, i) => watchCamera(watch, zoom, 0, i))
    expect(seen).toEqual([null, null, 'tooClose', null, null, null, null, 'tooClose'])
  })

  it('gets dizzy from two quick turns of orbit, either way, but not from slow looking about', () => {
    const spin = (turnsPerSecond, seconds) => {
      const watch = createCameraWatch()
      const seen = []
      for (let t = 0; t <= seconds; t += 1 / 30) {
        const azimuth = ((turnsPerSecond * t * Math.PI * 2 + Math.PI) % (Math.PI * 2)) - Math.PI // as OrbitControls reports it
        seen.push(watchCamera(watch, 1, azimuth, t))
      }
      return seen.filter(Boolean)
    }
    expect(spin(1, 3)).toEqual(['dizzy'])
    expect(spin(-1, 3)).toEqual(['dizzy'])
    expect(spin(0.1, 30)).toEqual([])
  })
})

describe('held full for minutes (A6)', () => {
  const full = () => at(620)
  const heldFor = (seconds, sim = full()) => {
    const mood = createMood()
    for (let t = 0; t < seconds; t += 1) stepMood(mood, 1, sim)
    return mood
  }

  it('pleads after a minute and a half, then sulks', () => {
    expect(chatterLine(full(), heldFor(PLEAD_AFTER - 2))).toBe('full')
    expect(chatterLine(full(), heldFor(PLEAD_AFTER))).toBe('pleading')
    expect(chatterLine(full(), heldFor(SULK_AFTER))).toBe('sulking')
  })

  it('still says so when it is an emergency', () => {
    const strained = at(620, { sphincterToneStrain: 0.8 })
    expect(chatterLine(strained, heldFor(SULK_AFTER, strained))).toBe('critical')
  })

  it('forgets the wait once it is let go', () => {
    const mood = heldFor(SULK_AFTER)
    stepMood(mood, 1 / 60, at(620, { isActivelyVoiding: true }))
    expect(mood.heldFull).toBe(0)
    expect(chatterLine(full(), mood)).toBe('full')
  })
})
