import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import TelemetryBar from './TelemetryBar'
import ActionButtons from './ActionButtons'
import { StageAlerts, Subtitles, Vignette } from './Alerts'
import { ChallengeBanner, ChallengeResultCard, MicroBanner } from './ChallengeStatus'
import BottomNav from './Tabs/BottomNav'
import { useHud, useUiStore } from '../../store/useUiStore'
import { organStatus } from './status'
import { MOOD_FACES } from '../../feedback/mood'
import { countRender } from '../../debug/devHook'
import ToolRail from './ToolRail'
import ActionRail from './ActionRail'
import MicroStage from '../micro/MicroStage'

// Tabs load on first open (they're precached for offline play either way).
const TelemetryTab = lazy(() => import('./Tabs/TelemetryTab'))
const ChallengesTab = lazy(() => import('./Tabs/ChallengesTab'))
const SettingsTab = lazy(() => import('./Tabs/SettingsTab'))
const StoriesTab = lazy(() => import('./Tabs/StoriesTab'))
// Opened from the drinks shelf rather than the nav, the same way.
const DrinksMenu = lazy(() => import('./DrinksMenu'))

function LazyTab({ id, children }) {
  const open = useUiStore((s) => s.currentTab === id)
  return open ? <Suspense fallback={null}>{children}</Suspense> : null
}

const TOP_BUTTON = 'glass-hud min-w-11 min-h-11 px-2.5 rounded-xl text-xs font-bold active:scale-95 transition flex items-center justify-center gap-1'

// Reports where the stage sits on screen, so the 3D camera can frame the bladder
// inside it (see StageFit in Scene.jsx).
function useStageRect(ref) {
  useEffect(() => {
    const el = ref.current
    const report = () => {
      const r = el.getBoundingClientRect()
      const rect = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
      const prev = useUiStore.getState().stageRect
      if (!prev || Object.keys(rect).some((k) => rect[k] !== prev[k])) useUiStore.setState({ stageRect: rect })
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    window.addEventListener('resize', report)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [ref])
}

// Shown once the player has panned or zoomed the view: puts the bladder back in frame.
function RecenterButton() {
  const moved = useUiStore((s) => s.viewMoved)
  const recenter = useUiStore((s) => s.recenterView)
  if (!moved) return null
  return (
    <button onClick={recenter} className="glass-hud pointer-events-auto min-h-11 px-3 rounded-full text-[11px] font-bold text-sky-300 active:scale-95 transition">
      ⌖ Recenter
    </button>
  )
}

function StatusCard() {
  const status = useHud(organStatus)
  // The bladder's face: how it feels right now.
  const mood = useUiStore((s) => s.mood)
  return (
    <div className="glass-hud px-3 py-1.5 rounded-2xl flex items-center gap-2.5 min-w-0">
      <div
        data-testid="mood"
        role="img"
        aria-label={`Feeling ${mood}`}
        title={`Feeling ${mood}`}
        className="w-8 h-8 flex-shrink-0 rounded-xl bg-gradient-to-tr from-rose-600 via-amber-500 to-amber-300 flex items-center justify-center text-lg shadow-md transition-transform duration-150"
        style={{ transform: `scale(${status.iconScale})` }}
      >
        <span key={mood} className="mood-pop">{MOOD_FACES[mood]}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xs sm:text-sm font-extrabold tracking-wider uppercase text-slate-100 whitespace-nowrap">Vesica 3D</h1>
          <span data-testid="status-badge" className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${status.badgeTone}`}>
            {status.badge}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-mono truncate">{status.sub}</p>
      </div>
    </div>
  )
}

export default function HUD() {
  countRender('HUD')
  const stageRef = useRef(null)
  useStageRect(stageRef)
  // A microgames run plays in the stage, with nothing else to press.
  const micro = useHud((h) => h.micro)

  const [deferredPrompt, setDeferredPrompt] = useState(null)
  // Fullscreen isn't available on iPhone; hide the button there.
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const installPwa = () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then(() => setDeferredPrompt(null))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  return (
    <>
      <Vignette />

      <div className="hud-layout pointer-events-none z-10">
        <header className="hud-top w-full max-w-4xl mx-auto flex items-center justify-between gap-2 pointer-events-auto">
          <StatusCard />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {deferredPrompt && (
              <button onClick={installPwa} className={`${TOP_BUTTON} text-amber-400 border border-amber-400/40 hover:bg-amber-500/10`}>
                <span>📲</span><span className="text-[11px]">Install</span>
              </button>
            )}
            {canFullscreen && (
              <button onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Toggle Fullscreen" className={`${TOP_BUTTON} text-slate-300 hover:text-amber-400`}>
                ⛶
              </button>
            )}
          </div>
        </header>

        <div className="hud-telemetry w-full max-w-4xl mx-auto">
          {micro ? <MicroBanner /> : <TelemetryBar />}
        </div>

        {/* The stage: the bladder is framed here. Touches pass through to the 3D canvas. */}
        <section ref={stageRef} data-testid="stage" className="hud-stage">
          {micro && <MicroStage />}
          {!micro && (
            <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-1.5 px-14">
              <ChallengeBanner />
              <StageAlerts />
              <Subtitles />
            </div>
          )}
          {!micro && (
            <>
              <div className="absolute left-0 inset-y-0 flex items-center">
                <ActionRail />
              </div>
              <div className="absolute right-0 inset-y-0 flex items-center">
                <ToolRail />
              </div>
              <div className="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
                <RecenterButton />
              </div>
            </>
          )}
        </section>

        {!micro && (
          <div className="hud-controls w-full max-w-xl mx-auto">
            <ActionButtons />
          </div>
        )}

        <div className="hud-nav w-full max-w-md mx-auto">
          <BottomNav />
        </div>
      </div>

      <ChallengeResultCard />
      <LazyTab id="telemetry"><TelemetryTab /></LazyTab>
      <LazyTab id="challenges"><ChallengesTab /></LazyTab>
      <LazyTab id="stories"><StoriesTab /></LazyTab>
      <LazyTab id="settings"><SettingsTab /></LazyTab>
      <LazyTab id="drinks"><DrinksMenu /></LazyTab>
    </>
  )
}
