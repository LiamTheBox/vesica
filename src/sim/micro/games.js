// The microgames (M8): short, abstract challenges about controlling the sphincter, each a
// pressure spike survived with one control action. Logic only: the runner (runner.js) plays
// them and src/components/micro/ draws them.
//
// A game is { id, verb, seconds, start, step, timeout }:
// - seconds: how long it lasts at speed 1 (the runner divides by the speed);
// - start(rng, speed): a fresh round at `speed` (1 at first, up to MAX_SPEED), with
//   anything random drawn from `rng` up front, so a round plays the same for the same rolls;
// - step(g, input, dt): one frame; returns 'win', 'lose' or null (still going);
// - timeout: the result when the fuse runs out first.
// The play area is the unit square, y down. `input` is one pointer (a finger or the left
// mouse button; Space presses too): its place (x, y), whether it's down, the presses since
// the last frame (each with its place) and how many releases.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// CLENCH!: pulses run down a line to the sphincter's ring; press as each one is in it.
export const CLENCH_RING_Y = 0.78
export const CLENCH = {
  id: 'clench',
  verb: 'CLENCH!',
  seconds: 4.5,
  start(rng, speed) {
    const count = speed < 1.35 ? 1 : speed < 1.75 ? 2 : 3
    const duration = this.seconds / speed
    // Spread over the middle of the round, each a little off the beat.
    const pulses = Array.from({ length: count }, (_, i) => ({
      arrive: duration * (0.4 + (0.45 * (i + 0.2 + 0.6 * rng())) / count),
      caught: false,
    }))
    return { t: 0, pulses, travel: 1.6 / speed, window: 0.17 / Math.sqrt(speed) }
  },
  step(g, input, dt) {
    g.t += dt
    for (let i = 0; i < input.presses.length; i++) {
      const next = g.pulses.find((p) => !p.caught)
      if (!next || Math.abs(g.t - next.arrive) > g.window) return 'lose'
      next.caught = true
      next.caughtAt = g.t
    }
    if (g.pulses.some((p) => !p.caught && g.t > p.arrive + g.window)) return 'lose'
    return g.pulses.every((p) => p.caught) ? 'win' : null
  },
  timeout: 'lose',
}

// PUSH!: the pressure rises; every tap knocks it back. Keep it below the top.
export const PUSH = {
  id: 'push',
  verb: 'PUSH!',
  seconds: 4,
  start(rng, speed) {
    return { level: 0.35, rate: (0.38 + 0.06 * rng()) * speed, knock: 0.09, knocked: 0 }
  },
  step(g, input, dt) {
    g.level = Math.max(0, g.level + g.rate * dt - g.knock * input.presses.length)
    g.knocked += input.presses.length
    return g.level >= 1 ? 'lose' : null
  },
  timeout: 'win',
}

// SEAL!: cracks open around the ring one after another; tap each before it opens.
export const SEAL_RADIUS = 0.3
const SEAL_REACH = 0.12 // how close to a crack a tap must land
export const SEAL = {
  id: 'seal',
  verb: 'SEAL!',
  seconds: 4.5,
  start(rng, speed) {
    const count = Math.min(6, 3 + Math.floor((speed - 1) * 3))
    const duration = this.seconds / speed
    const open = 1.5 / Math.pow(speed, 0.6) // how long a crack takes to open
    const span = duration - open - 0.2
    const turn = rng() * Math.PI * 2
    // Around the ring in a shuffled order, so the next one could be anywhere.
    const slots = Array.from({ length: count }, (_, i) => i)
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[slots[i], slots[j]] = [slots[j], slots[i]]
    }
    const cracks = slots.map((slot, i) => {
      const angle = turn + ((slot + 0.3 * (rng() - 0.5)) / count) * Math.PI * 2
      return {
        x: 0.5 + SEAL_RADIUS * Math.cos(angle),
        y: 0.5 + SEAL_RADIUS * Math.sin(angle),
        at: 0.1 + (span * (i + 0.5 * rng())) / count,
        sealed: false,
      }
    })
    return { t: 0, cracks, open }
  },
  step(g, input, dt) {
    g.t += dt
    for (const press of input.presses) {
      let best = null
      let bestDistance = SEAL_REACH
      for (const crack of g.cracks) {
        if (crack.sealed || g.t < crack.at) continue
        const distance = Math.hypot(press.x - crack.x, press.y - crack.y)
        if (distance <= bestDistance) {
          best = crack
          bestDistance = distance
        }
      }
      if (best) best.sealed = true
    }
    if (g.cracks.some((c) => !c.sealed && g.t - c.at >= g.open)) return 'lose'
    return g.cracks.every((c) => c.sealed) ? 'win' : null
  },
  timeout: 'lose',
}

// BALANCE!: the full bladder stands on a point and tips over unless held; spikes shove it.
// Holding and dragging to one side pulls its top that way.
export const BALANCE_FALLEN = 0.9 // radians from upright
const TIP = 6 // how fast it tips, 1/s²
const DAMP = 1.2
const PULL = 12 // the pull at full drag, rad/s²
export const BALANCE = {
  id: 'balance',
  verb: 'BALANCE!',
  seconds: 5,
  start(rng, speed) {
    const duration = this.seconds / speed
    const shoves = []
    for (let t = 0.6 / speed; t < duration; t += (0.7 + 0.5 * rng()) / speed) {
      shoves.push({ t, kick: (rng() < 0.5 ? -1 : 1) * (0.9 + 0.6 * rng()) * Math.sqrt(speed) })
    }
    return { t: 0, angle: (rng() < 0.5 ? -1 : 1) * 0.1, spin: 0, shoves, next: 0, pull: 0 }
  },
  step(g, input, dt) {
    g.t += dt
    while (g.next < g.shoves.length && g.shoves[g.next].t <= g.t) g.spin += g.shoves[g.next++].kick
    g.pull = input.down ? clamp((input.x - 0.5) * 2, -1, 1) : 0
    g.spin += (TIP * Math.sin(g.angle) - DAMP * g.spin + PULL * g.pull) * dt
    g.angle += g.spin * dt
    return Math.abs(g.angle) > BALANCE_FALLEN ? 'lose' : null
  },
  timeout: 'win',
}

export const GAMES = [CLENCH, PUSH, SEAL, BALANCE]
