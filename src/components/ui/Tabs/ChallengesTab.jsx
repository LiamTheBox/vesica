import { useSimStore } from '../../../store/useSimStore'
import { audio } from '../../../audio/AudioManager'

export default function ChallengesTab() {
  const currentTab = useSimStore(s => s.currentTab)
  const setTab = useSimStore.getState().setTab
  const activeChallenge = useSimStore(s => s.activeChallenge)
  const challengeTimer = useSimStore(s => s.challengeTimer)
  const totalLeaked = useSimStore(s => s.totalLeakedVolume)
  const volume = useSimStore(s => s.volume)
  const precisionStartVolume = useSimStore(s => s.precisionStartVolume)

  if (currentTab !== 'challenges') return null

  const startCommute = () => {
    useSimStore.setState({
      volume: 580,
      totalLeakedVolume: 0,
      activeChallenge: 'commute',
      challengeTimer: 60.0,
      challengePotholeTimer: 8.0,
      currentTab: 'sim'
    })
    audio.playGranularSlosh(0.8)
  }

  const startPrecision = () => {
    useSimStore.setState({
      volume: 520,
      activeChallenge: 'precision',
      precisionStartVolume: 520,
      currentTab: 'sim'
    })
  }

  // Determine status display
  let commuteStatus = <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">READY</span>
  if (activeChallenge === 'commute') {
    commuteStatus = <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 animate-pulse">IN PROGRESS ({Math.round(challengeTimer)}s)</span>
  } else if (challengeTimer <= 0 && activeChallenge === null && totalLeaked !== undefined) {
     // Wait, challenge history tracking is complex, just keeping it simple
  }

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto p-4 flex flex-col justify-center items-center bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-2xl w-full glass-modal p-5 rounded-3xl flex flex-col gap-4 border border-slate-700/60">
        <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-cyan-400 font-mono uppercase tracking-wider">Continence Challenges</h2>
            <p className="text-xs text-slate-400">Test reflexes against fluid rushes and random disturbances</p>
          </div>
          <button onClick={() => setTab('sim')} className="text-slate-400 hover:text-white text-lg font-bold p-1">✕</button>
        </div>

        {/* Challenge 1 */}
        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="font-extrabold text-xs text-slate-200">🚌 Rush Hour Commute (60s Survival)</div>
            {commuteStatus}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            High initial volume with sudden potholes and urge contractions. Survive the full 60 seconds with less than 20ml total leakage!
          </p>
          <button onClick={startCommute} className="w-full py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 rounded-xl font-bold text-xs uppercase tracking-wider transition">
            Start Commute Run
          </button>
        </div>

        {/* Challenge 2 */}
        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="font-extrabold text-xs text-slate-200">🎯 Precision Void (Target: Exactly 200ml)</div>
            {activeChallenge === 'precision' ? 
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 animate-pulse">HOLD TO VOID</span> :
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">READY</span>
            }
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Account for latency and flow momentum to void exactly 200ml (±10ml tolerance) in a single continuous hold.
          </p>
          <button onClick={startPrecision} className="w-full py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 rounded-xl font-bold text-xs uppercase tracking-wider transition">
            Attempt Precision Void
          </button>
        </div>
      </div>
    </div>
  )
}
