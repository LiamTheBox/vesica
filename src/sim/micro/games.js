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

// How hard the pointer squeezes (0..1) in the games that take a squeeze: while pressed, the
// higher it is in the play area the harder; let go, and it's none.
export const SQUEEZE_BOTTOM = 0.92
export const SQUEEZE_TOP = 0.08
export const squeezeOf = (input) => (input.down ? clamp((SQUEEZE_BOTTOM - input.y) / (SQUEEZE_BOTTOM - SQUEEZE_TOP), 0, 1) : 0)
// Where to hold the pointer for a squeeze (the tests use it).
export const heightFor = (squeeze) => SQUEEZE_BOTTOM - squeeze * (SQUEEZE_BOTTOM - SQUEEZE_TOP)

// Pressure spikes as short surges on a steady rise: [start, end, extra rise per second].
// They come faster as the game speeds up, but never too fast to answer.
function surges(rng, speed, duration, size) {
  const list = []
  for (let t = (0.5 + 0.4 * rng()) / speed; t < duration - 0.3; t += (0.8 + 0.5 * rng()) / Math.sqrt(speed)) {
    list.push([t, t + 0.25, size * (0.8 + 0.4 * rng())])
  }
  return list
}
const surgeAt = (list, t) => list.reduce((sum, [from, to, rise]) => sum + (t >= from && t < to ? rise : 0), 0)

// HOLD!: the pressure needle creeps up and surges; squeeze to keep it in the green band.
// Out of the band (too loose or too tight) for long in all, and it's lost.
export const HOLD_BAND = 0.5 // the band's middle
export const HOLD_SQUEEZE = 1.4 // how fast a full squeeze lowers the needle, per second
const OUT_ALLOWANCE = 0.6 // seconds out of the band, in all
export const HOLD = {
  id: 'hold',
  verb: 'HOLD!',
  seconds: 5,
  start(rng, speed) {
    const lift = Math.pow(speed, 0.4)
    return {
      t: 0, needle: HOLD_BAND, out: 0,
      half: Math.max(0.09, 0.15 / Math.sqrt(speed)),
      rise: 0.35 * lift,
      surges: surges(rng, speed, this.seconds / speed, 0.8 * lift),
      squeeze: 0,
    }
  },
  step(g, input, dt) {
    g.t += dt
    g.squeeze = squeezeOf(input)
    g.needle = clamp(g.needle + (g.rise + surgeAt(g.surges, g.t) - HOLD_SQUEEZE * g.squeeze) * dt, 0, 1)
    if (Math.abs(g.needle - HOLD_BAND) > g.half) g.out += dt
    return g.out > OUT_ALLOWANCE ? 'lose' : null
  },
  timeout: 'win',
}

// MATCH!: the target ring swells and shrinks; squeeze so yours matches it.
export const MATCH_OPEN = 0.42 // your ring with no squeeze
export const MATCH_SHUT = 0.06 // and fully squeezed
export const ringFor = (squeeze) => MATCH_OPEN - (MATCH_OPEN - MATCH_SHUT) * squeeze
export const MATCH = {
  id: 'match',
  verb: 'MATCH!',
  seconds: 5,
  start(rng, speed) {
    return {
      t: 0, off: 0, ring: MATCH_OPEN,
      tolerance: 0.05 / Math.pow(speed, 0.3),
      allowance: 0.9 / Math.sqrt(speed),
      waves: [
        [0.1, 1.6 * speed, rng() * Math.PI * 2],
        [0.05, 3.1 * speed, rng() * Math.PI * 2],
      ],
    }
  },
  target(g, t = g.t) {
    return 0.24 + g.waves.reduce((sum, [size, rate, phase]) => sum + size * Math.sin(rate * t + phase), 0)
  },
  step(g, input, dt) {
    g.t += dt
    g.ring = ringFor(squeezeOf(input))
    // A moment to get a finger on it.
    if (g.t > 0.4 && Math.abs(g.ring - this.target(g)) > g.tolerance) g.off += dt
    return g.off > g.allowance ? 'lose' : null
  },
  timeout: 'win',
}

// STOP!: it's flowing; press to shut it so the level stops in the band. It takes a moment
// to close, so the level runs on a little after the press.
export const STOP_CLOSE = 0.2 // seconds to close
export const STOP = {
  id: 'stop',
  verb: 'STOP!',
  seconds: 4.5,
  start(rng, speed) {
    const width = 0.13 / Math.pow(speed, 0.35)
    return { t: 0, level: 0, flow: 0.3 * speed, open: 1, closing: false, low: 0.5 + 0.25 * rng(), width }
  },
  step(g, input, dt) {
    g.t += dt
    if (input.presses.length > 0) g.closing = true
    if (g.closing) g.open = Math.max(0, g.open - dt / STOP_CLOSE)
    g.level += g.flow * g.open * dt
    if (g.level > g.low + g.width) return 'lose'
    if (g.open === 0) return g.level >= g.low ? 'win' : 'lose'
    return null
  },
  timeout: 'lose',
}

// RELEASE!: a spike swells, stays and passes. Hold through it, then let go in the moment
// after it passes: letting go while it's on, not holding when it comes, or holding on too
// long all lose.
export const RELEASE_ON = 0.12 // the spike counts as on above this
export const RELEASE = {
  id: 'release',
  verb: 'RELEASE!',
  seconds: 5,
  start(rng, speed) {
    const begin = (0.5 + 0.6 * rng()) / speed
    const rise = 0.5 / speed
    const stay = (0.4 + 0.5 * rng()) / speed
    const fall = 0.4 / speed
    return { t: 0, begin, rise, stay, fall, end: begin + rise + stay + fall, window: 0.55 / Math.sqrt(speed), held: false }
  },
  // The spike's size, 0..1, at time t.
  spike(g, t = g.t) {
    const s = t - g.begin
    if (s <= 0 || t >= g.end) return 0
    if (s < g.rise) return s / g.rise
    if (s < g.rise + g.stay) return 1
    return (g.end - t) / g.fall
  },
  step(g, input, dt) {
    g.t += dt
    g.held = input.down
    if (g.t < g.end) return this.spike(g) > RELEASE_ON && !input.down ? 'lose' : null
    if (!input.down) return 'win'
    return g.t > g.end + g.window ? 'lose' : null
  },
  timeout: 'lose',
}

// PULSE!: spikes come on a beat; tap on every one. A tap off the beat, or a beat missed,
// loses.
export const PULSE_BEATS = 5
export const PULSE = {
  id: 'pulse',
  verb: 'PULSE!',
  seconds: 4.5,
  start(rng, speed) {
    const gap = 0.55 / Math.pow(speed, 0.6)
    const first = (0.7 + 0.2 * rng()) / speed
    return {
      t: 0, gap,
      beats: Array.from({ length: PULSE_BEATS }, (_, i) => ({ at: first + i * gap, hit: false, hitAt: 0 })),
      window: 0.13 / Math.sqrt(speed),
    }
  },
  step(g, input, dt) {
    g.t += dt
    for (let i = 0; i < input.presses.length; i++) {
      const beat = g.beats.find((b) => !b.hit && Math.abs(g.t - b.at) <= g.window)
      if (!beat) return 'lose'
      beat.hit = true
      beat.hitAt = g.t
    }
    if (g.beats.some((b) => !b.hit && g.t > b.at + g.window)) return 'lose'
    return g.beats.every((b) => b.hit) ? 'win' : null
  },
  timeout: 'lose',
}

// STEADY!: press inside the circle and hold there as it drifts and jolts; slip out of it or
// let go and it's lost. It waits a moment for the press, then moves.
export const STEADY = {
  id: 'steady',
  verb: 'STEADY!',
  seconds: 4.5,
  start(rng, speed) {
    const jolts = []
    for (let t = (0.6 + 0.4 * rng()) / speed; t < this.seconds / speed; t += (0.7 + 0.6 * rng()) / speed) {
      const angle = rng() * Math.PI * 2
      jolts.push([t, 0.07 * Math.cos(angle), 0.07 * Math.sin(angle)])
    }
    return {
      t: 0, since: null, // when it was pressed
      x: 0.5, y: 0.5,
      radius: 0.13 / Math.pow(speed, 0.3),
      wait: 1 / Math.sqrt(speed),
      drift: [[0.2, 1.3 * speed, rng() * Math.PI * 2], [0.2, 1.7 * speed, rng() * Math.PI * 2]],
      jolts,
    }
  },
  // Where the circle is, `s` seconds after the press: a drift, plus jolts that ease in fast.
  place(g, s) {
    const [[ax, wx, px], [ay, wy, py]] = g.drift
    let x = 0.5 + ax * (Math.sin(wx * s + px) - Math.sin(px))
    let y = 0.5 + ay * (Math.sin(wy * s + py) - Math.sin(py))
    for (const [at, dx, dy] of g.jolts) {
      const k = Math.min(1, Math.max(0, (s - at) / 0.12))
      x += dx * k
      y += dy * k
    }
    return [Math.min(0.9, Math.max(0.1, x)), Math.min(0.9, Math.max(0.1, y))]
  },
  step(g, input, dt) {
    g.t += dt
    if (g.since === null) {
      if (input.presses.some((p) => Math.hypot(p.x - g.x, p.y - g.y) <= g.radius)) g.since = g.t
      return g.t > g.wait ? 'lose' : null
    }
    ;[g.x, g.y] = this.place(g, g.t - g.since)
    if (!input.down || Math.hypot(input.x - g.x, input.y - g.y) > g.radius) return 'lose'
    return null
  },
  timeout: 'win',
}

// DODGE!: spikes fall, some right at you; hold and drag sideways to stay clear of them.
export const DODGE_Y = 0.86 // where you are
export const DODGE_REACH = 0.07 // how close a spike's middle can pass
export const DODGE = {
  id: 'dodge',
  verb: 'DODGE!',
  seconds: 4.5,
  start(rng, speed) {
    const spikes = []
    for (let t = 0.25; t < this.seconds / speed - 0.5; t += (0.42 + 0.2 * rng()) / Math.pow(speed, 0.8)) {
      // Every other one at you (or near): standing still won't do.
      spikes.push({ t, aim: spikes.length % 2 === 0, roll: rng() })
    }
    return { t: 0, x: 0.5, fall: 0.75 * speed, spikes, next: 0, falling: [] }
  },
  step(g, input, dt) {
    g.t += dt
    if (input.down) g.x = Math.min(0.94, Math.max(0.06, input.x))
    while (g.next < g.spikes.length && g.spikes[g.next].t <= g.t) {
      const { aim, roll } = g.spikes[g.next++]
      const x = aim ? g.x + (roll - 0.5) * 0.2 : 0.08 + 0.84 * roll
      g.falling.push({ x: Math.min(0.94, Math.max(0.06, x)), y: -0.05 })
    }
    for (const spike of g.falling) {
      spike.y += g.fall * dt
      if (Math.abs(spike.y - DODGE_Y) < 0.04 && Math.abs(spike.x - g.x) < DODGE_REACH) return 'lose'
    }
    g.falling = g.falling.filter((spike) => spike.y < 1.1)
    return null
  },
  timeout: 'win',
}

export const GAMES = [CLENCH, PUSH, SEAL, BALANCE, HOLD, MATCH, STOP, RELEASE, PULSE, STEADY, DODGE]
