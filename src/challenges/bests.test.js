import { describe, expect, it } from 'vitest'
import { EMPTY_BESTS, describeBest, recordResult } from './bests'

describe('best challenge results', () => {
  it('ignores failed runs', () => {
    expect(recordResult(EMPTY_BESTS, { challenge: 'commute', success: false, leaked: 50 })).toBe(EMPTY_BESTS)
  })

  it('keeps the commute win with the least leaked', () => {
    let bests = recordResult(EMPTY_BESTS, { challenge: 'commute', success: true, leaked: 12 })
    bests = recordResult(bests, { challenge: 'commute', success: true, leaked: 18 })
    expect(bests.commute).toEqual({ leaked: 12 })
    bests = recordResult(bests, { challenge: 'commute', success: true, leaked: 0 })
    expect(bests.commute).toEqual({ leaked: 0 })
  })

  it('keeps the precision void closest to 200 ml, either side', () => {
    let bests = recordResult(EMPTY_BESTS, { challenge: 'precision', success: true, voided: 207 })
    bests = recordResult(bests, { challenge: 'precision', success: true, voided: 196 })
    expect(bests.precision).toEqual({ voided: 196 })
    bests = recordResult(bests, { challenge: 'precision', success: true, voided: 205 })
    expect(bests.precision).toEqual({ voided: 196 })
  })

  it('keeps the highest arcade score, banked or not', () => {
    let bests = recordResult(EMPTY_BESTS, { challenge: 'arcade', success: false, score: 4200, seconds: 150 })
    expect(bests.arcade).toEqual({ score: 4200, seconds: 150 })
    bests = recordResult(bests, { challenge: 'arcade', success: true, score: 3900, seconds: 200 })
    expect(bests.arcade).toEqual({ score: 4200, seconds: 150 })
    bests = recordResult(bests, { challenge: 'arcade', success: true, score: 5100, seconds: 95 })
    expect(bests.arcade).toEqual({ score: 5100, seconds: 95 })
  })

  it('describes bests for the challenge cards', () => {
    expect(describeBest('arcade', { score: 12345, seconds: 95 })).toBe('Best: 12,345 pts (1:35 held)')
    expect(describeBest('commute', { leaked: 4 })).toBe('Best: 4 ml lost')
    expect(describeBest('precision', { voided: 200 })).toBe('Best: 200 ml (perfect)')
    expect(describeBest('precision', { voided: 193 })).toBe('Best: 193 ml (-7 ml)')
    expect(describeBest('precision', null)).toBe(null)
  })
})
