import { describe, expect, it } from 'vitest'
import { CHATTER, LINES } from '../audio/lines'
import { DRINKS } from '../sim/drinks'
import { createSimState } from '../sim/sim'
import { createMood, feel, SLEEPY_AFTER, stepMood } from './mood'
import { chatterLine, reactionLine } from './reactions'

// Every event the simulation and the arcade emit that the bladder might talk about.
const EVENTS = [
  ...Object.keys(DRINKS).map((beverage) => ({ type: 'ingest', beverage })),
  { type: 'clenchStart' }, { type: 'clenchExhausted' },
  { type: 'urgeWarning' }, { type: 'sneezeWarning' }, { type: 'urgeStart' },
  { type: 'urgeEnd', suppressed: true }, { type: 'urgeEnd', suppressed: false },
  { type: 'leakWarning' }, { type: 'leakSaved' }, { type: 'leakStart' }, { type: 'leakEnd' },
  { type: 'failureStart' }, { type: 'failureEnd' }, { type: 'voidStart' },
  { type: 'agitation', speakShaken: true }, { type: 'soothe' },
  { type: 'poke', touch: true }, { type: 'slap' }, { type: 'squeezeStart' },
  { type: 'arcadePoints', reason: 'perfect' }, { type: 'arcadePoints', reason: 'braced' }, { type: 'arcadeLevel', level: 2 },
  { type: 'voice', category: 'deflated' }, { type: 'voice', category: 'cough' },
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
    expect(said({ type: 'voice', category: 'cough' }, at(400, { isClenching: true }))).toBe('coughBraced')
    expect(said({ type: 'voice', category: 'cough' }, at(400))).toBe('cough')
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
      { type: 'urgeEnd', suppressed: false }, { type: 'clenchStart' }, { type: 'agitation', speakShaken: true },
      { type: 'voice', category: 'cough' }, { type: 'soothe' }, { type: 'arcadePoints', reason: 'bank' },
    ]
    for (const event of others) expect(said(event, voiding), event.type).toBe(null)
    expect(said({ type: 'voidStart' }, voiding)).toBe('voiding')

    const failing = at(600, { involuntaryVoiding: true })
    expect(said({ type: 'failureStart' }, failing)).toBe('involuntary')
    expect(said({ type: 'poke', touch: true }, failing)).toBe(null)

    // Done: the line about it, then back to normal.
    expect(said({ type: 'voice', category: 'deflated' }, at(10))).toBe('deflated')
    expect(said({ type: 'failureEnd' }, at(70))).toBe('aftermath')
    expect(said({ type: 'poke', touch: true }, at(10))).toBe('pokeEmpty')
  })
})

