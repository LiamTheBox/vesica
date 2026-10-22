import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from './en'
import { formatNumber, t, tCount } from '.'
import { MOOD_FACES } from '../feedback/mood'
import { PERSONALITIES } from '../audio/personalities'
import { WALL_FEELS } from '../settings/settings'
import { TIER_ORDER } from '../settings/quality'
import { STICKERS } from '../challenges/stickers'
import { DRINK_GROUPS, DRINKS, SHELF } from '../sim/drinks'
import { GAMES } from '../sim/micro/games'

const SRC = new URL('..', import.meta.url).pathname
const sources = (dir = SRC) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  if (statSync(path).isDirectory()) return sources(path)
  return /\.(js|jsx)$/.test(name) && !/\.test\./.test(name) && !path.includes('/i18n/') ? [readFileSync(path, 'utf8')] : []
})
const code = sources().join('\n')

// Keys the code names outright: t('key') and tCount('key', …) (as its .one and .other).
const named = [
  ...[...code.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1]),
  ...[...code.matchAll(/\bt\(\s*([a-zA-Z.]+) \? '([^']+)' : '([^']+)'/g)].flatMap((m) => [m[2], m[3]]),
  ...[...code.matchAll(/'([a-zA-Z]+\.[a-zA-Z.]+)'/g)].map((m) => m[1]).filter((key) => key in en),
  ...[...code.matchAll(/\btCount\(\s*'([^']+)'/g)].flatMap((m) => [`${m[1]}.one`, `${m[1]}.other`]),
]
// Keys the code builds from a list, like t(`drink.${key}`).
const withHints = (prefix, ids) => ids.flatMap((id) => [`${prefix}.${id}`, `${prefix}.${id}.hint`])
const built = [
  ...Object.keys(MOOD_FACES).map((mood) => `mood.${mood}`),
  ...['poke', 'squeeze', 'slap', 'orbit'].map((tool) => `tools.${tool}`),
  ...['cutaway', 'cough', 'shake', 'flush'].map((action) => `actions.${action}`),
  ...['sim', 'telemetry', 'challenges', 'stories', 'settings'].map((tab) => `nav.${tab}`),
  ...['commute', 'precision', 'arcade', 'micro'].map((challenge) => `result.title.${challenge}`),
  ...withHints('personality', Object.keys(PERSONALITIES)),
  ...withHints('wallFeel', WALL_FEELS),
  ...TIER_ORDER.map((tier) => `quality.${tier}`),
  ...withHints('sticker', STICKERS.map((sticker) => sticker.id)),
  ...Object.keys(DRINKS).map((key) => `drink.${key}`),
  ...DRINK_GROUPS.map((group) => `drinkGroup.${group.id}`),
  ...SHELF.map((key) => `shelf.${key}`),
  ...GAMES.map((game) => `verb.${game.id}`),
]

describe('the interface in English (A14)', () => {
  it('has words for every key the code uses', () => {
    for (const key of [...named, ...built]) expect(en[key], key).toBeTypeOf('string')
  })

  it('has no words nothing uses', () => {
    const used = new Set([...named, ...built])
    for (const key of Object.keys(en)) expect(used.has(key), key).toBe(true)
  })

  it('fills in values, keeps unknown ones as written, and falls back to the key', () => {
    expect(t('result.victory', { leaked: 12 })).toBe('VICTORY! (12ml lost)')
    expect(t('bar.volumeOf', { volume: 620, most: '∞' })).toBe('620 / ∞ ml')
    expect(t('result.victory')).toBe('VICTORY! ({leaked}ml lost)')
    expect(t('no.such.key')).toBe('no.such.key')
  })

  it('counts', () => {
    expect(tCount('result.leaks', 1)).toBe('1 leak')
    expect(tCount('result.leaks', 0)).toBe('0 leaks')
    expect(tCount('result.leaks', 3)).toBe('3 leaks')
    expect(formatNumber(12345)).toBe('12,345')
  })
})
