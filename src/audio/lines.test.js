import { describe, expect, it } from 'vitest'
import { CHATTER, LINES, URGENT, VOICE_STYLE } from './lines'
import { PERSONALITIES } from './personalities'
import { Voice } from './voice'

describe.each(Object.entries(PERSONALITIES))('what the bladder says: %s (F, A11)', (_, who) => {
  const all = Object.values(who.lines).flat()

  it('has every kind of line, and no others', () => {
    expect(Object.keys(who.lines).sort()).toEqual(Object.keys(LINES).sort())
  })

  it('says it in a breath: short lines, plenty of each kind, none twice', () => {
    for (const [category, lines] of Object.entries(who.lines)) {
      expect(lines.length, category).toBeGreaterThanOrEqual(5)
      expect(new Set(lines).size, category).toBe(lines.length)
    }
    for (const line of all) expect(line.split(' ').length, line).toBeLessThanOrEqual(8)
    const words = all.reduce((n, line) => n + line.split(' ').length, 0)
    expect(words / all.length).toBeLessThan(5)
  })

  it('talks like a person, not an instrument', () => {
    const jargon = /cmH2O|detrusor|hydrostatic|hydrodynamic|poisson|trigone|lumen|rugae|urethral|retention|containment|elastic|inertia|lateral/i
    for (const line of all) expect(line, line).not.toMatch(jargon)
  })

  it('has a voice for every kind of line', () => {
    for (const category of Object.keys(LINES)) {
      const style = who.styleOf(category)
      expect(style.pitch, category).toBeGreaterThan(0.5)
      expect(style.rate, category).toBeGreaterThan(0.5)
    }
  })
})

describe('what the bladder says (F)', () => {
  it('has a voice and a priority only for kinds of line it has', () => {
    for (const category of [...Object.keys(VOICE_STYLE), ...URGENT, ...CHATTER]) expect(LINES[category], category).toBeDefined()
  })

  it("varies its lines: never the same twice running, and not in a fixed order", () => {
    const voice = new Voice()
    const said = []
    voice.onSubtitle = (text) => said.push(text)
    for (let i = 0; i < 300; i++) {
      voice.speak('slapped') // five lines
      voice.update(5)
    }
    expect(said).toHaveLength(300)
    expect(new Set(said).size).toBe(LINES.slapped.length)
    const next = new Map()
    for (let i = 1; i < said.length; i++) {
      expect(said[i]).not.toBe(said[i - 1])
      next.set(said[i - 1], (next.get(said[i - 1]) ?? new Set()).add(said[i]))
    }
    for (const followers of next.values()) expect(followers.size).toBeGreaterThan(1)
  })

  it('speaks in the personality chosen, and starts its record of recent lines over', () => {
    const voice = new Voice()
    const said = []
    voice.onSubtitle = (text) => said.push(text)
    voice.setPersonality('deadpan')
    for (let i = 0; i < 5; i++) {
      voice.speak('clench')
      voice.update(5)
    }
    for (const text of said) expect(PERSONALITIES.deadpan.lines.clench).toContain(text)
    voice.setPersonality('shy')
    expect(voice.recentHistory.size).toBe(0)
  })
})
