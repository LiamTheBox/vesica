import { t } from '../../i18n'

// A panel that slides up from the bottom on phones (centred on wider screens). It
// scrolls inside itself on short screens; the rest of the page blocks touch
// scrolling, so the sheet opts back in with `touch-action: pan-y`.
// `fullHeight` lets it use all of the screen's height, for what's meant to fit without
// scrolling.
export default function Sheet({ title, subtitle, titleTone = 'text-slate-200', onClose, children, width = 'max-w-2xl', fullHeight = false }) {
  return (
    <div
      className={`absolute inset-0 z-30 pointer-events-auto flex flex-col justify-end sm:justify-center items-center bg-slate-950/70 backdrop-blur-md ${fullHeight ? 'sm:p-1' : 'sm:p-4'}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`sheet-animate w-full ${width} ${fullHeight ? 'max-h-[calc(100dvh-env(safe-area-inset-top))] gap-2 px-3 sm:px-5' : 'max-h-[90dvh] gap-4 px-5'} overflow-y-auto overscroll-contain glass-modal rounded-t-3xl sm:rounded-3xl pt-5 flex flex-col border border-slate-700/60`}
        style={{ touchAction: 'pan-y', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        {/* Pinned while the panel scrolls, so ✕ is always in reach. It pins at the panel's
            top edge, over its padding (-top-5 and pt-5 match p-5), or what scrolls past
            shows through above it. */}
        <div className={`sticky -top-5 z-10 -mt-5 bg-[rgb(11,19,38)] flex justify-between items-center gap-2 border-b border-slate-700/60 ${fullHeight ? 'pt-3 pb-1' : 'pt-5 pb-2'}`}>
          <div className="min-w-0">
            <h2 className={`text-sm sm:text-base font-extrabold font-mono uppercase tracking-wider ${titleTone}`}>{title}</h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label={t('sheet.close')} className="text-slate-400 hover:text-white text-lg font-bold min-w-11 min-h-11 flex-shrink-0">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
