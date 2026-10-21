import { createSimState } from './sim'
import { scoreArcade, stepGame } from './arcade'
import { useUiStore } from '../store/useUiStore'

// The single live simulation, its event bus, and the bridge to React.

export const sim = createSimState()

const eventListeners = new Set()
const tickListeners = new Set()
let paused = false

export function onSimEvent(listener) {
  eventListeners.add(listener)
  return () => eventListeners.delete(listener)
}

export function onSimTick(listener) {
  tickListeners.add(listener)
  return () => tickListeners.delete(listener)
}

function dispatch(events) {
  for (const event of events) {
    for (const listener of eventListeners) listener(event, sim)
  }
}

// Runs a sim action, e.g. `act(ingestBeverage, 'water')`, then delivers its events
// (scored first, during an arcade run).
export function act(action, ...args) {
  const out = []
  action(sim, out, ...args)
  if (sim.arcade) scoreArcade(sim, out)
  dispatch(out)
  publishHud()
}

export function advance(dt) {
  const out = []
  stepGame(sim, dt, out)
  dispatch(out)
  for (const listener of tickListeners) listener(sim, dt)
  publishHud()
}

// Called once per rendered frame. Tests can pause it and drive `advance` directly.
export function tick(dt) {
  if (!paused) advance(dt)
}

export function setPaused(value) {
  paused = value
}

const round1 = (v) => Math.round(v * 10) / 10

function hudOf(s) {
  return {
    volume: Math.round(s.volume),
    maxCapacity: s.maxCapacity,
    endless: s.volumeCap === Infinity,
    staminaPct: Math.min(100, Math.round(s.kegelStamina * 100)),
    pressure: round1(s.pressure),
    flowRate: round1(s.flowRate),
    tonePct: Math.round(s.sphincterToneStrain * 100),
    dilationPct: Math.round(s.sphincterDilation * 100),
    isClenching: s.isClenching,
    clenchExhausted: s.clenchExhausted,
    isAttemptingVoid: s.isAttemptingVoid,
    isActivelyVoiding: s.isActivelyVoiding,
    voidProgress: s.isAttemptingVoid ? Math.round(Math.min(1, s.voidLatencyTimer / s.voidLatencyRequired) * 50) / 50 : 0,
    voidSecondsLeft: round1(Math.max(0, s.voidLatencyRequired - s.voidLatencyTimer)),
    isStressLeaking: s.isStressLeaking,
    involuntaryVoiding: s.involuntaryVoiding,
    isUrgeWaveActive: s.isUrgeWaveActive,
    totalLeaked: Math.round(s.totalLeakedVolume),
    maxPressure: round1(s.maxRecordedPressure),
    activeChallenge: s.activeChallenge,
    challengeSeconds: Math.max(0, Math.round(s.challengeTimer)),
    urgeWarned: s.urgeWarned,
    coughWarned: s.coughWarned,
    leakGrace: s.leakGrace > 0,
    sootheSeconds: Math.ceil(s.sootheCooldown),
    arcadeScore: s.arcade ? Math.floor(s.arcade.score) : 0,
    arcadeCombo: s.arcade ? s.arcade.combo : 0,
    arcadeLevel: s.arcade ? s.arcade.level : 0,
    arcadeSeconds: s.arcade ? Math.floor(s.arcade.time) : 0,
    micro: !!s.micro,
    microLives: s.micro ? s.micro.lives : 0,
    microScore: s.micro ? s.micro.score : 0,
    microLevel: s.micro ? s.micro.level : 0,
  }
}

export function publishHud() {
  const next = hudOf(sim)
  const prev = useUiStore.getState().hud
  for (const key in next) {
    if (next[key] !== prev[key]) {
      useUiStore.setState({ hud: next })
      return
    }
  }
}
