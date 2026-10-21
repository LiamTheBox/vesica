import { fillRatioOf } from '../sim/sim'

// The bladder's mood: what it feels right now, from how full and strained it is and what
// just happened to it (a leak embarrasses it for a while, a run of pokes annoys it, an urge
// calmed or a void leaves it relieved). The mood picks its lines, shows as its face on the
// HUD and in its subtitles, and sets its body language (organRig).

export const MOOD_FACES = {
  sleepy: '😴', calm: '😌', uneasy: '😬', desperate: '😣', panic: '😱',
  relieved: '😮‍💨', embarrassed: '😳', annoyed: '😤', proud: '😎',
}

// What a touch adds to the annoyance (a drag pokes on every move, so a step adds little),
// and from how much on it's annoyed. Feelings fade by this much a second.
const ANNOY = { poke: 0.2, rub: 0.004, slap: 0.3, squeeze: 0.2 }
export const ANNOYED = 0.6
const FADE = { annoyance: 0.12, embarrassment: 1 / 8, relief: 1 / 5, pride: 1 / 4 }
// Nearly empty with nothing happening for this long, it dozes off.
export const SLEEPY_AFTER = 20
const SLEEPY_FILL = 0.18
const PANIC_STRAIN = 0.85
const DESPERATE_STRAIN = 0.5
export const LOW_FILL = 0.3
export const HIGH_FILL = 0.65

export function createMood() {
  return { annoyance: 0, embarrassment: 0, relief: 0, pride: 0, idle: 0 }
}

const PROUD_POINTS = new Set(['perfect', 'braced', 'saved'])

// Takes in a simulation event.
export function feel(mood, event) {
  mood.idle = 0
  switch (event.type) {
    case 'poke':
      mood.annoyance = Math.min(1, mood.annoyance + (event.touch ? ANNOY.poke : ANNOY.rub))
      break
    case 'slap':
      mood.annoyance = Math.min(1, mood.annoyance + ANNOY.slap)
      break
    case 'squeezeStart':
      mood.annoyance = Math.min(1, mood.annoyance + ANNOY.squeeze)
      break
    case 'soothe':
      mood.annoyance *= 0.3
      mood.relief = 1
      break
    case 'leakStart':
    case 'failureStart':
    case 'failureEnd':
      mood.embarrassment = 1
      break
    case 'leakEnd':
      mood.embarrassment = Math.max(mood.embarrassment, 0.75)
      break
    case 'leakSaved':
    case 'voidStop':
      mood.relief = 1
      break
    case 'urgeEnd':
      mood.relief = event.suppressed ? 1 : 0.6
      break
    case 'arcadePoints':
      if (PROUD_POINTS.has(event.reason)) mood.pride = 1
      break
    case 'arcadeLevel':
      mood.pride = 1
      break
    case 'reset':
      Object.assign(mood, createMood())
      break
  }
}

export function stepMood(mood, dt) {
  mood.annoyance = Math.max(0, mood.annoyance - FADE.annoyance * dt)
  mood.embarrassment = Math.max(0, mood.embarrassment - FADE.embarrassment * dt)
  mood.relief = Math.max(0, mood.relief - FADE.relief * dt)
  mood.pride = Math.max(0, mood.pride - FADE.pride * dt)
  mood.idle += dt
}

// The mood that shows, most pressing first.
export function moodOf(mood, sim) {
  const fill = fillRatioOf(sim)
  const strain = sim.sphincterToneStrain
  if (sim.involuntaryVoiding || sim.isStressLeaking || sim.leakGrace > 0 || strain > PANIC_STRAIN) return 'panic'
  if (mood.embarrassment > 0) return 'embarrassed'
  if (sim.isActivelyVoiding) return 'relieved'
  if (mood.pride > 0) return 'proud'
  if (mood.annoyance >= ANNOYED) return 'annoyed'
  if (fill > 0.72 || strain > DESPERATE_STRAIN || sim.isUrgeWaveActive) return 'desperate'
  if (mood.relief > 0) return 'relieved'
  if (fill > 0.45 || sim.urgeWarned || sim.coughWarned) return 'uneasy'
  if (fill < SLEEPY_FILL && mood.idle >= SLEEPY_AFTER) return 'sleepy'
  return 'calm'
}
