import { describe, expect, it } from 'vitest'
import { CHATTER, LINES } from '../audio/lines'
import { DRINKS } from '../sim/drinks'
import { reactionLine } from './reactions'

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

describe('what the bladder says when something happens (B)', () => {
  it('has something to say where it used to stay quiet', () => {
    const said = (event) => reactionLine(event)
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
    const drink = (beverage) => reactionLine({ type: 'ingest', beverage })
    expect([drink('water'), drink('coffee'), drink('beer'), drink('bottle'), drink('milk')])
      .toEqual(['drinkWater', 'drinkCaffeine', 'drinkAlcohol', 'drinkBig', 'drinkOther'])
  })

  it('only names lines that exist, and every line gets said by something', () => {
    const said = new Set(EVENTS.map(reactionLine).filter(Boolean))
    for (const category of said) expect(LINES[category], category).toBeDefined()
    for (const category of Object.keys(LINES)) expect(said.has(category) || CHATTER.has(category), category).toBe(true)
  })
})
