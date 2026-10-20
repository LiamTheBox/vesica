import { useEffect, useState } from 'react'
import { useHud, useUiStore } from '../../store/useUiStore'
import { organStatus } from './status'

export function Subtitles() {
  const subtitle = useUiStore((s) => s.currentSubtitle)
  // Each subtitle shows for 5 s; a newer one restarts the timer.
  const [expiredId, setExpiredId] = useState(null)
  const visible = !!subtitle && subtitle.id !== expiredId

  useEffect(() => {
    if (!subtitle) return
    const timer = setTimeout(() => setExpiredId(subtitle.id), 5000)
    return () => clearTimeout(timer)
  }, [subtitle])

  if (!subtitle) return null

  const getIcon = (cat) => {
    if (['critical', 'involuntary'].includes(cat)) return '😫'
    if (cat === 'leak') return '💦'
    if (cat === 'clench') return '🛡️'
    if (cat === 'soothe') return '🧘'
    if (cat === 'cough') return '🤧'
    if (cat === 'shaken') return '📳'
    if (cat === 'squeezed') return '🤏'
    if (cat === 'full') return '😬'
    if (cat === 'voiding') return '😌'
    if (cat === 'poked') return '⚡'
    if (cat === 'deflated') return '💤'
    return '🗣️'
  }

  return (
    <div className={`pointer-events-none absolute top-28 sm:top-32 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-4 flex justify-center transition-opacity duration-200 ${visible ? 'opacity-100 bubble-animate' : 'opacity-0'}`}>
      <div className="glass-hud px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 border border-amber-400/40 max-w-full">
        <div className="text-xl flex-shrink-0">{getIcon(subtitle.category)}</div>
        <div className="text-left overflow-hidden">
          <div className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400 font-mono">Vesica (Bladder)</div>
          <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug break-words">
            "{subtitle.text}"
          </p>
        </div>
      </div>
    </div>
  )
}

export function Alerts() {
  const isStressLeaking = useHud((h) => h.isStressLeaking)
  const involuntaryVoiding = useHud((h) => h.involuntaryVoiding)
  const isUrgeWaveActive = useHud((h) => h.isUrgeWaveActive)
  const status = useHud(organStatus)

  return (
    <>
      {/* Red screen edge: overpressure 35%, stress leak 70%, total failure 95% pulsing. */}
      <div
        data-testid="vignette"
        className={`pointer-events-none fixed inset-0 z-10 box-border border-[10px] sm:border-[16px] border-rose-600/60 transition-opacity duration-300 ${status.vignettePulse ? 'fatigue-vignette' : ''}`}
        style={{ opacity: status.vignette }}
      ></div>

      {isUrgeWaveActive && (
        <div className="pointer-events-none absolute top-40 sm:top-44 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-amber-500/90 text-slate-950 text-xs font-black tracking-wider uppercase shadow-xl animate-pulse flex items-center gap-2">
          <span>⚡</span><span>DETRUSOR CONTRACTION WAVE INCOMING!</span>
        </div>
      )}

      {isStressLeaking && (
        <div className="pointer-events-none absolute top-48 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-rose-600/95 text-white text-xs font-black tracking-wider uppercase shadow-xl shadow-rose-600/50 animate-bounce text-center">
          💦 STRESS LEAK OCCURRED! PRESSURE EQUALIZING...
        </div>
      )}

      {involuntaryVoiding && (
        <div className="pointer-events-none absolute top-56 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full bg-red-600/95 text-white text-xs font-black tracking-widest uppercase shadow-2xl shadow-red-600/60 animate-bounce text-center">
          ⚠️ SPHINCTER FAILURE: TOTAL RETENTION COLLAPSE!
        </div>
      )}
    </>
  )
}
