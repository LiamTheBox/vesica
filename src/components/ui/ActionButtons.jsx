import { useEffect } from 'react'
import { useHud, useUiStore } from '../../store/useUiStore'
import { DRINK_COUNT, DRINKS, SHELF } from '../../sim/drinks'
import { act } from '../../sim/engine'
import { ingestBeverage, startClench, startVoidAttempt, stopClench, stopVoidAttempt } from '../../sim/sim'
import { t } from '../../i18n'
import { toneOf } from './drinkTones'

// Hold buttons capture their finger, so a thumb drifting off the edge keeps holding,
// and each finger holds independently (Clench with one thumb, poke with the other).
// They must not scroll, zoom or select while held.
const holdProps = (start, stop) => ({
  onPointerDown: (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    act(start)
  },
  onPointerUp: (e) => { e.preventDefault(); act(stop) },
  onPointerCancel: () => act(stop),
  onLostPointerCapture: () => act(stop),
  onContextMenu: (e) => e.preventDefault(),
})

// On a keyboard, Space holds Clench too (everything else is a tap or a hold on a button), but
// not while a sheet is open or text is being typed.
function useSpaceToClench() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.target?.closest?.('input, textarea, select')) return
      if (useUiStore.getState().currentTab !== 'sim') return
      e.preventDefault() // no scrolling, and no click on a focused button
      if (!e.repeat) act(e.type === 'keydown' ? startClench : stopClench)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])
}

export default function ActionButtons() {
  useSpaceToClench()
  const isClenching = useHud((h) => h.isClenching)
  const clenchExhausted = useHud((h) => h.clenchExhausted)
  const isAttemptingVoid = useHud((h) => h.isAttemptingVoid)
  const isActivelyVoiding = useHud((h) => h.isActivelyVoiding)
  const voidProgress = useHud((h) => h.voidProgress)
  const voidSecondsLeft = useHud((h) => h.voidSecondsLeft)
  // An announced threat (arcade): the Clench button calls for the thumb.
  const clenchCue = useHud((h) => h.urgeWarned || h.coughWarned)
  const setTab = useUiStore((s) => s.setTab)

  const clenchLabel = t(isClenching ? 'clench.holding' : clenchExhausted ? 'clench.exhausted' : 'clench.hold')
  const voidLabel = t(isActivelyVoiding ? 'empty.voiding' : isAttemptingVoid ? 'empty.relaxing' : 'empty.hold')
  const voidSub = isActivelyVoiding
    ? t('empty.flowing')
    : isAttemptingVoid ? t('empty.startingIn', { s: voidSecondsLeft.toFixed(1) }) : t('empty.hint')

  return (
    <div className="w-full flex flex-col gap-2 max-w-xl mx-auto pointer-events-auto">
      {/* Fluid Ingestion */}
      <div className="glass-hud p-1.5 rounded-2xl flex items-center justify-between gap-1 sm:gap-2">
        {SHELF.map((key) => (
          <button key={key} onClick={() => act(ingestBeverage, key)} className={`flex-1 min-w-0 py-1.5 px-1 active:scale-95 border rounded-xl flex flex-col items-center transition ${toneOf(key).tile}`}>
            <span className="text-sm sm:text-base">{DRINKS[key].icon}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-200">{t(`drink.${key}`)}</span>
            <span className={`text-[9px] font-mono whitespace-nowrap ${toneOf(key).ml}`}>{t('drinks.ml', { ml: DRINKS[key].vol })}</span>
          </button>
        ))}
        {/* The rest of the drinks, in a menu. */}
        <button onClick={() => setTab('drinks')} aria-haspopup="dialog" className="flex-1 min-w-0 py-1.5 px-1 bg-fuchsia-950/50 hover:bg-fuchsia-900/50 active:scale-95 border border-fuchsia-700/70 hover:border-fuchsia-400/80 rounded-xl flex flex-col items-center transition">
          <span className="text-sm sm:text-base">🍹</span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-200">{t('shelf.menu')}</span>
          <span className="text-[9px] font-mono text-fuchsia-300 whitespace-nowrap">{t('shelf.count', { n: DRINK_COUNT })}</span>
        </button>
      </div>

      {/* What holds: one thumb on each. */}
      <div className="flex items-stretch gap-1.5 sm:gap-2">
        <button
          {...holdProps(startClench, stopClench)}
          title={t('clench.title')}
          className={`flex-1 basis-0 min-w-0 py-3 px-2 rounded-2xl font-extrabold text-xs tracking-wide uppercase shadow-lg transition flex flex-col items-center justify-center border-2 select-none cursor-pointer touch-none ${isClenching ? 'bg-cyan-500 border-cyan-200 scale-95 shadow-cyan-500/50 text-white' : 'bg-gradient-to-r from-sky-600 via-cyan-500 to-blue-600 hover:from-sky-500 hover:to-blue-500 border-cyan-300 text-white shadow-cyan-600/30'} ${clenchCue && !isClenching ? 'ring-4 ring-amber-300 animate-pulse' : ''}`}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-1.5 text-center">
            <span className="text-sm">🛡️</span>
            <span>{clenchLabel}</span>
          </div>
          <span className="hold-hint text-[9px] text-cyan-100 font-mono font-normal">{t('clench.hint')}</span>
        </button>

        <div className="flex-1 basis-0 min-w-0 relative rounded-2xl overflow-hidden">
          <button
            {...holdProps(startVoidAttempt, stopVoidAttempt)}
            className={`w-full h-full py-3 px-2 rounded-2xl font-black text-xs tracking-wide uppercase shadow-xl transition flex flex-col items-center justify-center border-2 select-none cursor-pointer touch-none relative z-10 ${isAttemptingVoid ? 'bg-amber-400 border-amber-200 scale-95 shadow-amber-400/50 text-slate-900' : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 border-amber-200 text-slate-950 shadow-yellow-500/20'}`}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 text-center">
              <svg className="w-3.5 h-3.5 animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
              <span>{voidLabel}</span>
            </div>
            <span className="hold-hint text-[9px] text-slate-800 font-mono font-bold">{voidSub}</span>
          </button>
          <div className="absolute bottom-0 left-0 h-1.5 bg-rose-600 z-20 transition-all duration-75" style={{ width: `${voidProgress * 100}%` }}></div>
        </div>
      </div>
    </div>
  )
}
