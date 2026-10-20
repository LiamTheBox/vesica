import { useState, useEffect } from 'react'
import TelemetryBar from './TelemetryBar'
import ActionButtons from './ActionButtons'
import { Alerts, Subtitles } from './Alerts'
import BottomNav from './Tabs/BottomNav'
import TelemetryTab from './Tabs/TelemetryTab'
import ChallengesTab from './Tabs/ChallengesTab'
import SettingsTab from './Tabs/SettingsTab'
import { useSimStore } from '../../store/useSimStore'
import { audio } from '../../audio/AudioManager'

const INTERACTION_MODES = [
  { key: 'poke', label: 'Poke', icon: '👉' },
  { key: 'squeeze', label: 'Squeeze', icon: '🤏' },
  { key: 'slap', label: 'Slap', icon: '👋' },
  { key: 'orbit', label: 'Orbit', icon: '🔄' }
]

export default function HUD() {
  const mode = useSimStore(s => s.interactionMode)
  const isCutawayActive = useSimStore(s => s.isCutawayActive)
  const setMode = useSimStore.getState().setInteractionMode
  const triggerCough = useSimStore.getState().triggerCough
  const toggleCutaway = useSimStore.getState().toggleCutaway
  const resetOrgan = useSimStore.getState().resetOrgan
  const setSim = useSimStore.getState().updateSim

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
      document.documentElement.requestFullscreen().catch(()=>{})
    } else {
      document.exitFullscreen().catch(()=>{})
    }
  }

  const cycleMode = () => {
    const idx = INTERACTION_MODES.findIndex(m => m.key === mode)
    const next = INTERACTION_MODES[(idx + 1) % INTERACTION_MODES.length]
    setMode(next.key)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20)
  }

  const currentModeObj = INTERACTION_MODES.find(m => m.key === mode)

  const handleShake = () => {
    const strength = 3.2
    setSim(s => ({
      jiggleIntensity: Math.min(1.0, s.jiggleIntensity + strength * 0.4),
      sloshVelX: s.sloshVelX + (Math.random() - 0.5) * strength * 3.5,
      sloshVelZ: s.sloshVelZ + (Math.random() - 0.5) * strength * 3.5
    }))
    
    document.body.classList.add('shake-active')
    setTimeout(() => document.body.classList.remove('shake-active'), 250)
    
    audio.playGranularSlosh(strength * 0.4)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(45)
    audio.speak('shaken', true)
  }

  const handleReset = () => {
    resetOrgan()
    audio.stopDynamicJet()
    audio.stopClenchHum()
    audio.stopUrgeRumble()
    handleShake()
    audio.speak('deflated')
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col p-2 sm:p-4 justify-between h-full">
      <Alerts />
      <Subtitles />
      
      {/* Overlay Tabs */}
      <TelemetryTab />
      <ChallengesTab />
      <SettingsTab />

      {/* Top Bar */}
      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto w-full pointer-events-auto flex-wrap sm:flex-nowrap">
          <div className="glass-hud px-3 py-1.5 rounded-2xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 via-amber-500 to-amber-300 flex items-center justify-center text-sm shadow-md">
              🫁
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-extrabold tracking-wider uppercase text-slate-100">
                Vesica 3D
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">React Port</p>
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

            <button onClick={() => { toggleCutaway(); if (navigator.vibrate) navigator.vibrate(20); }} className={`glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition flex items-center gap-1 ${isCutawayActive ? 'bg-sky-500/25 border-sky-400 text-sky-400' : 'text-slate-200 hover:text-sky-400'}`} title="Toggle Sagittal Internal Cutaway">
              <span>🔬</span><span className="text-[11px] hidden sm:inline">Cutaway</span>
            </button>

            <button onClick={cycleMode} className="glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 hover:text-sky-400 active:scale-95 transition flex items-center gap-1">
              <span>{currentModeObj?.icon}</span>
              <span className="text-[11px] hidden sm:inline">{currentModeObj?.label}</span>
            </button>
            <button onClick={triggerCough} className="glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 hover:text-rose-400 active:scale-95 transition flex items-center gap-1">
              <span>🤧</span>
              <span className="text-[11px] hidden sm:inline">Cough</span>
            </button>
            <button onClick={handleShake} className="glass-hud px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 hover:text-amber-400 active:scale-95 transition flex items-center gap-1">
              <span>📳</span>
              <span className="text-[11px] hidden sm:inline">Shake</span>
            </button>
            <button onClick={handleReset} className="glass-hud p-1.5 sm:p-2 rounded-xl text-xs font-bold text-slate-300 hover:text-cyan-400 transition" title="Flush Organ">
              🔄
            </button>
          </div>
        </div>
        
        <TelemetryBar />
      </div>

      {/* Bottom Area */}
      <div className="mt-auto flex flex-col gap-2">
        <ActionButtons />
        <BottomNav />
      </div>
    </div>
  )
}
