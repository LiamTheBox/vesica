import { useState, useEffect } from 'react'
import TelemetryBar from './TelemetryBar'
import ActionButtons from './ActionButtons'
import { Alerts, Subtitles } from './Alerts'
import { ChallengeBanner, ChallengeResultCard } from './ChallengeStatus'
import BottomNav from './Tabs/BottomNav'
import TelemetryTab from './Tabs/TelemetryTab'
import ChallengesTab from './Tabs/ChallengesTab'
import SettingsTab from './Tabs/SettingsTab'
import { useHud, useUiStore } from '../../store/useUiStore'
import { organStatus } from './status'
import { act } from '../../sim/engine'
import { agitate, cough, resetOrgan } from '../../sim/sim'
import { haptic } from '../../feedback/feedback'
import { countRender } from '../../debug/devHook'

const INTERACTION_MODES = [
  { key: 'poke', label: 'Poke', icon: '👉' },
  { key: 'squeeze', label: 'Squeeze', icon: '🤏' },
  { key: 'slap', label: 'Slap', icon: '👋' },
  { key: 'orbit', label: 'Orbit', icon: '🔄' }
]

export default function HUD() {
  countRender('HUD')
  const mode = useUiStore((s) => s.interactionMode)
  const isCutawayActive = useUiStore((s) => s.isCutawayActive)
  const status = useHud(organStatus)
  const setMode = useUiStore((s) => s.setInteractionMode)
  const toggleCutaway = useUiStore((s) => s.toggleCutaway)

  const [deferredPrompt, setDeferredPrompt] = useState(null)

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
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const cycleMode = () => {
    const idx = INTERACTION_MODES.findIndex((m) => m.key === mode)
    const next = INTERACTION_MODES[(idx + 1) % INTERACTION_MODES.length]
    setMode(next.key)
    haptic(20)
  }

  const currentModeObj = INTERACTION_MODES.find((m) => m.key === mode)

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col p-2 sm:p-4 justify-between h-full">
      <Alerts />
      <Subtitles />
      <ChallengeResultCard />
      
      {/* Overlay Tabs */}
      <TelemetryTab />
      <ChallengesTab />
      <SettingsTab />

      {/* Top Bar */}
      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto w-full pointer-events-auto flex-wrap sm:flex-nowrap">
          <div className="glass-hud px-3 py-1.5 rounded-2xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 via-amber-500 to-amber-300 flex items-center justify-center text-sm shadow-md transition-transform duration-150" style={{ transform: `scale(${status.iconScale})` }}>
              🫁
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-extrabold tracking-wider uppercase text-slate-100">
                  Vesica 3D
                </h1>
                <span data-testid="status-badge" className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${status.badgeTone}`}>
                  {status.badge}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">{status.sub}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
            {deferredPrompt && (
              <button onClick={installPwa} className="glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-400 border border-amber-400/40 hover:bg-amber-500/10 active:scale-95 transition flex items-center gap-1">
                <span>📲</span><span className="text-[11px]">Install</span>
              </button>
            )}
            
            <button onClick={toggleFullscreen} className="glass-hud p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-amber-400 transition" title="Toggle Fullscreen">
              ⛶
            </button>

            <button onClick={() => { toggleCutaway(); haptic(20) }} className={`glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition flex items-center gap-1 ${isCutawayActive ? 'bg-sky-500/25 border-sky-400 text-sky-400' : 'text-slate-200 hover:text-sky-400'}`} title="Toggle Sagittal Internal Cutaway">
              <span>🔬</span><span className="text-[11px] hidden sm:inline">Cutaway</span>
            </button>

            <button onClick={cycleMode} className="glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 hover:text-sky-400 active:scale-95 transition flex items-center gap-1">
              <span>{currentModeObj?.icon}</span>
              <span className="text-[11px] hidden sm:inline">{currentModeObj?.label}</span>
            </button>
            <button onClick={() => act(cough)} className="glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 hover:text-rose-400 active:scale-95 transition flex items-center gap-1">
              <span>🤧</span>
              <span className="text-[11px] hidden sm:inline">Cough</span>
            </button>
            <button onClick={() => act(agitate, 3.2)} className="glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 hover:text-amber-400 active:scale-95 transition flex items-center gap-1">
              <span>📳</span>
              <span className="text-[11px] hidden sm:inline">Shake</span>
            </button>
            <button onClick={() => act(resetOrgan)} className="glass-hud p-1.5 sm:p-2 rounded-xl text-xs font-bold text-slate-300 hover:text-cyan-400 transition" title="Flush Organ">
              🔄
            </button>
          </div>
        </div>
        
        <TelemetryBar />
      </div>

      {/* Bottom Area */}
      <div className="mt-auto flex flex-col gap-2">
        <ChallengeBanner />
        <ActionButtons />
        <BottomNav />
      </div>
    </div>
  )
}
