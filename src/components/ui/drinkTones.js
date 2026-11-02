import { DRINK_GROUPS } from '../../sim/drinks'

// Each group of drinks has its colour, on the shelf and in the menu: its tile, its ml and
// its dot in the menu's key.
export const TONES = {
  water: { tile: 'bg-cyan-950/60 border-cyan-700/70 hover:border-cyan-300', ml: 'text-cyan-300', dot: 'bg-cyan-400' },
  coffeeTea: { tile: 'bg-amber-950/60 border-amber-700/70 hover:border-amber-300', ml: 'text-amber-300', dot: 'bg-amber-400' },
  soft: { tile: 'bg-rose-950/60 border-rose-700/70 hover:border-rose-300', ml: 'text-rose-300', dot: 'bg-rose-400' },
  juice: { tile: 'bg-lime-950/60 border-lime-700/70 hover:border-lime-300', ml: 'text-lime-300', dot: 'bg-lime-400' },
  milk: { tile: 'bg-slate-800/80 border-slate-500/70 hover:border-slate-200', ml: 'text-slate-200', dot: 'bg-slate-300' },
  alcohol: { tile: 'bg-violet-950/60 border-violet-700/70 hover:border-violet-300', ml: 'text-violet-300', dot: 'bg-violet-400' },
}

const GROUP_OF = Object.fromEntries(DRINK_GROUPS.flatMap((group) => Object.keys(group.drinks).map((key) => [key, group.id])))
export const toneOf = (key) => TONES[GROUP_OF[key]]
