import { describe, expect, it } from 'vitest'
import { BEVERAGE_TYPES } from '../physics/constants'
import { DRINK_COUNT, DRINK_GROUPS, DRINKS } from './drinks'
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
    for (const [key, original] of Object.entries(BEVERAGE_TYPES)) {
      expect(DRINKS[key]).toMatchObject(original)
    }
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
})
