import { act, advance, onSimEvent, publishHud, setPaused, sim } from '../sim/engine'
import * as simActions from '../sim/sim'
import * as interactions from '../sim/interactions'
import * as arcade from '../sim/arcade'
import { useUiStore } from '../store/useUiStore'

// Dev-only test hook exposed as `window.__vesica`. Every call site is guarded by
// `import.meta.env.DEV`, so production builds drop it entirely.

const renders = {}

export function countRender(name) {
  if (import.meta.env.DEV) renders[name] = (renders[name] || 0) + 1
}

// Plain, serialisable copy of the simulation (history summarised by length, a microgames
// run's games by their ids).
function snapshot() {
  const out = {}
  for (const [key, value] of Object.entries(sim)) {
    if (key === 'telemetryHistory') out.telemetryLength = value.length
    else if (key === 'micro' && value) {
      const { games, game, boss, ...rest } = value
      out.micro = structuredClone({
        ...rest, games: games.map((g) => g.id), game: game?.id ?? null,
        boss: boss && { ...boss, queue: boss.queue.map((g) => g.id) },
      })
    } else out[key] = structuredClone(value)
  }
  return out
}

export function installDevHook() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return

  const events = []
  onSimEvent((event) => {
    events.push(event)
    if (events.length > 500) events.shift()
  })

  window.__vesica = {
    getState: snapshot,
    getUi: () => {
      const { currentTab, interactionMode, isCutawayActive, challengeResults, hud } = useUiStore.getState()
      return structuredClone({ currentTab, interactionMode, isCutawayActive, challengeResults, hud })
    },
    setUi: (partial) => useUiStore.setState(partial),
    setState: (partial) => {
      Object.assign(sim, partial)
      publishHud()
    },
    // Run a named action from src/sim/sim.js, interactions.js or arcade.js, e.g. act('ingestBeverage', 'water').
    act: (name, ...args) => act(simActions[name] ?? interactions[name] ?? arcade[name], ...args),
    // Pause the per-frame loop so tests can step the simulation deterministically.
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    step: (frames = 1, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) advance(dt)
    },
    events,
    clearEvents: () => { events.length = 0 },
    renders,
    resetRenders: () => {
      for (const key of Object.keys(renders)) delete renders[key]
    },
  }
}
