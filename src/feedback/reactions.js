import { drinkKind } from '../sim/drinks'

// Which kind of line the bladder says when something happens, if any (the lines are in
// src/audio/lines.js; AudioManager.speak decides whether it's their turn).

const DRINK_LINES = { water: 'drinkWater', caffeine: 'drinkCaffeine', alcohol: 'drinkAlcohol', big: 'drinkBig', other: 'drinkOther' }
const POINTS_LINES = { perfect: 'proud', braced: 'proud' }

const LINE_FOR = {
  ingest: (e) => DRINK_LINES[drinkKind(e.beverage)],
  clenchStart: () => 'clench',
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
  poke: () => 'poked',
  slap: () => 'poked',
  squeezeStart: () => 'squeezed',
  arcadePoints: (e) => POINTS_LINES[e.reason] ?? null,
  arcadeLevel: () => 'levelUp',
  voice: (e) => e.category,
}

export function reactionLine(event) {
  return LINE_FOR[event.type]?.(event) ?? null
}
