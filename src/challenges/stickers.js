// Stickers (A12): small achievements, each earned once and kept on the device. They're read
// from the events the game already reports (and, for a few, the simulation's state), so the
// rules here don't change how anything plays. Each one's name and how to earn it are i18n's
// sticker.<id> and sticker.<id>.hint.

export const STICKERS = [
  { id: 'banked', icon: '🏦' },
  { id: 'dry', icon: '💎' },
  { id: 'level5', icon: '⭐' },
  { id: 'perfect10', icon: '🎯' },
  { id: 'combo10', icon: '🔥' },
  { id: 'saves3', icon: '🛡️' },
  { id: 'held700', icon: '🫙' },
  { id: 'beyond', icon: '🎈' },
  { id: 'taster', icon: '🍹' },
  { id: 'pitcher', icon: '🍻' },
  { id: 'commute', icon: '🚌' },
  { id: 'bullseye', icon: '🏹' },
  { id: 'micro10', icon: '⚡' },
  { id: 'boss', icon: '👑' },
]

const TASTER_DRINKS = 10
const PITCHER_SECONDS = 60
const SAVES = 3

// What's kept on the device: the stickers earned (id -> when) and the drinks tried.
export const EMPTY_STICKERS = { earned: {}, tasted: [] }

// What's counted toward them in the meantime, not kept: slips saved this run, and the
// seconds since a pitcher without a leak (null when there's none to count).
export function createStickerProgress() {
  return { saves: 0, pitcher: null }
}

// What `event` does toward the stickers, given the simulation after it: `earned`, the ones
// it earns (by id), and `tasted`, the drinks tried now if it's a new one (else null).
// Updates `progress`.
export function stickersFromEvent(kept, progress, event, sim) {
  const earned = []
  let tasted = null
  const a = sim.arcade
  switch (event.type) {
    case 'challengeStart':
    case 'reset':
      progress.saves = 0
      break
    case 'ingest':
      if (!kept.tasted.includes(event.beverage)) {
        tasted = [...kept.tasted, event.beverage]
        if (tasted.length >= TASTER_DRINKS) earned.push('taster')
      }
      if (event.beverage === 'pitcher') progress.pitcher = 0
      break
    case 'leakStart':
    case 'failureStart':
      progress.pitcher = null
      break
    case 'leakSaved':
      if (!a) break // a run's saves
      progress.saves += 1
      if (progress.saves >= SAVES) earned.push('saves3')
      break
    case 'arcadeLevel':
      if (event.level >= 5) earned.push('level5')
      break
    case 'arcadePoints':
      if (a && a.perfects >= 10) earned.push('perfect10')
      if (event.combo >= 10) earned.push('combo10')
      break
    case 'microWin':
      if (sim.micro && sim.micro.score >= 10) earned.push('micro10')
      break
    case 'microBoss':
      if (event.won) earned.push('boss')
      break
    case 'challengeResult':
      if (event.challenge === 'arcade' && event.success) earned.push('banked', ...(event.leaks === 0 ? ['dry'] : []))
      if (event.challenge === 'commute' && event.success) earned.push('commute')
      if (event.challenge === 'precision' && event.success) earned.push('bullseye')
      if (event.challenge === 'micro' && event.score >= 10) earned.push('micro10')
      break
  }
  return { earned: earned.filter((id) => !kept.earned[id]), tasted }
}

// The stickers earned by holding on over `dt` seconds.
export function stickersFromTick(kept, progress, sim, dt) {
  const earned = []
  if (sim.volume >= 700) earned.push('held700')
  if (sim.volume > sim.maxCapacity) earned.push('beyond')
  if (progress.pitcher !== null) {
    progress.pitcher += dt
    if (progress.pitcher >= PITCHER_SECONDS) {
      progress.pitcher = null
      earned.push('pitcher')
    }
  }
  return earned.filter((id) => !kept.earned[id])
}

// `kept` with `ids` earned at `when`.
export const earn = (kept, ids, when) => ({ ...kept, earned: { ...kept.earned, ...Object.fromEntries(ids.map((id) => [id, when])) } })
