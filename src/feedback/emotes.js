// What the bladder does with its body when something happens: bodyLanguage.js moves it,
// feedback.js gives the moves their sounds. No Three.js here, so the HUD can use it before
// the 3D scene loads.

const EMOTE_FOR = {
  leakStart: 'shudder', failureStart: 'shudder', clenchExhausted: 'droop', creak: 'creak',
  leakSaved: 'hop', arcadeLevel: 'hop', microWin: 'hop', leakEnd: 'sigh', voidStop: 'sigh', soothe: 'sigh',
}
// What the bladder does when `event` happens, feeling `mood` (feedback/mood.js), if anything.
export function emoteFor(event, mood) {
  if (event.type === 'urgeEnd') return event.suppressed ? 'sigh' : null
  if (event.type === 'arcadePoints') return event.reason === 'perfect' || event.reason === 'braced' ? 'hop' : null
  if ((event.type === 'poke' && event.touch) || event.type === 'slap') return mood === 'annoyed' ? 'huff' : null
  return EMOTE_FOR[event.type] ?? null
}
