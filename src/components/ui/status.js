// HUD status derived from the simulation snapshot, ported from the original's
// updateUI(): the sphincter readout, the header badge, pressure colour and the red
// screen-edge vignette.

const PULSE = ' animate-pulse'

export function sphincterReadout(hud) {
  if (hud.involuntaryVoiding) return { text: 'COLLAPSE (100%)', tone: 'text-red-500' + PULSE }
  if (hud.isStressLeaking) return { text: `LEAKING (${hud.tonePct}% Strain)`, tone: 'text-rose-500' + PULSE }
  // Shows the strain easing off while the Kegel is held.
  if (hud.isClenching) return { text: `CLENCHED (${hud.tonePct}%)`, tone: 'text-cyan-400' }
  if (hud.isActivelyVoiding) return { text: `DILATING (${hud.dilationPct}%)`, tone: 'text-amber-400' }
  if (hud.tonePct > 40) return { text: `STRAINED (${hud.tonePct}%)`, tone: 'text-amber-400' + PULSE }
  return { text: `RESTING (${hud.tonePct}%)`, tone: 'text-rose-400' }
}

const BADGE = {
  red: 'bg-red-950/90 text-red-400 border-red-800',
  rose: 'bg-rose-950/90 text-rose-400 border-rose-800',
  amber: 'bg-amber-950/80 text-amber-400 border-amber-800/60',
  emerald: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
}

// One constant object per state, so a store selector returning it only changes (and
// re-renders) when the state itself changes.
const STATUSES = {
  failure: {
    badge: 'INVOLUNTARY VOID', badgeTone: BADGE.red + PULSE, sub: 'Total sphincter failure!',
    pressureTone: 'text-red-500' + PULSE, vignette: 0.95, vignettePulse: true, iconScale: 1.2,
  },
  leak: {
    badge: 'STRESS LEAK', badgeTone: BADGE.rose + PULSE, sub: 'Equilibrating peak overpressure...',
    pressureTone: 'text-rose-400', vignette: 0.7, vignettePulse: false, iconScale: 1.1,
  },
  overpressure: {
    badge: 'OVERPRESSURE', badgeTone: BADGE.red + PULSE, sub: 'High retention wall stress',
    pressureTone: 'text-red-500', vignette: 0.35, vignettePulse: false, iconScale: 1,
  },
  distended: {
    badge: 'DISTENDED', badgeTone: BADGE.amber, sub: 'Active elastic stretch',
    pressureTone: 'text-amber-400', vignette: 0, vignettePulse: false, iconScale: 1,
  },
  nominal: {
    badge: 'NOMINAL', badgeTone: BADGE.emerald, sub: 'App Runtime • Hydro-Acoustics',
    pressureTone: 'text-emerald-400', vignette: 0, vignettePulse: false, iconScale: 1,
  },
}

export function organStatus(hud) {
  const fillPct = Math.min(100, Math.round((hud.volume / hud.maxCapacity) * 100))
  if (hud.involuntaryVoiding) return STATUSES.failure
  if (hud.isStressLeaking) return STATUSES.leak
  if (fillPct > 80) return STATUSES.overpressure
  if (fillPct > 40) return STATUSES.distended
  return STATUSES.nominal
}
