import { drinkKind } from '../sim/drinks'
import { ambientVoiceCategory, fillRatioOf } from '../sim/sim'
import { ANNOYED, HIGH_FILL, LOW_FILL, moodOf } from './mood'

// Which kind of line the bladder says when something happens, if any, given how full it is
// and its mood (the lines are in src/audio/lines.js; AudioManager.speak decides whether
// it's their turn).

const DRINK_LINES = { water: 'drinkWater', caffeine: 'drinkCaffeine', alcohol: 'drinkAlcohol', big: 'drinkBig', other: 'drinkOther' }
const POINTS_LINES = { perfect: 'proud', braced: 'proud' }
// Full enough that another drink is a problem.
const TOO_FULL_TO_DRINK = 0.72

// The same touch reads differently empty (it tickles) and full (it hurts), and a run of
// them wears thin.
function touchLine(sim, mood, empty, middle, full) {
  if (mood.annoyance >= ANNOYED) return 'annoyed'
  const fill = fillRatioOf(sim)
  if (fill < LOW_FILL) return empty
  return fill > HIGH_FILL || sim.sphincterToneStrain > 0.5 ? full : middle
}

// A clench with nothing to hold back.
const idleClench = (sim) => !sim.isUrgeWaveActive && !sim.urgeWarned && !sim.coughWarned && !sim.isStressLeaking &&
  sim.leakGrace <= 0 && fillRatioOf(sim) < 0.45 && sim.sphincterToneStrain < 0.3

const LINE_FOR = {
  ingest: (e, sim) => (fillRatioOf(sim) > TOO_FULL_TO_DRINK ? 'drinkFull' : DRINK_LINES[drinkKind(e.beverage)]),
  clenchStart: (e, sim) => (idleClench(sim) ? 'clenchIdle' : 'clench'),
  clenchExhausted: () => 'exhausted',
  urgeWarning: () => 'urgeIncoming',
  sneezeWarning: () => 'sneezeIncoming',
  urgeStart: () => 'urge',
  urgeEnd: (e) => (e.suppressed ? 'urgePassed' : 'urgeFaded'),
  leakWarning: () => 'slipping',
  leakSaved: () => 'saved',
  leakStart: () => 'leak',
  leakEnd: () => 'leakOver',
  failureStart: () => 'involuntary',
  failureEnd: () => 'aftermath',
  voidStart: () => 'voiding',
  agitation: (e) => (e.speakShaken ? 'shaken' : null),
  soothe: () => 'soothe',
  poke: (e, sim, mood) => touchLine(sim, mood, 'pokeEmpty', 'poked', 'pokeFull'),
  slap: (e, sim, mood) => touchLine(sim, mood, 'slapped', 'slapped', 'slapFull'),
  squeezeStart: (e, sim, mood) => touchLine(sim, mood, 'squeezeEmpty', 'squeezed', 'squeezed'),
  arcadePoints: (e) => POINTS_LINES[e.reason] ?? null,
  arcadeLevel: () => 'levelUp',
  voice: (e, sim) => (e.category === 'cough' && sim.isClenching ? 'coughBraced' : e.category),
}

// `mood` has already taken the event in (mood.feel).
export function reactionLine(event, sim, mood) {
  return LINE_FOR[event.type]?.(event, sim, mood) ?? null
}

// What it says on its own, now and then: about how full it is, or a sleepy murmur. Not in
// the middle of a feeling (an embarrassment, the relief, the pride) or a strop.
const QUIET_MOODS = new Set(['embarrassed', 'relieved', 'proud', 'annoyed'])
export function chatterLine(sim, mood) {
  const now = moodOf(mood, sim)
  if (now === 'sleepy') return 'sleepy'
  return QUIET_MOODS.has(now) ? null : ambientVoiceCategory(sim)
}
