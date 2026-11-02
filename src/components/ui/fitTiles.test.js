import { describe, expect, it } from 'vitest'
import { fitTiles, LEAST_TILE, MOST_TILE } from './fitTiles'

const GAP = 6
const rowsOf = (count, columns) => Math.ceil(count / columns)
const fits = ({ columns, size }, count, width, height) => {
  expect(columns * size + (columns - 1) * GAP).toBeLessThanOrEqual(width)
  const rows = rowsOf(count, columns)
  expect(rows * size + (rows - 1) * GAP).toBeLessThanOrEqual(height)
}

describe('fitting the drinks into the screen (requested)', () => {
  it.each([
    ['a tall phone', 372, 660, 5],
    ['a small phone', 335, 500, 5],
    ['a phone on its side', 800, 235, 10],
    ['a tablet', 700, 800, 6],
  ])('fits 40 on %s, as big as they can be', (_, width, height, columns) => {
    const fit = fitTiles(40, width, height, GAP)
    fits(fit, 40, width, height)
    expect(fit.columns).toBe(columns)
    expect(fit.size).toBeGreaterThanOrEqual(LEAST_TILE)
    // No other number of columns would make them bigger.
    for (let c = 1; c <= 40; c++) {
      const rows = rowsOf(40, c)
      const other = Math.min((width - GAP * (c - 1)) / c, (height - GAP * (rows - 1)) / rows)
      expect(other).toBeLessThan(fit.size + 1.5)
    }
  })

  it('stops growing on a big screen, in a full block', () => {
    const fit = fitTiles(40, 984, 800, GAP)
    expect(fit.size).toBe(MOST_TILE)
    expect(fit.columns).toBe(8)
    fits(fit, 40, 984, 800)
  })

  it('keeps them big enough to read and hit on a very small screen, and lets them scroll', () => {
    const fit = fitTiles(40, 280, 380, GAP)
    expect(fit.size).toBe(LEAST_TILE)
    expect(fit.columns * fit.size + (fit.columns - 1) * GAP).toBeLessThanOrEqual(280)
    expect(fit.columns).toBeGreaterThanOrEqual(4)
  })
})
