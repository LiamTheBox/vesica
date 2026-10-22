import { useHud } from '../../store/useUiStore'
import { organStatus, sphincterReadout } from './status'
import { countRender } from '../../debug/devHook'
import { t } from '../../i18n'

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
  const caffeinated = useHud((h) => h.caffeinated)
  const tipsy = useHud((h) => h.tipsy)

  const fillPct = Math.min(100, Math.round((volume / maxCapacity) * 100))

  return (
    <div className="glass-hud px-3 py-1.5 rounded-2xl flex flex-col gap-1.5 w-full pointer-events-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 items-end">
        <div className="min-w-0">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1">
            <span>{t('bar.volume')} {caffeinated && <span role="img" aria-label={t('bar.caffeine')} title={t('bar.caffeine')}>☕</span>}</span>
            {/* With no limit (the arcade), the bar still fills up to full. */}
            <span className="font-bold text-amber-300">{t('bar.volumeOf', { volume, most: endless ? '∞' : maxCapacity })}</span>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-rose-500 transition-all duration-150" style={{ width: `${fillPct}%` }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono mb-1">
            <span>{t('bar.kegel')} {tipsy && <span role="img" aria-label={t('bar.alcohol')} title={t('bar.alcohol')}>🍺</span>}</span>
            <span className="font-bold text-cyan-400">{stamPct}%</span>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-100" style={{ width: `${stamPct}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-3">
        <Reading label={t('bar.pressure')} testId="pressure" className={pressureTone}>{t('unit.cmH2O', { n: pressure.toFixed(1) })}</Reading>
        <Reading label={t('bar.flow')} className="text-amber-300">{t('unit.mlPerS', { n: flowRate.toFixed(1) })}</Reading>
        <div className="text-right min-w-0">
          <Reading label={t('bar.sphincter')} testId="sphincter-readout" className={sphincterTone}>{sphincterText}</Reading>
        </div>
      </div>
    </div>
  )
}
