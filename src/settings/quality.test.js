import { describe, expect, it } from 'vitest'
import { createFpsMonitor, isTier, lowerTier, QUALITY_TIERS, TIER_ORDER } from './quality'

// Feeds `seconds` of frames at `fps`; returns how many times the monitor said "drop".
function run(monitor, fps, seconds) {
  let drops = 0
  for (let t = 0; t < seconds; t += 1 / fps) if (monitor.sample(1 / fps)) drops++
  return drops
}

describe('quality tiers', () => {
  it('step down from high to low and stop there', () => {
    expect(lowerTier('high')).toBe('medium')
    expect(lowerTier('medium')).toBe('low')
    expect(lowerTier('low')).toBe('low')
  })

  it('get cheaper at every step', () => {
    const tiers = TIER_ORDER.map((t) => QUALITY_TIERS[t])
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].maxDpr).toBeLessThanOrEqual(tiers[i - 1].maxDpr)
      expect(tiers[i].transmission && !tiers[i - 1].transmission).toBe(false)
    }
    expect(isTier('medium')).toBe(true)
    expect(isTier('ultra')).toBe(false)
    expect(isTier('toString')).toBe(false)
  })
})

describe('Auto quality monitor', () => {
  it('never drops on a smooth device', () => {
    expect(run(createFpsMonitor(), 60, 60)).toBe(0)
    expect(run(createFpsMonitor(), 120, 60)).toBe(0)
  })

  it('drops once after two slow windows, past the settle time', () => {
    const monitor = createFpsMonitor()
    expect(run(monitor, 20, 3)).toBe(0) // settling (shader compiles)
    expect(run(monitor, 20, 2.1)).toBe(0) // one slow window is not enough
    expect(run(monitor, 20, 2)).toBe(1)
  })

  it('needs consecutive slow windows: a smooth one in between resets the count', () => {
    const monitor = createFpsMonitor()
    run(monitor, 60, 3)
    expect(run(monitor, 30, 2.1)).toBe(0)
    expect(run(monitor, 60, 2.1)).toBe(0)
    expect(run(monitor, 30, 2.1)).toBe(0)
  })

  it('settles again after a drop, so the new tier gets a fair start', () => {
    const monitor = createFpsMonitor()
    expect(run(monitor, 20, 7.5)).toBe(1)
    expect(run(monitor, 20, 3)).toBe(0) // the new tier's shaders compile
    expect(run(monitor, 20, 4.2)).toBe(1)
  })

  it('does not count the time the app was hidden as a slow frame', () => {
    const monitor = createFpsMonitor()
    run(monitor, 60, 3.5)
    for (let i = 0; i < 3; i++) {
      expect(monitor.sample(5)).toBe(false) // 5 s in the background
      expect(run(monitor, 60, 2.1)).toBe(0)
    }
  })
})
