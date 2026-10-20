import { useEffect } from 'react'
import { useSimStore } from '../store/useSimStore'
import { audio } from './AudioManager'

export function useAudioAndHaptics() {
  const isActivelyVoiding = useSimStore(s => s.isActivelyVoiding)
  const isClenching = useSimStore(s => s.isClenching)
  const activeBevsCount = useSimStore(s => s.activeBeverages.length)
  const volume = useSimStore(s => s.volume)
  const maxCapacity = useSimStore(s => s.maxCapacity)
  const pressure = useSimStore(s => s.pressure)
  const isStressLeaking = useSimStore(s => s.isStressLeaking)
  const involuntaryVoiding = useSimStore(s => s.involuntaryVoiding)
  const toneStrain = useSimStore(s => s.sphincterToneStrain)
  const flowRate = useSimStore(s => s.flowRate)

  // Subtitle callbacks
  useEffect(() => {
    audio.onSubtitle = (text, category) => {
      useSimStore.setState({ currentSubtitle: { text, category, id: Date.now() } })
    }
  }, [])

  // Audio update loop (since we need it to update dynamic jet)
  useEffect(() => {
    let lastTime = performance.now()
    let raf = null
    const loop = (t) => {
      const dt = Math.min(0.08, (t - lastTime) / 1000)
      lastTime = t
      audio.update(dt)
      const currentFlow = useSimStore.getState().flowRate
      const currentPress = useSimStore.getState().pressure
      if (currentFlow > 0) audio.updateDynamicJet(currentFlow, currentPress)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Voiding state
  useEffect(() => {
    if (isActivelyVoiding || involuntaryVoiding) {
      audio.startDynamicJet()
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
      if (involuntaryVoiding) audio.speak('involuntary', true)
      else audio.speak('voiding', true)
    } else {
      audio.stopDynamicJet()
    }
  }, [isActivelyVoiding, involuntaryVoiding])

  // Clenching state
  useEffect(() => {
    if (isClenching) {
      audio.startClenchHum()
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([20, 30, 20])
      audio.speak('clench', true)
    } else {
      audio.stopClenchHum()
    }
  }, [isClenching])

  // Stress Leak
  useEffect(() => {
    if (isStressLeaking) {
      audio.playLeakSpurt()
      audio.speak('leak', true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60)
    }
  }, [isStressLeaking])

  // Ingestions
  useEffect(() => {
    if (activeBevsCount > 0) {
      audio.playIngest()
      audio.playUreterSquirt()
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30)
    }
  }, [activeBevsCount])

  // Periodic Voice Evaluator
  useEffect(() => {
    const interval = setInterval(() => {
      const state = useSimStore.getState()
      if (state.isActivelyVoiding || state.involuntaryVoiding || state.isStressLeaking) return
      
      const fillRatio = state.volume / state.maxCapacity
      if (fillRatio > 0.88 || state.sphincterToneStrain > 0.75) {
        audio.speak('critical')
      } else if (fillRatio > 0.72) {
        audio.speak('full')
      } else if (fillRatio > 0.45) {
        audio.speak('distended')
      } else if (fillRatio > 0.18) {
        audio.speak('nominal')
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [])
}
