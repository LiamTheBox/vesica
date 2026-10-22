import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import HUD from './components/ui/HUD'
import { audio } from './audio/AudioManager'
import { installFeedback } from './feedback/feedback'
import { applySettings } from './settings/settings'
import { useUiStore } from './store/useUiStore'
import { act } from './sim/engine'
import { agitate } from './sim/sim'
import { startArcadeRun } from './sim/arcade'
import { startMicroRun } from './sim/micro/runner'
import { countRender } from './debug/devHook'
import { t } from './i18n'

// The 3D engine (Three.js + R3F, most of the download) loads in its own chunks, so the
// HUD and start screen don't wait for it to parse.
const Scene = lazy(() => import('./components/3d/Scene'))

// Audio, speech and motion all need a user gesture to start on mobile browsers.
function initFromGesture() {
  audio.initCtx()

  // Speech synthesis must be primed from a user gesture on mobile browsers.
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel() // clear any stuck empty utterances
    const utterance = new SpeechSynthesisUtterance(' ')
    utterance.volume = 0
    window.speechSynthesis.speak(utterance)
  }

  // iOS only reports motion after the player grants it, from a gesture like this tap.
  if (useUiStore.getState().settings.shakeToSlosh && typeof DeviceMotionEvent?.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().catch(() => {})
  }
}

function App() {
  countRender('App')
  const [started, setStarted] = useState(false)

  // Arcade is the default: a tap (or key) anywhere starts a run; the other buttons pick
  // microgames or the sandbox instead.
  const begin = useCallback((mode) => {
    initFromGesture()
    setStarted(true)
    if (mode === 'arcade') act(startArcadeRun)
    else if (mode === 'micro') act(startMicroRun)
  }, [])

  useEffect(() => {
    applySettings(useUiStore.getState().settings)
    return installFeedback()
  }, [])

  useEffect(() => {
    if (started) return
    const onKey = () => begin('arcade')
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [started, begin])

  useEffect(() => {
    // Shaking the phone sloshes the bladder, as in the original.
    let lastAx = 0, lastAy = 0, lastAz = 0
    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity
      if (!acc || !useUiStore.getState().settings.shakeToSlosh) return
      const delta = Math.abs(acc.x - lastAx) + Math.abs(acc.y - lastAy) + Math.abs(acc.z - lastAz)
      if (delta > 14.0) act(agitate, Math.min(4.0, delta * 0.22))
      lastAx = acc.x; lastAy = acc.y; lastAz = acc.z
    }
    window.addEventListener('devicemotion', handleMotion, { passive: true })

    // Long-press menus would interrupt holds and drags.
    const blockMenu = (e) => e.preventDefault()
    document.addEventListener('contextmenu', blockMenu)

    return () => {
      window.removeEventListener('devicemotion', handleMotion)
      document.removeEventListener('contextmenu', blockMenu)
    }
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <HUD />

      {/* Starts on the click, not the press: gone on the press, the screen would let the
          click that follows land on the control under it (a drink, say). */}
      {!started && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => begin('arcade')}
        >
          <div className="glass-hud px-6 py-4 rounded-2xl flex flex-col items-center gap-1 max-w-xs text-center">
            <span className="text-3xl mb-1">🕹️</span>
            <span className="text-sm font-bold text-slate-200 tracking-wider animate-pulse">{t('start.tap')}</span>
            <span className="text-[11px] text-slate-400 leading-snug">
              {t('start.about')}
            </span>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); begin('micro') }}
                className="min-h-11 px-4 rounded-xl bg-violet-900/70 hover:bg-violet-800/70 border border-violet-500/70 text-xs font-bold text-slate-100"
              >
                {t('start.micro')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); begin('sandbox') }}
                className="min-h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200"
              >
                {t('start.sandbox')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
