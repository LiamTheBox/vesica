import { audio } from '../audio/AudioManager'
import { ambientVoiceCategory } from '../sim/sim'
import { onSimEvent, onSimTick, sim } from '../sim/engine'
import { useUiStore } from '../store/useUiStore'
import { recordResult } from '../challenges/bests'
import { saveJson } from '../store/persist'

// Turns simulation events into sound, voice, haptics and UI reactions, matching what
// the original game did at the same moments.

export const feedbackSettings = { haptics: true }

export function haptic(pattern = 40) {
  if (feedbackSettings.haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

export function shakeScreen() {
  document.body.classList.add('shake-active')
  setTimeout(() => document.body.classList.remove('shake-active'), 250)
}

// Keeps the screen on during a challenge, where supported (Wake Lock API). Requests
// and releases are async, so `wantAwake` decides when a reset and a new start (Retry)
// overlap.
let wakeLock = null
let wantAwake = false
async function keepScreenAwake(on) {
  wantAwake = on
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      const lock = await navigator.wakeLock.request('screen')
      if (!wantAwake || wakeLock) {
        lock.release()
        return
      }
      wakeLock = lock
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null })
    } else if (!on && wakeLock) {
      const lock = wakeLock
      wakeLock = null
      await lock.release()
    }
  } catch {
    // Denied or unsupported: the challenge still works, the screen may just dim.
  }
}

function setChallengeResult(challenge, result) {
  useUiStore.setState((state) => ({ challengeResults: { ...state.challengeResults, [challenge]: result } }))
}

function finishChallenge(event, text) {
  setChallengeResult(event.challenge, { success: event.success, text })
  const { bests } = useUiStore.getState()
  const nextBests = recordResult(bests, event)
  if (nextBests !== bests) saveJson('bests', nextBests)
  useUiStore.setState({
    bests: nextBests,
    lastResult: { challenge: event.challenge, success: event.success, text, newBest: nextBests !== bests, id: Date.now() },
  })
}

const handlers = {
  ingest: () => {
    audio.playIngest()
    haptic(30)
    audio.playUreterSquirt()
  },
  clenchStart: () => {
    haptic([20, 30, 20])
    audio.startClenchHum()
    audio.speak('clench')
  },
  clenchStop: () => audio.stopClenchHum(),
  clenchExhausted: () => audio.stopClenchHum(),
  voidAttemptStart: () => haptic(25),
  voidStart: () => {
    audio.startDynamicJet()
    haptic(50)
    audio.speak('voiding')
  },
  voidStop: () => audio.stopDynamicJet(),
  leakStart: () => {
    audio.playLeakSpurt()
    haptic(60)
    audio.speak('leak')
  },
  failureStart: () => {
    audio.startDynamicJet()
    haptic([100, 50, 100, 50])
    audio.speak('involuntary')
  },
  failureEnd: () => {
    audio.stopDynamicJet()
    audio.speak('deflated')
  },
  urgeStart: () => audio.startUrgeRumble(),
  urgeEnd: () => audio.stopUrgeRumble(),
  creak: () => audio.playTensionCreak(),
  cough: () => {
    audio.playCoughBurst()
    haptic([40, 20, 80])
  },
  agitation: (e) => {
    audio.playGranularSlosh(e.strength * 0.4)
    shakeScreen()
    haptic(45)
    if (e.speakShaken) audio.speak('shaken')
  },
  soothe: () => {
    audio.playSootheBreath()
    haptic(30)
    audio.speak('soothe')
  },
  // A reset also ends any challenge (a new one starts right after, if that's why).
  reset: () => {
    keepScreenAwake(false)
    audio.stopDynamicJet()
    audio.stopClenchHum()
    audio.stopUrgeRumble()
  },
  voice: (e) => audio.speak(e.category),
  poke: (e) => {
    if (e.touch) {
      audio.playSquish(1.0)
      haptic(30)
    }
    audio.speak('poked')
  },
  slap: (e) => {
    audio.playSlap(e.strength)
    if (e.haptic) haptic(50)
    audio.speak('poked')
  },
  squeezeStart: () => {
    audio.playSquish(1.2)
    haptic(35)
  },
  squeezeDrag: (e) => {
    if (Math.random() > 0.7) audio.playSqueezeFM(e.amount)
  },
  squeezeRelease: () => audio.playGranularSlosh(1.1),
  challengeStart: (e) => {
    setChallengeResult(e.challenge, null)
    useUiStore.setState({ lastResult: null })
    keepScreenAwake(true)
    useUiStore.getState().setTab('sim')
  },
  challengeResult: (e) => {
    keepScreenAwake(false)
    if (e.challenge === 'commute') {
      finishChallenge(e, e.success ? `VICTORY! (${e.leaked}ml lost)` : `FAILED (${e.leaked}ml lost)`)
      if (e.success) haptic([100, 50, 100])
    } else {
      finishChallenge(e, e.success ? `SUCCESS (${e.voided}ml)` : `FAILED (${e.voided}ml)`)
      haptic(e.success ? [50, 50, 100] : 120)
    }
  },
}

function onTick(sim, dt) {
  audio.update(dt)
  if (sim.isClenching) audio.updateClenchHum(sim.kegelStamina)
  if (sim.flowRate > 0) audio.updateDynamicJet(sim.flowRate, sim.pressure)
  const category = ambientVoiceCategory(sim)
  if (category) audio.speak(category)
}

// In the background the game stops: Scene pauses rendering (and with it the
// simulation), and the sound goes quiet. The browser drops the wake lock on hide, so a
// running challenge takes it again on return.
function onVisibilityChange() {
  const hidden = document.visibilityState === 'hidden'
  useUiStore.setState({ appHidden: hidden })
  if (hidden) {
    audio.suspend()
  } else {
    audio.resume()
    if (sim.activeChallenge) keepScreenAwake(true)
  }
}

export function installFeedback() {
  audio.onSubtitle = (text, category) => {
    useUiStore.setState({ currentSubtitle: { text, category, id: Date.now() } })
  }
  const offEvent = onSimEvent((event) => handlers[event.type]?.(event))
  const offTick = onSimTick(onTick)
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    offEvent()
    offTick()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    audio.onSubtitle = null
  }
}
