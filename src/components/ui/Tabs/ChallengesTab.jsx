import { useHud, useUiStore } from '../../../store/useUiStore'
import { act } from '../../../sim/engine'
import { startCommuteChallenge, startPrecisionChallenge } from '../../../sim/sim'
import { describeBest } from '../../../challenges/bests'
import Sheet from '../Sheet'

const BADGE = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded'
const TONES = {
  ready: `${BADGE} bg-slate-800 text-slate-400`,
  running: `${BADGE} bg-amber-950 text-amber-400 border border-amber-800 animate-pulse`,
  success: `${BADGE} bg-emerald-950 text-emerald-400 border border-emerald-800`,
  failed: `${BADGE} bg-rose-950 text-rose-400 border border-rose-800`,
}

function StatusBadge({ running, runningText, result }) {
  if (running) return <span className={TONES.running}>{runningText}</span>
  if (result) return <span className={result.success ? TONES.success : TONES.failed}>{result.text}</span>
  return <span className={TONES.ready}>READY</span>
}

export default function ChallengesTab() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)
  const results = useUiStore((s) => s.challengeResults)
  const bests = useUiStore((s) => s.bests)
  const activeChallenge = useHud((h) => h.activeChallenge)
  const challengeSeconds = useHud((h) => h.challengeSeconds)
  const totalLeaked = useHud((h) => h.totalLeaked)

  if (currentTab !== 'challenges') return null

  return (
    <Sheet title="Continence Challenges" subtitle="Test reflexes against fluid rushes and random disturbances" titleTone="text-cyan-400" onClose={() => setTab('sim')}>
      <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <div className="font-extrabold text-xs text-slate-200">🚌 Rush Hour Commute (60s Survival)</div>
          <StatusBadge
            running={activeChallenge === 'commute'}
            runningText={`COMMUTE: ${challengeSeconds}s (${totalLeaked}ml leaked)`}
            result={results.commute}
          />
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          High initial volume with sudden potholes and urge contractions. Survive the full 60 seconds with less than 20ml total leakage!
        </p>
        {bests.commute && <p className="text-[11px] font-mono font-bold text-amber-300">{describeBest('commute', bests.commute)}</p>}
        <button onClick={() => act(startCommuteChallenge)} className="w-full py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 rounded-xl font-bold text-xs uppercase tracking-wider transition">
          Start Commute Run
        </button>
      </div>

      <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <div className="font-extrabold text-xs text-slate-200">🎯 Precision Void (Target: Exactly 200ml)</div>
          <StatusBadge running={activeChallenge === 'precision'} runningText="HOLD TO VOID 200ml" result={results.precision} />
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Account for latency and flow momentum to void exactly 200ml (±10ml tolerance) in a single continuous hold.
        </p>
        {bests.precision && <p className="text-[11px] font-mono font-bold text-amber-300">{describeBest('precision', bests.precision)}</p>}
        <button onClick={() => act(startPrecisionChallenge)} className="w-full py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 rounded-xl font-bold text-xs uppercase tracking-wider transition">
          Attempt Precision Void
        </button>
      </div>
    </Sheet>
  )
}
