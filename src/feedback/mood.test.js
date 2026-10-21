import { describe, expect, it } from 'vitest'
import { createSimState } from '../sim/sim'
import { createMood, feel, moodOf, SLEEPY_AFTER, stepMood } from './mood'

const at = (volume, state = {}) => Object.assign(createSimState(), { volume }, state)
const pass = (mood, seconds) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) stepMood(mood, 0.1)
}

describe('mood (C)', () => {
  it('goes from calm through uneasy and desperate to panic as it fills and strains', () => {
    const mood = createMood()
    expect(moodOf(mood, at(200))).toBe('calm')
    expect(moodOf(mood, at(400))).toBe('uneasy')
    expect(moodOf(mood, at(600))).toBe('desperate')
    expect(moodOf(mood, at(200, { isUrgeWaveActive: true }))).toBe('desperate')
    expect(moodOf(mood, at(600, { sphincterToneStrain: 0.9 }))).toBe('panic')
    expect(moodOf(mood, at(300, { isStressLeaking: true }))).toBe('panic')
  })

  it('dozes off when nearly empty and left alone, and wakes up when something happens', () => {
    const mood = createMood()
    const sim = at(100)
    pass(mood, SLEEPY_AFTER - 1)
    expect(moodOf(mood, sim)).toBe('calm')
    pass(mood, 1.1)
    expect(moodOf(mood, sim)).toBe('sleepy')
    feel(mood, { type: 'ingest', beverage: 'water' })
    expect(moodOf(mood, sim)).toBe('calm')
  })

  it('gets annoyed by a run of pokes, not by one, and cools off', () => {
    const mood = createMood()
    const sim = at(200)
    feel(mood, { type: 'poke', touch: true })
    expect(moodOf(mood, sim)).toBe('calm')
    for (let i = 0; i < 3; i++) {
      pass(mood, 0.3)
      feel(mood, { type: 'poke', touch: true })
    }
    expect(moodOf(mood, sim)).toBe('annoyed')
    pass(mood, 4)
    expect(moodOf(mood, sim)).toBe('calm')
    // Rubbing (a drag pokes on every move) wears thin too, just more slowly.
    for (let i = 0; i < 60; i++) feel(mood, { type: 'poke', touch: false })
    expect(moodOf(mood, sim)).toBe('calm')
    for (let i = 0; i < 100; i++) feel(mood, { type: 'poke', touch: false })
    expect(moodOf(mood, sim)).toBe('annoyed')
    feel(mood, { type: 'soothe' })
    expect(moodOf(mood, sim)).toBe('relieved')
  })

  it('is embarrassed for a while after a leak, relieved after an urge passes, proud after a perfect clench', () => {
    const mood = createMood()
    const sim = at(400)
    feel(mood, { type: 'leakStart' })
    expect(moodOf(mood, at(400, { isStressLeaking: true }))).toBe('panic')
    feel(mood, { type: 'leakEnd' })
    expect(moodOf(mood, sim)).toBe('embarrassed')
    pass(mood, 8.1)
    expect(moodOf(mood, sim)).toBe('uneasy')

    feel(mood, { type: 'urgeEnd', suppressed: true })
    expect(moodOf(mood, sim)).toBe('relieved')
    pass(mood, 5.1)
    expect(moodOf(mood, sim)).toBe('uneasy')

    feel(mood, { type: 'arcadePoints', reason: 'perfect' })
    expect(moodOf(mood, at(600))).toBe('proud')
    expect(moodOf(mood, at(400, { isActivelyVoiding: true }))).toBe('relieved')
    feel(mood, { type: 'reset' })
    expect(moodOf(mood, sim)).toBe('uneasy')
  })
})
