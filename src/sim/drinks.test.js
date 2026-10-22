import { describe, expect, it } from 'vitest'
import { extractOriginalConst } from '../test/original'
import { DRINK_COUNT, DRINK_GROUPS, drinkKind, DRINKS, hasAlcohol, hasCaffeine, SERVED_TIERS, SHELF } from './drinks'
import { createSimState, ingestBeverage } from './sim'

describe('drinks menu', () => {
  it('has 40 drinks in named groups, each key once', () => {
    expect(DRINK_COUNT).toBe(40)
    const keys = DRINK_GROUPS.flatMap((group) => Object.keys(group.drinks))
    expect(new Set(keys).size).toBe(keys.length)
    for (const group of DRINK_GROUPS) {
      expect(group.name).toBeTruthy()
      expect(Object.keys(group.drinks).length).toBeGreaterThan(0)
    }
  })

  it("keeps the shelf's four drinks as the original has them", () => {
    const original = extractOriginalConst('BEVERAGE_TYPES')
    expect(SHELF).toEqual(Object.keys(original))
    for (const [key, numbers] of Object.entries(original)) expect(DRINKS[key]).toMatchObject(numbers)
  })

  it('gives every drink a name, an icon and numbers the bladder can take', () => {
    for (const d of Object.values(DRINKS)) {
      expect(d.name).toBeTruthy()
      expect(d.icon).toBeTruthy()
      expect(d.vol).toBeGreaterThan(0)
      expect(d.vol).toBeLessThanOrEqual(600)
      expect(d.rate).toBeGreaterThan(0)
      expect(d.rate).toBeLessThanOrEqual(30)
      expect(d.hyd).toBeGreaterThan(0)
      expect(d.hyd).toBeLessThanOrEqual(1)
    }
  })

  it('any drink on the menu can be drunk', () => {
    for (const [key, d] of Object.entries(DRINKS)) {
      const sim = createSimState()
      const out = []
      ingestBeverage(sim, out, key, () => 0.5)
      expect(sim.activeBeverages).toEqual([{ rem: d.vol, rate: d.rate, hyd: d.hyd }])
      expect(out).toContainEqual({ type: 'ingest', beverage: key, served: false })
    }
  })

  it('sorts every drink into what the bladder makes of it (B)', () => {
    const kinds = Object.fromEntries(Object.keys(DRINKS).map((key) => [key, drinkKind(key)]))
    expect(new Set(Object.values(kinds))).toEqual(new Set(['water', 'caffeine', 'alcohol', 'big', 'other']))
    expect(kinds).toMatchObject({
      water: 'water', bottle: 'big', coffee: 'caffeine', cola: 'caffeine', bigSoda: 'big', chamomile: 'other',
      beer: 'alcohol', pitcher: 'alcohol', whisky: 'alcohol', milk: 'other', lemonade: 'other',
    })
  })
})

describe('what the arcade serves (A10)', () => {
  it('starts with hydrating drinks, adds caffeine and sweet ones, then alcohol and big ones', () => {
    const [first, second, third] = SERVED_TIERS
    expect(first.length).toBeGreaterThanOrEqual(10)
    expect(first.some((key) => hasCaffeine(key) || hasAlcohol(key))).toBe(false)
    expect(second.some(hasCaffeine)).toBe(true)
    expect(second.some(hasAlcohol)).toBe(false)
    expect(third.some(hasAlcohol)).toBe(true)
    expect(third).toHaveLength(DRINK_COUNT)
    for (const key of first) expect(second).toContain(key)
    for (const key of second) expect(third).toContain(key)
  })
})
