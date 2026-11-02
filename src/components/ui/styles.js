// The looks the sheets share, so a card, a choice or a main button is the same everywhere.
const PANEL = 'bg-slate-900/60 rounded-2xl border border-slate-800'
export const CARD = `${PANEL} flex flex-col gap-2 p-3`
export const SMALL_CARD = `${PANEL} p-2`
export const CARD_TITLE = 'text-xs font-extrabold text-slate-200'
export const CARD_NOTE = 'text-[11px] text-slate-400 leading-relaxed'
export const SMALL_LABEL = 'text-[9px] text-slate-400 uppercase font-mono'
// The one thing a card is there to do, and a quieter one.
const ACTION = 'w-full min-h-11 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition'
export const MAIN_ACTION = `${ACTION} bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950`
export const QUIET_ACTION = `${ACTION} bg-slate-800 hover:bg-slate-700 text-slate-200`
// One of a few choices (a personality, a graphics tier...).
export const choiceTone = (chosen) =>
  `min-h-11 rounded-xl text-xs font-bold active:scale-95 transition ${chosen ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`
