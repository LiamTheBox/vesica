import { useSimStore } from '../store/useSimStore'

// Dev-only test hook exposed as `window.__vesica`. Every call site is guarded by
// `import.meta.env.DEV`, so production builds drop it entirely.

const renders = {}

export function countRender(name) {
  if (import.meta.env.DEV) renders[name] = (renders[name] || 0) + 1
}

// Plain, serialisable copy of the store (no actions, vectors as {x, y, z}).
function snapshot(state) {
  const out = {}
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === 'function') continue
    if (value && value.isVector3) out[key] = { x: value.x, y: value.y, z: value.z }
    else if (key === 'telemetryHistory') out.telemetryLength = value.length
    else out[key] = structuredClone(value)
  }
  return out
}

export function installDevHook() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  window.__vesica = {
    getState: () => snapshot(useSimStore.getState()),
    setState: (partial) => useSimStore.setState(partial),
    renders,
    resetRenders: () => {
      for (const key of Object.keys(renders)) delete renders[key]
    },
  }
}
