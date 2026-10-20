import { useEffect, useState } from 'react'
import { useSimStore } from '../../store/useSimStore'

export function Subtitles() {
  const subtitle = useSimStore(s => s.currentSubtitle)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!subtitle) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 5000)
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
  const isStressLeaking = useSimStore(s => s.isStressLeaking)
  const involuntaryVoiding = useSimStore(s => s.involuntaryVoiding)
  const isUrgeWaveActive = useSimStore(s => s.detrusorSpasmIntensity > 0.4 && s.volume / s.maxCapacity > 0.45) // Simplification

  return (
    <>
      <div className={`pointer-events-none fixed inset-0 z-10 box-border border-[10px] sm:border-[16px] border-rose-600/60 transition-opacity duration-300 ${involuntaryVoiding ? 'opacity-95 fatigue-vignette' : isStressLeaking ? 'opacity-70' : 'opacity-0'}`}></div>

      {isUrgeWaveActive && !isStressLeaking && !involuntaryVoiding && (
        <div className="pointer-events-none absolute top-40 sm:top-44 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-amber-500/90 text-slate-950 text-xs font-black tracking-wider uppercase shadow-xl animate-pulse flex items-center gap-2">
          <span>⚡</span><span>DETRUSOR CONTRACTION WAVE INCOMING!</span>
        </div>
      )}

      {isStressLeaking && !involuntaryVoiding && (
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
