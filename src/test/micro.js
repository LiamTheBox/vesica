// Helpers for the microgames' tests (src/sim/micro): repeatable rolls, and one round of a
// game played with a scripted pointer.

export const DT = 1 / 60

// A repeatable stream of rolls in [0, 1).
export function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Plays one round of `game`. `control(g)` gives the pointer for the next frame, { down, x, y };
// it presses when it goes down. Returns 'win' or 'lose'.
export function play(game, { speed = 1, seed = 1, control = () => ({ down: false }) } = {}) {
  const g = game.start(seeded(seed), speed)
  const input = { x: 0.5, y: 0.5, down: false, presses: [], releases: 0 }
  for (let t = 0; t < game.seconds / speed; t += DT) {
    const { down = false, x = input.x, y = input.y } = control(g) ?? {}
    input.x = x
    input.y = y
    input.presses = down && !input.down ? [{ x, y }] : []
    input.releases = !down && input.down ? 1 : 0
    input.down = down
    const result = game.step(g, input, DT)
    if (result) return result
  }
  return game.timeout
}
