import { audio } from '../audio/AudioManager'
import { voice } from '../audio/voice'
import { chatterLine, reactionLine } from './reactions'
import { createMood, feel, moodOf, stepMood } from './mood'
import { emoteFor } from './emotes'
import { onSimEvent, onSimTick, sim } from '../sim/engine'
import { useUiStore } from '../store/useUiStore'
import { clock, recordResult } from '../challenges/bests'
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

function finishChallenge(event, text, detail = null) {
  setChallengeResult(event.challenge, { success: event.success, text })
  const { bests } = useUiStore.getState()
  const nextBests = recordResult(bests, event)
  if (nextBests !== bests) saveJson('bests', nextBests)
  useUiStore.setState({
    bests: nextBests,
    lastResult: { challenge: event.challenge, success: event.success, text, detail, newBest: nextBests !== bests, id: Date.now() },
  })
}

const pts = (n) => n.toLocaleString('en-US')

// Arcade score lines flashed under the score, with their sound.
const ARCADE_LINES = {
  perfect: (e) => [`PERFECT${e.combo > 1 ? ` ×${e.combo}` : ''} +${e.points}`, 'good', 'perfect'],
  good: (e) => [`CALMED +${e.points}`, 'ok', 'good'],
  missed: () => ['URGE MISSED', 'bad', 'miss'],
  braced: (e) => [`BRACED${e.combo > 1 ? ` ×${e.combo}` : ''} +${e.points}`, 'good', 'perfect'],
  unbraced: () => ['SNEEZE! NOT BRACED', 'bad', 'miss'],
  saved: (e) => [`CLOSE CALL +${e.points}`, 'warn', 'good'],
  leak: (e) => [`LEAK ${e.points}`, 'bad', 'miss'],
  drink: (e) => [`DRINK BONUS +${e.points}`, 'ok', 'good'],
  bank: (e) => [`BANKED +${pts(e.points)}`, 'warn', 'bank'],
}

function arcadeLine(text, tone, cue) {
  useUiStore.setState({ arcadeToast: { text, tone, id: Date.now() + Math.random() } })
  audio.playCue(cue)
}

const handlers = {
  // The gulp; the urine is heard squirting in later, as it arrives (ureterSquirt).
  ingest: () => {
    audio.playIngest()
    haptic(30)
  },
  clenchStart: () => {
    haptic([20, 30, 20])
    audio.startClenchHum()
  },
  clenchStop: () => audio.stopClenchHum(),
  clenchExhausted: () => audio.stopClenchHum(),
  // Announced threats (arcade): a short cue and a tap on the hand, and the bladder shivers.
  urgeWarning: () => {
    audio.playCue('warning')
    audio.playShiver()
    haptic([15, 40, 15])
  },
  sneezeWarning: () => {
    audio.playCue('warning')
    audio.playShiver()
    haptic([15, 40, 15])
  },
  leakWarning: () => {
    audio.playCue('alarm')
    haptic([60, 40, 60])
  },
  voidAttemptStart: () => haptic(25),
  voidStart: () => {
    audio.startDynamicJet()
    haptic(50)
  },
  voidStop: () => audio.stopDynamicJet(),
  leakStart: () => {
    audio.playLeakSpurt()
    haptic(60)
  },
  failureStart: () => {
    audio.startDynamicJet()
    haptic([100, 50, 100, 50])
  },
  failureEnd: () => audio.stopDynamicJet(),
  urgeStart: () => audio.startUrgeRumble(),
  urgeEnd: (e) => {
    audio.stopUrgeRumble()
    if (e.suppressed) haptic(20)
  },
  arcadePoints: (e) => arcadeLine(...ARCADE_LINES[e.reason](e)),
  arcadeLevel: (e) => arcadeLine(`LEVEL ${e.level}`, 'level', 'level'),
  arcadeQuit: () => keepScreenAwake(false),
  // Microgames: a cue for each verb, then the result's.
  microPrompt: () => audio.playCue('warning'),
  microBossStart: () => {
    audio.playCue('alarm')
    haptic([30, 30, 30])
  },
  microWin: () => {
    audio.playCue('good')
    haptic(20)
  },
  microLose: () => audio.playCue('miss'),
  microLevel: () => audio.playCue('level'),
  microBoss: (e) => {
    if (!e.won) return
    audio.playCue('bank')
    haptic([60, 40, 60])
  },
  microQuit: () => keepScreenAwake(false),
  creak: () => audio.playTensionCreak(),
  cough: () => {
    audio.playCoughBurst()
    haptic([40, 20, 80])
  },
  agitation: (e) => {
    audio.playGranularSlosh(e.strength * 0.4)
    shakeScreen()
    haptic(45)
  },
  soothe: () => {
    audio.playSootheBreath()
    haptic(30)
  },
  // A reset also ends any challenge (a new one starts right after, if that's why).
  reset: () => {
    keepScreenAwake(false)
    audio.stopDynamicJet()
    audio.stopClenchHum()
    audio.stopUrgeRumble()
  },
  poke: (e) => {
    if (e.touch) {
      audio.playSquish(1.0)
      haptic(30)
    }
  },
  slap: (e) => {
    audio.playSlap(e.strength)
    if (e.haptic) haptic(50)
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
    useUiStore.setState({ lastResult: null, arcadeToast: null })
    keepScreenAwake(true)
    useUiStore.getState().setTab('sim')
  },
  challengeResult: (e) => {
    keepScreenAwake(false)
    if (e.challenge === 'arcade') {
      const detail = `${clock(e.seconds)} held · best combo ×${e.bestCombo} · ${e.leaks} leak${e.leaks === 1 ? '' : 's'}`
      finishChallenge(e, e.success ? `BANKED ${pts(e.score)} PTS` : `RUN OVER · ${pts(e.score)} PTS`, detail)
      if (e.success) haptic([100, 50, 100])
    } else if (e.challenge === 'micro') {
      finishChallenge(e, `${e.score} CLEARED`, `speed ${e.level} · ${clock(e.seconds)} played`)
      haptic([100, 50, 100])
    } else if (e.challenge === 'commute') {
      finishChallenge(e, e.success ? `VICTORY! (${e.leaked}ml lost)` : `FAILED (${e.leaked}ml lost)`)
      if (e.success) haptic([100, 50, 100])
    } else {
      finishChallenge(e, e.success ? `SUCCESS (${e.voided}ml)` : `FAILED (${e.voided}ml)`)
      haptic(e.success ? [50, 50, 100] : 120)
    }
  },
}

// The body language's moves (emotes.js; the 3D model makes them), heard and felt.
const EMOTE_SOUNDS = {
  sigh: () => audio.playExhale(),
  huff: () => audio.playExhale(true),
  hop: () => {
    audio.playBoing()
    haptic(15)
  },
}

// How the bladder feels (mood.js); the HUD shows it as `mood` in the store.
const mood = createMood()

// Each event's sound and haptics; then the bladder feels it, moves, and says something
// about it.
export function onEvent(event) {
  handlers[event.type]?.(event)
  feel(mood, event)
  // The same mood the 3D model moves with (Organ.jsx), so the sound matches the move.
  EMOTE_SOUNDS[emoteFor(event, useUiStore.getState().mood)]?.()
  const line = reactionLine(event, sim, mood)
  if (line) voice.speak(line)
}

// A bolus of urine squirting in from a ureter (organRig): a soft gulp from that side.
export function ureterSquirt(side) {
  audio.playUreterSquirt(0.3, side * 0.5)
}

// What the bladder noticed about the camera (StageFit, with feedback/camera.js): it was
// zoomed right in ('tooClose') or spun round ('dizzy').
export function noticeCamera(type) {
  onEvent({ type })
}

function onTick(sim, dt) {
  voice.update(dt)
  if (sim.isClenching) audio.updateClenchHum(sim.kegelStamina)
  if (sim.flowRate > 0) audio.updateDynamicJet(sim.flowRate, sim.pressure)
  stepMood(mood, dt, sim)
  const now = moodOf(mood, sim)
  if (now !== useUiStore.getState().mood) useUiStore.setState({ mood: now })
  const category = chatterLine(sim, mood)
  if (category) voice.speak(category)
}

// In the background the game stops: Scene pauses rendering (and with it the
// simulation), and the sound goes quiet. The browser drops the wake lock on hide, so a
// running challenge takes it again on return.
function onVisibilityChange() {
  const hidden = document.visibilityState === 'hidden'
  useUiStore.setState({ appHidden: hidden })
  if (hidden) {
    audio.suspend()
    voice.suspend()
  } else {
    audio.resume()
    if (sim.activeChallenge) keepScreenAwake(true)
  }
}

export function installFeedback() {
  voice.onSubtitle = (text, category, seconds) => {
    useUiStore.setState({ currentSubtitle: { text, category, seconds, mood: moodOf(mood, sim), id: Date.now() } })
  }
  const offEvent = onSimEvent(onEvent)
  const offTick = onSimTick(onTick)
  // Opening the cutaway is noticed (A5).
  const offCutaway = useUiStore.subscribe((state, prev) => {
    if (state.isCutawayActive && !prev.isCutawayActive) onEvent({ type: 'cutaway' })
  })
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    offEvent()
    offTick()
    offCutaway()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    voice.onSubtitle = null
  }
}
