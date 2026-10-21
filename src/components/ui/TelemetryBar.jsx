import { useHud } from '../../store/useUiStore'
import { organStatus, sphincterReadout } from './status'
import { countRender } from '../../debug/devHook'

function Reading({ label, children, className = '', testId }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] text-slate-400 font-mono uppercase truncate">{label}</div>
      <div data-testid={testId} className={`text-xs sm:text-sm font-black font-mono truncate ${className}`}>{children}</div>
    </div>
  )
}

// Two fixed rows so the bar never wraps into a third line on narrow phones:
// volume + kegel stamina, then pressure / jet / sphincter.
export default function TelemetryBar() {
  countRender('TelemetryBar')
  const volume = useHud((h) => h.volume)
  const maxCapacity = useHud((h) => h.maxCapacity)
  const endless = useHud((h) => h.endless)
  const stamPct = useHud((h) => h.staminaPct)
  const pressure = useHud((h) => h.pressure)
  const flowRate = useHud((h) => h.flowRate)
  const sphincterText = useHud((h) => sphincterReadout(h).text)
  const sphincterTone = useHud((h) => sphincterReadout(h).tone)
  const pressureTone = useHud((h) => organStatus(h).pressureTone)

  const fillPct = Math.min(100, Math.round((volume / maxCapacity) * 100))

  return (
    <div className="glass-hud px-3 py-1.5 rounded-2xl flex flex-col gap-1.5 w-full pointer-events-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 items-end">
        <div className="min-w-0">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1">
            <span>VOLUME</span>
            {/* With no limit (the arcade), the bar still fills up to full. */}
            <span className="font-bold text-amber-300">{volume} / {endless ? '∞' : maxCapacity} ml</span>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-rose-500 transition-all duration-150" style={{ width: `${fillPct}%` }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono mb-1">
            <span>KEGEL</span>
            <span className="font-bold text-cyan-400">{stamPct}%</span>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-100" style={{ width: `${stamPct}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-3">
        <Reading label="Pressure" testId="pressure" className={pressureTone}>{pressure.toFixed(1)} cmH₂O</Reading>
        <Reading label="Jet Velocity" className="text-amber-300">{flowRate.toFixed(1)} ml/s</Reading>
        <div className="text-right min-w-0">
          <Reading label="Sphincter Tone" testId="sphincter-readout" className={sphincterTone}>{sphincterText}</Reading>
        </div>
      </div>
    </div>
  )
}
