// The stories (M9): optional reading, outside the games. Each chapter is a Markdown file in
// this folder, in name order (01-…, 02-…); they're bundled with the app, so they read
// offline. Edit a file to edit its chapter; add one to add a chapter.
//
// The Markdown is a small subset: `# Title` on the first line, paragraphs separated by blank
// lines, `---` for a scene break, `## ` for a heading, and *italic* / **bold** inside.

const WORDS_PER_MINUTE = 220

// A paragraph's text as spans: { text, em, strong }.
export function parseInline(text) {
  const spans = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g
  let at = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) spans.push({ text: text.slice(at, match.index) })
    if (match[1] !== undefined) spans.push({ text: match[1], strong: true })
    else spans.push({ text: match[2] ?? match[3], em: true })
    at = match.index + match[0].length
  }
  if (at < text.length) spans.push({ text: text.slice(at) })
  return spans
}

// A chapter's Markdown as { title, blocks, words }; a block is { type: 'p' | 'h' | 'break',
// spans }.
export function parseStory(markdown) {
  let title = ''
  const blocks = []
  for (const chunk of markdown.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const text = chunk.trim().replace(/\s*\n\s*/g, ' ')
    if (!text) continue
    if (text.startsWith('# ')) title = text.slice(2).trim()
    else if (text.startsWith('## ')) blocks.push({ type: 'h', spans: parseInline(text.slice(3).trim()) })
    else if (/^(-{3,}|\*{3,})$/.test(text)) blocks.push({ type: 'break', spans: [] })
    else blocks.push({ type: 'p', spans: parseInline(text) })
  }
  const words = blocks.reduce((sum, b) => sum + b.spans.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0), 0)
  return { title, blocks, words, minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) }
}

const FILES = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true })

// Every chapter, in order: { id, number, title, blocks, words, minutes }.
export const STORIES = Object.keys(FILES)
  .sort()
  .map((path, i) => ({ id: path.replace(/^\.\/|\.md$/g, ''), number: i + 1, ...parseStory(FILES[path]) }))
