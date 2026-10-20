import { useEffect, useState } from 'react'
import HUD from './components/ui/HUD'
import Scene from './components/3d/Scene'
import { useAudioAndHaptics } from './audio/useAudioAndHaptics'
import { audio } from './audio/AudioManager'
import { useSimStore } from './store/useSimStore'
import { countRender } from './debug/devHook'

function App() {
  countRender('App')
  useAudioAndHaptics()
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const initAudio = () => {
      audio.initCtx()
      
      // Force speech synthesis initialization securely
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel() // Clear any stuck empty utterances
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

    // Device motion listener
    let lastAx = 0, lastAy = 0, lastAz = 0
    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity
      if (!acc) return

      const delta = Math.abs(acc.x - lastAx) + Math.abs(acc.y - lastAy) + Math.abs(acc.z - lastAz)
      if (delta > 14.0) {
        const strength = Math.min(4.0, delta * 0.22)
        const sim = useSimStore.getState()
        sim.updateSim(s => ({
          jiggleIntensity: Math.min(1.0, s.jiggleIntensity + strength * 0.4),
          sloshVelX: s.sloshVelX + (Math.random() - 0.5) * strength * 3.5,
          sloshVelZ: s.sloshVelZ + (Math.random() - 0.5) * strength * 3.5
        }))
        audio.playGranularSlosh(strength * 0.4)
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(45)
        
        sim.addRipple({ center: { x: 0, y: 0, z: 0 }, radius: 0.1, maxRadius: 4.2, speed: 7.5, amplitude: 0.5 * strength, decay: 3.5 })
        
        document.body.classList.add('shake-active')
        setTimeout(() => document.body.classList.remove('shake-active'), 250)

        if (strength > 2.0 && sim.volume / sim.maxCapacity > 0.4) {
          audio.speak('shaken', true)
        }
      }

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
