import { useSimStore } from '../../store/useSimStore'
import { BEVERAGE_TYPES } from '../../physics/constants'

export default function ActionButtons() {
  const ingest = useSimStore((s) => s.ingestBeverage)
  const startClench = useSimStore((s) => s.startClench)
  const stopClench = useSimStore((s) => s.stopClench)
  const startVoid = useSimStore((s) => s.startVoidAttempt)
  const stopVoid = useSimStore((s) => s.stopVoidAttempt)
  const triggerSoothe = useSimStore((s) => s.triggerSoothe)
  
  const isClenching = useSimStore((s) => s.isClenching)
  const isAttemptingVoid = useSimStore((s) => s.isAttemptingVoid)
  const voidLatencyTimer = useSimStore(s => s.voidLatencyTimer)

  const handleSlap = () => {
    useSimStore.getState().setInteractionMode('slap')
    // A quick slap mode switch, though in original it was just a button that you click to trigger a slap impulse?
    // Oh, the original HTML had: onclick="triggerSlapImpulse()" which directly called it.
    // Let's implement that.
    const sim = useSimStore.getState()
    const strength = 2.4
    sim.updateSim(s => ({
      jiggleIntensity: Math.min(1.0, s.jiggleIntensity + 0.6 * strength),
      sloshVelX: s.sloshVelX + (Math.random() - 0.5) * 4.0 * strength,
      sloshVelZ: s.sloshVelZ + (Math.random() - 0.5) * 4.0 * strength,
      sphincterToneStrain: Math.min(1.0, s.sphincterToneStrain + 0.15)
    }))
    sim.addRipple({ center: { x: (Math.random()-0.5)*2, y: 0.5, z: (Math.random()-0.5)*2 }, radius: 0.1, maxRadius: 3.8, speed: 7.5, amplitude: 0.65 * strength, decay: 3.5 })
    
    // Call global audio since it's hard to reach here cleanly without importing
    // We can just import audio
  }

  const bevIcons = {
    water: { icon: '💧', name: 'Water' },
    coffee: { icon: '☕', name: 'Espresso' },
    soda: { icon: '⚡', name: 'Energy' },
    beer: { icon: '🍺', name: 'Brew' }
  }

  return (
    <div className="w-full flex flex-col gap-2 max-w-xl mx-auto pointer-events-auto">
      {/* Fluid Ingestion */}
      <div className="glass-hud p-1.5 rounded-2xl flex items-center justify-between gap-1 sm:gap-2">
        {Object.entries(BEVERAGE_TYPES).map(([key, bev]) => (
          <button key={key} onClick={() => ingest(bev)} className="flex-1 py-1.5 px-1 bg-slate-800/70 hover:bg-cyan-950/70 active:scale-95 border border-slate-700 hover:border-cyan-500/80 rounded-xl flex flex-col items-center transition">
            <span className="text-sm sm:text-base">{bevIcons[key].icon}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-200">{bevIcons[key].name}</span>
            <span className={`text-[8px] sm:text-[9px] font-mono ${key==='coffee'?'text-amber-400':key==='soda'?'text-rose-400':key==='beer'?'text-yellow-400':'text-cyan-400'}`}>
              {key === 'coffee' ? 'Diuretic' : `+${bev.vol}ml`}
            </span>
          </button>
        ))}
      </div>

      {/* Main Actions */}
      <div className="flex items-stretch gap-1.5 sm:gap-2">
        <button 
          onPointerDown={startClench}
          onPointerUp={stopClench}
          onPointerLeave={stopClench}
          onPointerCancel={stopClench}
          className={`flex-1 py-3 px-2.5 rounded-2xl font-extrabold text-xs tracking-wider uppercase shadow-lg transition flex flex-col items-center justify-center border-2 select-none cursor-pointer touch-none ${isClenching ? 'bg-cyan-500 border-cyan-200 scale-95 shadow-cyan-500/50 text-white' : 'bg-gradient-to-r from-sky-600 via-cyan-500 to-blue-600 hover:from-sky-500 hover:to-blue-500 border-cyan-300 text-white shadow-cyan-600/30'}`}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🛡️</span>
            <span>{isClenching ? 'CLENCHING!' : 'CLENCH (HOLD)'}</span>
          </div>
          <span className="text-[9px] text-cyan-100 font-mono font-normal">Reinforce Sphincter</span>
        </button>
        
        <div className="flex-1 relative rounded-2xl overflow-hidden">
          <button 
            onPointerDown={startVoid}
            onPointerUp={stopVoid}
            onPointerLeave={stopVoid}
            onPointerCancel={stopVoid}
            className={`w-full h-full py-3 px-2.5 rounded-2xl font-black text-xs tracking-wider uppercase shadow-xl transition flex flex-col items-center justify-center border-2 select-none cursor-pointer touch-none relative z-10 ${isAttemptingVoid ? 'bg-amber-400 border-amber-200 scale-95 shadow-amber-400/50 text-slate-900' : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 border-amber-200 text-slate-950 shadow-yellow-500/20'}`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
              </svg>
              <span>{isAttemptingVoid ? 'RELAXING VALVE...' : 'EMPTY (HOLD)'}</span>
            </div>
            <span className="text-[9px] text-slate-800 font-mono font-bold">
              {isAttemptingVoid ? `Relaxing... ${(1.0 - voidLatencyTimer).toFixed(1)}s` : 'Latency: 1.0s to initiate'}
            </span>
          </button>
          <div className="absolute bottom-0 left-0 h-1.5 bg-rose-600 z-20 transition-all duration-75" style={{ width: `${Math.min(100, voidLatencyTimer * 100)}%` }}></div>
        </div>

        <button 
          onClick={triggerSoothe} 
          className="px-3 py-3 rounded-2xl glass-hud hover:border-emerald-400/80 text-emerald-300 font-bold text-xs uppercase active:scale-95 transition flex flex-col items-center justify-center flex-shrink-0"
          title="Soothe Detrusor"
        >
          <span className="text-sm">🧘</span>
          <span className="text-[9px] font-mono mt-0.5">Soothe</span>
        </button>

        <button 
          onClick={() => {
            document.dispatchEvent(new CustomEvent('triggerSlap'))
          }} 
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
