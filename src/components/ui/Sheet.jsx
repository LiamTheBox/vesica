// A panel that slides up from the bottom on phones (centred on wider screens). It
// scrolls inside itself on short screens; the rest of the page blocks touch
// scrolling, so the sheet opts back in with `touch-action: pan-y`. `scrollRef` and
// `onScroll` reach that scrolling panel (the stories reader keeps your place with them).
export default function Sheet({ title, subtitle, titleTone = 'text-slate-200', onClose, children, width = 'max-w-2xl', scrollRef, onScroll }) {
  return (
    <div
      className="absolute inset-0 z-30 pointer-events-auto flex flex-col justify-end sm:justify-center items-center sm:p-4 bg-slate-950/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`sheet-animate w-full ${width} max-h-[90dvh] overflow-y-auto overscroll-contain glass-modal rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-4 border border-slate-700/60`}
        style={{ touchAction: 'pan-y', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        {/* Pinned while the panel scrolls, so ✕ is always in reach. It pins at the panel's
            top edge, over its padding (-top-5 and pt-5 match p-5), or what scrolls past
            shows through above it. */}
        <div className="sticky -top-5 z-10 -mt-5 pt-5 bg-[rgb(11,19,38)] flex justify-between items-center gap-2 pb-2 border-b border-slate-700/60">
          <div className="min-w-0">
            <h2 className={`text-sm sm:text-base font-extrabold font-mono uppercase tracking-wider ${titleTone}`}>{title}</h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white text-lg font-bold min-w-11 min-h-11 flex-shrink-0">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
