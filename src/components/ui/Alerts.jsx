import { useEffect, useState } from 'react'
import { useHud, useUiStore } from '../../store/useUiStore'
import { organStatus } from './status'
import { MOOD_FACES } from '../../feedback/mood'

// What a line is about, where that says more than the bladder's face; otherwise the face
// it said it with.
const SUBTITLE_ICONS = {
  leak: '💦', slipping: '💦', clench: '🛡️', coughBraced: '🛡️', soothe: '🧘', cough: '🤧', sneezeIncoming: '🤧',
  shaken: '📳', squeezed: '🤏', squeezeEmpty: '🤏', urge: '⚡', urgeIncoming: '⚠️', levelUp: '⭐', sleepy: '💤',
  drinkWater: '💧', drinkCaffeine: '☕', drinkAlcohol: '🍺', drinkBig: '🌊', drinkOther: '🥤', drinkFull: '🙅',
  cutaway: '🔬', tooClose: '👀', dizzy: '😵‍💫', pleading: '🥺', sulking: '😒',
}

// How long a subtitle stays: the line's spoken length (estimated by the voice) and a
// beat to read it, 3–8 s.
const subtitleSeconds = (spoken = 3) => Math.min(8, Math.max(3, 1.5 + 1.5 * spoken))

// What the bladder just said. Sits in the stage's top stack; a newer line replaces it.
// Screen readers hear it from a hidden live region, as it's said.
export function Subtitles() {
  const subtitle = useUiStore((s) => s.currentSubtitle)
  const name = useUiStore((s) => s.settings.bladderName.trim() || 'Vesica')
  const [expiredId, setExpiredId] = useState(null)
  const visible = !!subtitle && subtitle.id !== expiredId

  useEffect(() => {
    if (!subtitle) return
    const timer = setTimeout(() => setExpiredId(subtitle.id), subtitleSeconds(subtitle.seconds) * 1000)
    return () => clearTimeout(timer)
  }, [subtitle])

  return (
    <>
      <p aria-live="polite" className="sr-only">{visible ? subtitle.text : ''}</p>
      {subtitle && (
        <div aria-hidden="true" className={`pointer-events-none w-full max-w-lg flex justify-center transition-opacity duration-200 ${visible ? 'opacity-100 bubble-animate' : 'opacity-0'}`}>
          <div className="glass-hud px-3 py-1.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-amber-400/40 max-w-full">
            <div className="text-lg flex-shrink-0">{SUBTITLE_ICONS[subtitle.category] ?? MOOD_FACES[subtitle.mood] ?? '🗣️'}</div>
            <div className="text-left overflow-hidden">
              <div className="text-[9px] uppercase tracking-wider font-extrabold text-amber-400 font-mono">{name} (Bladder)</div>
              <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug break-words">"{subtitle.text}"</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const BANNER = 'pointer-events-none px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-black tracking-wider uppercase shadow-xl text-center'

// Warnings (arcade), urge, leak and failure banners, stacked at the top of the stage.
export function StageAlerts() {
  const isStressLeaking = useHud((h) => h.isStressLeaking)
  const involuntaryVoiding = useHud((h) => h.involuntaryVoiding)
  const isUrgeWaveActive = useHud((h) => h.isUrgeWaveActive)
  const urgeWarned = useHud((h) => h.urgeWarned)
  const coughWarned = useHud((h) => h.coughWarned)
  const leakGrace = useHud((h) => h.leakGrace)

  return (
    <>
      {leakGrace && (
        <div className={`${BANNER} bg-rose-600/95 text-white shadow-rose-600/50 animate-bounce`}>
          💦 SLIPPING! CLENCH NOW!
        </div>
      )}
      {urgeWarned && (
        <div className={`${BANNER} bg-amber-300/95 text-slate-950 animate-pulse`}>
          ⚡ URGE INCOMING: CLENCH AS IT LANDS
        </div>
      )}
      {coughWarned && (
        <div className={`${BANNER} bg-sky-300/95 text-slate-950 animate-pulse`}>
          🤧 SNEEZE INCOMING: BRACE!
        </div>
      )}
      {isUrgeWaveActive && (
        <div className={`${BANNER} bg-amber-500/90 text-slate-950 animate-pulse flex items-center gap-2`}>
          <span>⚡</span><span>URGE WAVE! CLENCH TO CALM IT</span>
        </div>
      )}
      {isStressLeaking && (
        <div className={`${BANNER} bg-rose-600/95 text-white shadow-rose-600/50 animate-bounce`}>
          💦 LEAKING! CLENCH TO STOP IT
        </div>
      )}
      {involuntaryVoiding && (
        <div className={`${BANNER} bg-red-600/95 text-white tracking-widest shadow-red-600/60 animate-bounce`}>
          ⚠️ IT GAVE WAY: EMPTYING!
        </div>
      )}
    </>
  )
}

// Red screen edge: overpressure 35%, stress leak 70%, total failure 95% pulsing.
export function Vignette() {
  const status = useHud(organStatus)
  return (
    <div
      data-testid="vignette"
      className={`pointer-events-none fixed inset-0 z-10 box-border border-[10px] sm:border-[16px] border-rose-600/60 transition-opacity duration-300 ${status.vignettePulse ? 'fatigue-vignette' : ''}`}
      style={{ opacity: status.vignette }}
    ></div>
  )
}
