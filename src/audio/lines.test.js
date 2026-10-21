import { describe, expect, it } from 'vitest'
import { CHATTER, LINES, URGENT, VOICE_STYLE } from './lines'
import { Voice } from './voice'

const ALL = Object.values(LINES).flat()

describe('what the bladder says (F)', () => {
  it('says it in a breath: short lines, plenty of each kind, none twice', () => {
    for (const [category, lines] of Object.entries(LINES)) {
      expect(lines.length, category).toBeGreaterThanOrEqual(5)
      expect(new Set(lines).size, category).toBe(lines.length)
    }
    for (const line of ALL) expect(line.split(' ').length, line).toBeLessThanOrEqual(8)
    const words = ALL.reduce((n, line) => n + line.split(' ').length, 0)
    expect(words / ALL.length).toBeLessThan(5)
  })

  it('talks like a person, not an instrument', () => {
    const jargon = /cmH2O|detrusor|hydrostatic|hydrodynamic|poisson|trigone|lumen|rugae|urethral|retention|containment|elastic|inertia|lateral/i
    for (const line of ALL) expect(line, line).not.toMatch(jargon)
  })

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
})
