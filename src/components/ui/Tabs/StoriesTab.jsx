import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../../../store/useUiStore'
import { STORIES } from '../../../stories/stories'
import { loadReading, saveReading, TEXT_SIZES } from '../../../stories/reading'
import Sheet from '../Sheet'
import { t } from '../../../i18n'

// The stories (M9): optional reading, never part of play. The chapters, and a reader that
// remembers the chapter, the place in it and the text size.

const BUTTON = 'min-h-11 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition active:scale-95 disabled:opacity-40'

function Spans({ spans }) {
  return spans.map((s, i) => (s.strong ? <strong key={i}>{s.text}</strong> : s.em ? <em key={i}>{s.text}</em> : <span key={i}>{s.text}</span>))
}

// How far down the panel is, 0..1.
const placeOf = (el) => (el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0)

export default function StoriesTab() {
  const setTab = useUiStore((s) => s.setTab)
  const [reading, setReading] = useState(loadReading)
  const scrollRef = useRef(null)
  const frame = useRef(0)
  const restored = useRef(null) // the chapter whose place has been put back
  const story = STORIES.find((s) => s.id === reading.chapter) ?? null
  const chapterId = story?.id ?? null

  const update = (patch) => setReading((current) => {
    const next = { ...current, ...patch }
    saveReading(next)
    return next
  })
  const open = (id) => update({ chapter: id })

  // Back to where you were, in a chapter (or the top of the list). Until then, scrolling
  // (the panel settling as it opens) doesn't count as reading.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const place = chapterId ? (loadReading().places[chapterId] ?? 0) : 0
    el.scrollTop = place * (el.scrollHeight - el.clientHeight)
    restored.current = chapterId
  }, [chapterId])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // Keeps the place while reading (at most once a frame).
  const onScroll = () => {
    if (!chapterId || restored.current !== chapterId || frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = scrollRef.current
      if (!el) return
      const place = Math.round(placeOf(el) * 1000) / 1000
      setReading((current) => {
        if (current.places[chapterId] === place) return current
        const next = { ...current, places: { ...current.places, [chapterId]: place } }
        saveReading(next)
        return next
      })
    })
  }

  const close = () => setTab('sim')
  const index = story ? STORIES.indexOf(story) : -1

  return (
    <Sheet title={t('stories.title')} subtitle={t('stories.subtitle')} titleTone="text-rose-300" onClose={close} scrollRef={scrollRef} onScroll={onScroll}>
      {!story && (
        <div className="flex flex-col gap-2">
          {STORIES.map((s) => {
            const place = reading.places[s.id] ?? 0
            const badge = place >= 0.98 ? t('stories.read') : place > 0.02 ? t('stories.continue') : null
            return (
              <button
                key={s.id}
                onClick={() => open(s.id)}
                className="p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/60 text-left flex items-center justify-between gap-3 transition"
              >
                <span className="min-w-0">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">{t('stories.chapter', { n: s.number })}</span>
                  <span className="block text-sm font-bold text-slate-100">{s.title}</span>
                  <span className="block text-[11px] font-mono text-slate-400">{t('stories.minutes', { n: s.minutes })}</span>
                </span>
                {badge && <span className="text-[10px] font-mono font-bold text-rose-300 whitespace-nowrap">{badge}</span>}
              </button>
            )
          })}
        </div>
      )}

      {story && (
        <article className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => open(null)} className={BUTTON}>{t('stories.back')}</button>
            <div className="flex items-center gap-1.5">
              <button aria-label={t('stories.smaller')} disabled={reading.size === 0} onClick={() => update({ size: reading.size - 1 })} className={BUTTON}>A−</button>
              <button aria-label={t('stories.larger')} disabled={reading.size === TEXT_SIZES.length - 1} onClick={() => update({ size: reading.size + 1 })} className={BUTTON}>A+</button>
            </div>
          </div>
          <header>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t('stories.chapterOf', { n: story.number, total: STORIES.length })}</div>
            <h3 className="text-lg font-extrabold text-slate-100">{story.title}</h3>
          </header>
          <div className={`flex flex-col gap-3 leading-relaxed text-slate-200 max-w-prose ${TEXT_SIZES[reading.size]}`}>
            {story.blocks.map((block, i) => {
              if (block.type === 'break') return <div key={i} aria-hidden="true" className="text-center text-slate-500 tracking-[0.6em]">⁂</div>
              if (block.type === 'h') return <h4 key={i} className="font-bold text-slate-100 mt-2"><Spans spans={block.spans} /></h4>
              return <p key={i}><Spans spans={block.spans} /></p>
            })}
          </div>
          <div className="flex justify-between gap-2 pt-2 border-t border-slate-700/60">
            <button disabled={index === 0} onClick={() => open(STORIES[index - 1].id)} className={BUTTON}>{t('stories.previous')}</button>
            {index < STORIES.length - 1
              ? <button onClick={() => open(STORIES[index + 1].id)} className={BUTTON}>{t('stories.next')}</button>
              : <button onClick={() => open(null)} className={BUTTON}>{t('stories.all')}</button>}
          </div>
        </article>
      )}
    </Sheet>
  )
}
