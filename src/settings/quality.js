// Rendering quality tiers (ROADMAP M7). Measured under software WebGL on a Pixel 7
// profile, where frame rate follows GPU work: the liquid's transmission pass (an extra
// full-screen render with mipmaps every frame) and the pixel ratio are the costs that
// matter; clearcoat and mesh detail barely register, so every tier keeps them.
export const QUALITY_TIERS = {
  // Refractive liquid, rendered at half resolution: indistinguishable from full.
  high: { label: 'High', maxDpr: 2, transmission: true, transmissionScale: 0.5 },
  // Liquid faked with plain transparency; slightly softer image.
  medium: { label: 'Medium', maxDpr: 1.5, transmission: false, transmissionScale: 1 },
  low: { label: 'Low', maxDpr: 1, transmission: false, transmissionScale: 1 },
}

export const TIER_ORDER = ['high', 'medium', 'low']

export const isTier = (tier) => Object.hasOwn(QUALITY_TIERS, tier)

export function lowerTier(tier) {
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tier) + 1)]
}

// Decides when Auto quality should step down: `strikes` consecutive windows of
// `windowSec` below `minFps`. It ignores the first `settleSec` after a (re)start, when
// shaders compile, and resets on gaps longer than `maxGapSec` (the app was hidden).
export function createFpsMonitor({ minFps = 48, windowSec = 2, settleSec = 3, strikes = 2, maxGapSec = 0.25 } = {}) {
  let settle, time, frames, misses
  const reset = () => {
    settle = settleSec
    time = 0
    frames = 0
    misses = 0
  }
  reset()

  // Feed one frame's delta (seconds); returns true when quality should drop.
  const sample = (dt) => {
    if (dt > maxGapSec) {
      time = 0
      frames = 0
      return false
    }
    if (settle > 0) {
      settle -= dt
      return false
    }
    time += dt
    frames++
    if (time < windowSec) return false
    misses = frames / time < minFps ? misses + 1 : 0
    time = 0
    frames = 0
    if (misses < strikes) return false
    reset()
    return true
  }

  return { reset, sample }
}
