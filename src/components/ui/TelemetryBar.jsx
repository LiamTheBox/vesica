import { useSimStore } from '../../store/useSimStore'

export default function TelemetryBar() {
  const volume = useSimStore((s) => s.volume)
  const maxCapacity = useSimStore((s) => s.maxCapacity)
  const stamina = useSimStore((s) => s.kegelStamina)
  const pressure = useSimStore((s) => s.pressure)
  const flowRate = useSimStore((s) => s.flowRate)
  const toneStrain = useSimStore((s) => s.sphincterToneStrain)

  const fillPct = Math.min(100, Math.round((volume / maxCapacity) * 100))
  const stamPct = Math.min(100, Math.round(stamina * 100))

  return (
    <div className="glass-hud px-3 py-2 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs w-full max-w-4xl mx-auto pointer-events-auto">
      {/* Volume Gauge */}
      <div className="flex-1 min-w-[120px]">
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1">
          <span>VOLUME</span>
          <span className="font-bold text-amber-300">{Math.round(volume)} / {maxCapacity} ml</span>
        </div>
        <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
          <div className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-rose-500 transition-all duration-150" style={{ width: `${fillPct}%` }}></div>
        </div>
      </div>

      {/* Stamina Gauge */}
      <div className="w-24 sm:w-28 flex-shrink-0">
        <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono mb-1">
          <span>KEGEL STAMINA</span>
          <span className="font-bold text-cyan-400">{stamPct}%</span>
        </div>
        <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-100" style={{ width: `${stamPct}%` }}></div>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[9px] text-slate-400 font-mono uppercase">Pressure</div>
        <div className="text-xs sm:text-sm font-black font-mono text-emerald-400">{pressure.toFixed(1)} cmH₂O</div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[9px] text-slate-400 font-mono uppercase">Jet Velocity</div>
        <div className="text-xs sm:text-sm font-black font-mono text-amber-300">{flowRate.toFixed(1)} ml/s</div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[9px] text-slate-400 font-mono uppercase">Sphincter Tone</div>
        <div className="text-xs sm:text-sm font-black font-mono text-rose-400">RESTING ({Math.round(toneStrain * 100)}%)</div>
      </div>
    </div>
  )
}
