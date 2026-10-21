import { useEffect, useState } from 'react'
import { useHud, useUiStore } from '../../store/useUiStore'
import { act } from '../../sim/engine'
import { startCommuteChallenge, startPrecisionChallenge } from '../../sim/sim'
import { startArcadeRun } from '../../sim/arcade'
import { clock } from '../../challenges/bests'

const COMMUTE_LIMIT_ML = 20
const COMMUTE_SECONDS = 60

const LINE_TONES = {
  good: 'text-emerald-300',
  ok: 'text-sky-300',
  warn: 'text-amber-300',
  bad: 'text-rose-400',
  level: 'text-fuchsia-300',
}

// The arcade run: level, time held, score, combo, and the latest score line for 1.5 s.
function ArcadeBanner() {
  const score = useHud((h) => h.arcadeScore)
  const combo = useHud((h) => h.arcadeCombo)
  const level = useHud((h) => h.arcadeLevel)
  const seconds = useHud((h) => h.arcadeSeconds)
  const line = useUiStore((s) => s.arcadeToast)
  const [expiredId, setExpiredId] = useState(null)

  useEffect(() => {
    if (!line) return
    const timer = setTimeout(() => setExpiredId(line.id), 1500)
    return () => clearTimeout(timer)
  }, [line])

  const showLine = line && line.id !== expiredId
  return (
    <div data-testid="challenge-banner" className="glass-hud w-full max-w-xl mx-auto px-3 py-1.5 rounded-2xl pointer-events-auto font-mono text-[11px]">
      <div className="flex justify-between items-center gap-2">
        <span className="font-bold text-fuchsia-300 whitespace-nowrap">🕹️ ARCADE · LV {level} · {clock(seconds)}</span>
        <span data-testid="arcade-score" className="font-black text-amber-300 text-xs whitespace-nowrap">★ {score.toLocaleString('en-US')}</span>
      </div>
      <div className="flex justify-between items-center gap-2 min-h-4">
        <span className={combo > 1 ? 'font-bold text-emerald-300' : 'text-slate-500 truncate'}>
          {combo > 1 ? `COMBO ×${combo}` : 'Clench as each urge lands'}
        </span>
        {showLine && <span key={line.id} className={`font-bold whitespace-nowrap bubble-animate ${LINE_TONES[line.tone]}`}>{line.text}</span>}
      </div>
    </div>
  )
}

// Live status of the running challenge, shown on the Sim screen above the controls.
export function ChallengeBanner() {
  const activeChallenge = useHud((h) => h.activeChallenge)
  const seconds = useHud((h) => h.challengeSeconds)
  const leaked = useHud((h) => h.totalLeaked)

  if (activeChallenge === 'arcade') return <ArcadeBanner />

  if (activeChallenge === 'commute') {
    const over = leaked > COMMUTE_LIMIT_ML
    return (
      <div data-testid="challenge-banner" className="glass-hud w-full max-w-xl mx-auto px-3 py-1.5 rounded-2xl pointer-events-auto font-mono text-[11px]">
        <div className="flex justify-between items-center gap-2">
          <span className="font-bold text-sky-300">🚌 COMMUTE · {seconds}s left</span>
          <span className={over ? 'font-bold text-rose-400' : 'text-slate-300'}>
            {leaked} / {COMMUTE_LIMIT_ML} ml leaked
          </span>
        </div>
        <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-sky-400 transition-all duration-500" style={{ width: `${(seconds / COMMUTE_SECONDS) * 100}%` }} />
        </div>
      </div>
    )
  }

  if (activeChallenge === 'precision') {
    return (
      <div data-testid="challenge-banner" className="glass-hud w-full max-w-xl mx-auto px-3 py-1.5 rounded-2xl pointer-events-auto font-mono text-[11px] text-center">
        <span className="font-bold text-amber-300">🎯 PRECISION · </span>
        <span className="text-slate-300">hold EMPTY, let go at exactly 200 ml</span>
      </div>
    )
  }

  return null
}

const RETRY = { commute: startCommuteChallenge, precision: startPrecisionChallenge, arcade: startArcadeRun }
const TITLES = { commute: '🚌 Rush Hour Commute', precision: '🎯 Precision Void', arcade: '🕹️ Arcade Run' }

// The finished challenge's result. Stays until dismissed: on a phone the Challenges
// tab is closed while playing, so this is where the result is seen.
export function ChallengeResultCard() {
  const result = useUiStore((s) => s.lastResult)
  const dismiss = useUiStore((s) => s.dismissResult)
  if (!result) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 pointer-events-auto bg-slate-950/50" onClick={dismiss}>
      <div
        role="dialog"
        aria-label="Challenge result"
        onClick={(e) => e.stopPropagation()}
        className={`glass-modal bubble-animate w-full max-w-xs rounded-3xl p-5 flex flex-col items-center gap-2 text-center border ${result.success ? 'border-emerald-500/60' : 'border-rose-500/60'}`}
      >
        <div className="text-xs font-mono text-slate-400">{TITLES[result.challenge]}</div>
        <div className={`text-lg font-black tracking-wide ${result.success ? 'text-emerald-400' : 'text-rose-400'}`}>{result.text}</div>
        {result.detail && <div className="text-[11px] font-mono text-slate-300">{result.detail}</div>}
        {result.newBest && <div className="text-xs font-bold text-amber-300">★ New best!</div>}
        <div className="flex gap-2 w-full mt-2">
          <button
            onClick={() => { dismiss(); act(RETRY[result.challenge]) }}
            className="flex-1 min-h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider"
          >
            Retry
          </button>
          <button onClick={dismiss} className="flex-1 min-h-11 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold uppercase tracking-wider">
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
