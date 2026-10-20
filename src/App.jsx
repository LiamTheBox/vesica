import { useEffect, useState } from 'react'
import HUD from './components/ui/HUD'
import Scene from './components/3d/Scene'
import { audio } from './audio/AudioManager'
import { installFeedback } from './feedback/feedback'
import { applySettings } from './settings/settings'
import { useUiStore } from './store/useUiStore'
import { act } from './sim/engine'
import { agitate } from './sim/sim'
import { countRender } from './debug/devHook'

function App() {
  countRender('App')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    applySettings(useUiStore.getState().settings)
    return installFeedback()
  }, [])

  useEffect(() => {
    const initAudio = () => {
      audio.initCtx()

      // Speech synthesis must be primed from a user gesture on mobile browsers.
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel() // clear any stuck empty utterances
        const utterance = new SpeechSynthesisUtterance(' ')
        utterance.volume = 0
        window.speechSynthesis.speak(utterance)
      }

      setStarted(true)
      document.removeEventListener('pointerdown', initAudio)
      document.removeEventListener('keydown', initAudio)
    }

    document.addEventListener('pointerdown', initAudio)
    document.addEventListener('keydown', initAudio)

    // Shaking the phone sloshes the bladder, as in the original.
    let lastAx = 0, lastAy = 0, lastAz = 0
    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity
      if (!acc) return
      const delta = Math.abs(acc.x - lastAx) + Math.abs(acc.y - lastAy) + Math.abs(acc.z - lastAz)
      if (delta > 14.0) act(agitate, Math.min(4.0, delta * 0.22))
      lastAx = acc.x; lastAy = acc.y; lastAz = acc.z
    }
    window.addEventListener('devicemotion', handleMotion, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', initAudio)
      document.removeEventListener('keydown', initAudio)
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [])

  return (
    <>
      <Scene />
      <HUD />

      {!started && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm pointer-events-none transition-opacity duration-500">
          <div className="glass-hud px-6 py-4 rounded-2xl flex flex-col items-center animate-pulse">
            <span className="text-3xl mb-2">👆</span>
            <span className="text-sm font-bold text-slate-200 tracking-wider">TAP ANYWHERE TO START</span>
            <span className="text-[10px] text-slate-400 font-mono mt-1">Initializes Hydro-Acoustic Engine</span>
          </div>
        </div>
      )}
    </>
  )
}

export default App
