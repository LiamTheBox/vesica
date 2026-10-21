import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseInline, parseStory, STORIES } from './stories'
import { DEFAULT_READING, loadReading, saveReading, TEXT_SIZES } from './reading'

describe('stories (M9)', () => {
  it('has the six chapters, in order, each with a title and its paragraphs', () => {
    expect(STORIES.map((s) => s.title)).toEqual([
      'Morning Coffee', 'The Commute', 'The Long Meeting', 'Date Night', 'The Concert Queue', 'The Road Trip',
    ])
    expect(STORIES.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(STORIES.length)
    for (const story of STORIES) {
      expect(story.blocks.filter((b) => b.type === 'p').length, story.id).toBeGreaterThan(8)
      expect(story.minutes, story.id).toBeGreaterThanOrEqual(1)
      // No Markdown left over in the text.
      for (const block of story.blocks) {
        for (const span of block.spans) expect(span.text, story.id).not.toMatch(/\*|^#|^---/)
      }
    }
  })

  it('reads the Markdown it uses: a title, paragraphs, scene breaks, headings, italics and bold', () => {
    const story = parseStory('# A Title\n\nFirst line\nsame paragraph.\n\n---\n\n## Later\n\nA *quiet* and **loud** _word_.\n')
    expect(story.title).toBe('A Title')
    expect(story.blocks.map((b) => b.type)).toEqual(['p', 'break', 'h', 'p'])
    expect(story.blocks[0].spans).toEqual([{ text: 'First line same paragraph.' }])
    expect(parseInline('A *quiet* and **loud** _word_.')).toEqual([
      { text: 'A ' }, { text: 'quiet', em: true }, { text: ' and ' }, { text: 'loud', strong: true }, { text: ' ' },
      { text: 'word', em: true }, { text: '.' },
    ])
  })
})

describe('the reading place', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is kept on the device, and starts at the list without it', () => {
    expect(loadReading()).toEqual(DEFAULT_READING) // no storage at all
    const stored = new Map()
    vi.stubGlobal('window', { localStorage: { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v) } })
    saveReading({ chapter: '03-the-long-meeting', places: { '03-the-long-meeting': 0.42 }, size: 2 })
    expect(loadReading()).toEqual({ chapter: '03-the-long-meeting', places: { '03-the-long-meeting': 0.42 }, size: 2 })
    // A bad size is kept in range.
    saveReading({ chapter: null, places: {}, size: 99 })
    expect(loadReading().size).toBe(TEXT_SIZES.length - 1)
  })
})
