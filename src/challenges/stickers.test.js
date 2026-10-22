import { describe, expect, it } from 'vitest'
import { createSimState } from '../sim/sim'
import { createStickerProgress, earn, EMPTY_STICKERS, STICKERS, stickersFromEvent, stickersFromTick } from './stickers'
import { t } from '../i18n'

const at = (state = {}) => Object.assign(createSimState(), state)
// The stickers each event earns, in turn, with what's kept and counted carried along.
function play(events, sim = at(), kept = EMPTY_STICKERS) {
  const progress = createStickerProgress()
  const earned = []
  for (const event of events) {
    const result = stickersFromEvent(kept, progress, event, sim)
    if (result.tasted) kept = { ...kept, tasted: result.tasted }
    kept = earn(kept, result.earned, 'today')
    earned.push(...result.earned)
  }
  return { earned, kept, progress }
}

describe('stickers (A12)', () => {
  it('each has an id, an icon, a name and how to earn it, and the ids are unique', () => {
    for (const sticker of STICKERS) {
      expect(sticker.icon, sticker.id).toBeTruthy()
      expect(t(`sticker.${sticker.id}`), sticker.id).not.toBe(`sticker.${sticker.id}`)
      expect(t(`sticker.${sticker.id}.hint`), sticker.id).not.toBe(`sticker.${sticker.id}.hint`)
    }
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length)
  })

  it('banks, banks dry, and wins the two challenges', () => {
    expect(play([{ type: 'challengeResult', challenge: 'arcade', success: true, leaks: 2 }]).earned).toEqual(['banked'])
    expect(play([{ type: 'challengeResult', challenge: 'arcade', success: true, leaks: 0 }]).earned).toEqual(['banked', 'dry'])
    expect(play([{ type: 'challengeResult', challenge: 'arcade', success: false, leaks: 0 }]).earned).toEqual([])
    expect(play([{ type: 'challengeResult', challenge: 'commute', success: true }]).earned).toEqual(['commute'])
    expect(play([{ type: 'challengeResult', challenge: 'precision', success: true }]).earned).toEqual(['bullseye'])
  })

  it('is earned once, for good', () => {
    const { kept } = play([{ type: 'arcadeLevel', level: 5 }])
    expect(kept.earned.level5).toBe('today')
    expect(play([{ type: 'arcadeLevel', level: 6 }], at(), kept).earned).toEqual([])
  })

  it('counts perfect clenches and the combo within a run, and saves until a reset', () => {
    const run = at({ arcade: { perfects: 10 } })
    expect(play([{ type: 'arcadePoints', reason: 'perfect', combo: 10 }], run).earned).toEqual(['perfect10', 'combo10'])
    const saves = [{ type: 'leakSaved' }, { type: 'leakSaved' }, { type: 'reset' }, { type: 'leakSaved' }, { type: 'leakSaved' }]
    expect(play(saves, run).earned).toEqual([])
    expect(play([...saves, { type: 'leakSaved' }], run).earned).toEqual(['saves3'])
    // Saves in the sandbox don't count.
    expect(play([...saves, { type: 'leakSaved' }]).earned).toEqual([])
  })

  it('clears ten microgames, and beats a boss', () => {
    expect(play([{ type: 'microWin' }], at({ micro: { score: 10 } })).earned).toEqual(['micro10'])
    expect(play([{ type: 'challengeResult', challenge: 'micro', success: true, score: 12 }]).earned).toEqual(['micro10'])
    expect(play([{ type: 'microBoss', won: false }, { type: 'microBoss', won: true }]).earned).toEqual(['boss'])
  })

  it('tries ten different drinks', () => {
    const drinks = ['water', 'water', 'coffee', 'soda', 'beer', 'milk', 'greenTea', 'cola', 'wine', 'sake', 'orange']
    const { earned, kept } = play(drinks.map((beverage) => ({ type: 'ingest', beverage })))
    expect(earned).toEqual(['taster'])
    expect(kept.tasted).toHaveLength(10)
  })

  it('holds 700 ml, and more than full', () => {
    const kept = EMPTY_STICKERS
    expect(stickersFromTick(kept, createStickerProgress(), at({ volume: 650 }), 1 / 60)).toEqual([])
    expect(stickersFromTick(kept, createStickerProgress(), at({ volume: 700 }), 1 / 60)).toEqual(['held700'])
    expect(stickersFromTick(kept, createStickerProgress(), at({ volume: 760 }), 1 / 60)).toEqual(['held700', 'beyond'])
  })

  it('survives a pitcher: a minute after it without a leak', () => {
    const sim = at({ volume: 300 })
    const minute = (progress) => {
      const earned = []
      for (let t = 0; t < 60; t += 0.5) earned.push(...stickersFromTick(EMPTY_STICKERS, progress, sim, 0.5))
      return earned
    }
    const leaked = play([{ type: 'ingest', beverage: 'pitcher' }, { type: 'leakStart' }]).progress
    expect(minute(leaked)).toEqual([])
    const held = play([{ type: 'ingest', beverage: 'pitcher' }]).progress
    expect(minute(held)).toEqual(['pitcher'])
  })
})
