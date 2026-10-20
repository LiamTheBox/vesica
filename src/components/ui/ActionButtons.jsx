import { useHud } from '../../store/useUiStore'
import { BEVERAGE_TYPES } from '../../physics/constants'
import { act } from '../../sim/engine'
import { ingestBeverage, soothe, startClench, startVoidAttempt, stopClench, stopVoidAttempt } from '../../sim/sim'
import { slapRandom } from '../../sim/interactions'

const BEVERAGE_LABELS = {
  water: { icon: '💧', name: 'Water', note: '+180ml', tone: 'text-cyan-400' },
  coffee: { icon: '☕', name: 'Espresso', note: 'Diuretic', tone: 'text-amber-400' },
  soda: { icon: '⚡', name: 'Energy', note: '+320ml', tone: 'text-rose-400' },
  beer: { icon: '🍺', name: 'Brew', note: '+480ml', tone: 'text-yellow-400' },
}

// Hold buttons must not scroll, zoom or select while a finger rests on them.
const holdProps = (start, stop) => ({
  onPointerDown: (e) => { e.preventDefault(); act(start) },
  onPointerUp: (e) => { e.preventDefault(); act(stop) },
  onPointerLeave: () => act(stop),
  onPointerCancel: () => act(stop),
})

export default function ActionButtons() {
  const isClenching = useHud((h) => h.isClenching)
  const clenchExhausted = useHud((h) => h.clenchExhausted)
  const isAttemptingVoid = useHud((h) => h.isAttemptingVoid)
  const isActivelyVoiding = useHud((h) => h.isActivelyVoiding)
  const voidProgress = useHud((h) => h.voidProgress)
  const voidSecondsLeft = useHud((h) => h.voidSecondsLeft)

  const clenchLabel = isClenching ? 'CLENCHING!' : clenchExhausted ? 'CLENCH EXHAUSTED!' : 'CLENCH (HOLD)'
  const voidLabel = isActivelyVoiding ? 'VOIDING...' : isAttemptingVoid ? 'RELAXING VALVE...' : 'EMPTY (HOLD)'
  const voidSub = isActivelyVoiding
    ? 'Draining at optimal flow'
    : isAttemptingVoid ? `Relaxing... ${voidSecondsLeft.toFixed(1)}s` : 'Latency: 1.0s to initiate'

  return (
    <div className="w-full flex flex-col gap-2 max-w-xl mx-auto pointer-events-auto">
      {/* Fluid Ingestion */}
      <div className="glass-hud p-1.5 rounded-2xl flex items-center justify-between gap-1 sm:gap-2">
        {Object.keys(BEVERAGE_TYPES).map((key) => (
          <button key={key} onClick={() => act(ingestBeverage, key)} className="flex-1 py-1.5 px-1 bg-slate-800/70 hover:bg-cyan-950/70 active:scale-95 border border-slate-700 hover:border-cyan-500/80 rounded-xl flex flex-col items-center transition">
            <span className="text-sm sm:text-base">{BEVERAGE_LABELS[key].icon}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-200">{BEVERAGE_LABELS[key].name}</span>
            <span className={`text-[8px] sm:text-[9px] font-mono ${BEVERAGE_LABELS[key].tone}`}>{BEVERAGE_LABELS[key].note}</span>
          </button>
        ))}
      </div>

      {/* Main Actions */}
      <div className="flex items-stretch gap-1.5 sm:gap-2">
        <button
          {...holdProps(startClench, stopClench)}
          className={`flex-1 py-3 px-2.5 rounded-2xl font-extrabold text-xs tracking-wider uppercase shadow-lg transition flex flex-col items-center justify-center border-2 select-none cursor-pointer touch-none ${isClenching ? 'bg-cyan-500 border-cyan-200 scale-95 shadow-cyan-500/50 text-white' : 'bg-gradient-to-r from-sky-600 via-cyan-500 to-blue-600 hover:from-sky-500 hover:to-blue-500 border-cyan-300 text-white shadow-cyan-600/30'}`}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🛡️</span>
            <span>{clenchLabel}</span>
          </div>
          <span className="text-[9px] text-cyan-100 font-mono font-normal">Reinforce Sphincter</span>
        </button>

        <div className="flex-1 relative rounded-2xl overflow-hidden">
          <button
            {...holdProps(startVoidAttempt, stopVoidAttempt)}
            className={`w-full h-full py-3 px-2.5 rounded-2xl font-black text-xs tracking-wider uppercase shadow-xl transition flex flex-col items-center justify-center border-2 select-none cursor-pointer touch-none relative z-10 ${isAttemptingVoid ? 'bg-amber-400 border-amber-200 scale-95 shadow-amber-400/50 text-slate-900' : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 border-amber-200 text-slate-950 shadow-yellow-500/20'}`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
              <span>{voidLabel}</span>
            </div>
            <span className="text-[9px] text-slate-800 font-mono font-bold">{voidSub}</span>
          </button>
          <div className="absolute bottom-0 left-0 h-1.5 bg-rose-600 z-20 transition-all duration-75" style={{ width: `${voidProgress * 100}%` }}></div>
        </div>

        <button
          onClick={() => act(soothe)}
          className="px-3 py-3 rounded-2xl glass-hud hover:border-emerald-400/80 text-emerald-300 font-bold text-xs uppercase active:scale-95 transition flex flex-col items-center justify-center flex-shrink-0"
          title="Soothe Detrusor"
        >
          <span className="text-sm">🧘</span>
          <span className="text-[9px] font-mono mt-0.5">Soothe</span>
        </button>

        <button
          onClick={() => act(slapRandom)}
          className="px-3 py-3 rounded-2xl glass-hud hover:border-amber-400/80 text-amber-300 font-bold text-xs uppercase active:scale-95 transition flex flex-col items-center justify-center flex-shrink-0"
          title="Slap Bladder"
        >
          <span className="text-sm">👋</span>
          <span className="text-[9px] font-mono mt-0.5">Slap</span>
        </button>
      </div>
    </div>
  )
}
