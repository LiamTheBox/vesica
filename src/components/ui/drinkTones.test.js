import { describe, expect, it } from 'vitest'
import { DRINKS, DRINK_GROUPS, SHELF } from '../../sim/drinks'
import { TONES, toneOf } from './drinkTones'

describe('the drinks colours', () => {
  it('give every group a tone, and every drink its group', () => {
    for (const group of DRINK_GROUPS) expect(TONES[group.id], group.id).toBeDefined()
    for (const key of Object.keys(DRINKS)) expect(toneOf(key), key).toBeDefined()
  })

  it("are the same on the shelf as in the menu: a drink's group decides", () => {
    expect(toneOf(SHELF[0])).toBe(TONES.water)
    expect(toneOf('coffee')).toBe(TONES.coffeeTea)
    expect(toneOf('beer')).toBe(TONES.alcohol)
  })
})
