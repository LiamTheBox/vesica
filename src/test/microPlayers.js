// Scripted people for the microgames' balance (tools/micro-bots.mjs prints it, games.test.js
// guards it). They know every game's rules, so a real first run goes worse, but they react
// late, tap off the beat, aim a little wide, and now and then lapse.

import { DODGE_Y, GAMES, heightFor, HOLD_BAND, HOLD_SQUEEZE, MATCH, MATCH_OPEN, MATCH_SHUT, STOP_CLOSE } from '../sim/micro/games'
import { MIN_PLAY_SECONDS, microPointer, startMicroRun, stepMicro } from '../sim/micro/runner'
import { createSimState } from '../sim/sim'
import { DT, seeded } from './micro'

// orient: seconds into play before they act at all; lag: seeing to moving; timing: spread of a
// timed tap, touch latency included; aim: spread of a tap's place; tap: taps a second; reach:
// finger speed, in play areas a second; predict: how much of a smooth motion they lead;
// tremor: the finger's shake; lapse: share of rounds they misread the word or look away.
export const PEOPLE = {
  casual: { orient: 0.45, lag: 0.3, timing: 0.085, aim: 0.035, tap: 5, reach: 2.2, predict: 0.4, tremor: 0.02, lapse: 0.1 },
  typical: { orient: 0.3, lag: 0.23, timing: 0.06, aim: 0.025, tap: 6.5, reach: 3, predict: 0.6, tremor: 0.012, lapse: 0.06 },
  sharp: { orient: 0.18, lag: 0.17, timing: 0.04, aim: 0.015, tap: 8, reach: 4, predict: 0.8, tremor: 0.008, lapse: 0.03 },
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())

// What a value was `seconds` ago: what they're seeing now.
const delay = (seconds) => {
  const seen = []
  return (t, value) => {
    seen.push([t, value])
    while (seen.length > 1 && seen[1][0] <= t - seconds) seen.shift()
    return seen[0][1]
  }
}

// A finger: limited speed, a slight shake.
function finger(person, rng, x = 0.5, y = 0.5) {
  let shakeX = 0, shakeY = 0
  return {
    place(toX, toY) {
      x = toX
      y = toY
    },
    to(toX, toY, dt) {
      const dx = toX - x, dy = toY - y, distance = Math.hypot(dx, dy), step = person.reach * dt
      if (distance <= step) {
        x = toX
        y = toY
      } else {
        x += (dx / distance) * step
        y += (dy / distance) * step
      }
      shakeX += (gauss(rng) * person.tremor - shakeX) * 0.2
      shakeY += (gauss(rng) * person.tremor - shakeY) * 0.2
    },
    get x() { return x + shakeX },
    get y() { return y + shakeY },
  }
}

// One per game: given a round and a person, a function from (seconds into play, dt) to the
// pointer for the next frame.
const PLAYERS = {
  clench(g, person, rng) {
    const at = g.pulses.map((pulse) => pulse.arrive + 0.01 + gauss(rng) * person.timing)
    let i = 0
    return (t) => {
      if (i >= at.length || t + DT < at[i]) return { down: false }
      i++
      return { down: true }
    }
  },
  push(g, person, rng) {
    let next = person.orient
    return (t) => {
      if (t < next || g.level <= 0.15) return { down: false }
      next = t + (0.85 + 0.3 * rng()) / person.tap
      return { down: true }
    }
  },
  seal(g, person, rng) {
    let target = null, tapAt = 0, lastX = 0.5, lastY = 0.5, lift = false
    return (t) => {
      if (lift) {
        lift = false
        return { down: false }
      }
      if (target?.sealed) target = null
      if (target && t >= tapAt) {
        lastX = target.x + gauss(rng) * person.aim
        lastY = target.y + gauss(rng) * person.aim
        target = null
        lift = true
        return { down: true, x: lastX, y: lastY }
      }
      if (!target && t >= person.orient) {
        const crack = g.cracks.filter((c) => !c.sealed && t - c.at >= person.lag * 0.8).sort((a, b) => a.at - b.at)[0]
        if (crack) {
          target = crack
          tapAt = t + 0.1 + Math.hypot(crack.x - lastX, crack.y - lastY) / person.reach
        }
      }
      return { down: false }
    }
  },
  balance(g, person, rng) {
    const angleSeen = delay(person.lag), spinSeen = delay(person.lag), hand = finger(person, rng)
    return (t, dt) => {
      const angle = angleSeen(t, g.angle), spin = spinSeen(t, g.spin)
      if (t < person.orient) return { down: false }
      hand.to(0.5 - clamp(1.6 * (angle + spin * person.lag * person.predict) + 0.45 * spin, -1, 1) / 2, 0.5, dt)
      return { down: true, x: hand.x, y: hand.y }
    }
  },
  // Keeps the needle low in the band, so a surge stays in it, and learns the steady squeeze.
  hold(g, person, rng) {
    const seen = delay(person.lag)
    let steady = (0.8 * g.rise) / HOLD_SQUEEZE
    const hand = finger(person, rng, 0.5, heightFor(clamp(steady + gauss(rng) * 0.08, 0, 1)))
    return (t, dt) => {
      const needle = seen(t, g.needle)
      if (t < person.orient) return { down: false }
      const error = needle - (HOLD_BAND - g.half * 0.4)
      steady += 0.5 * error * dt
      hand.to(0.5, heightFor(clamp(steady + 3 * error, 0, 1)), dt)
      return { down: true, x: hand.x, y: hand.y }
    }
  },
  match(g, person, rng) {
    const near = delay(person.lag), far = delay(person.lag + 0.08)
    const hand = finger(person, rng, 0.5, heightFor(0.5 + gauss(rng) * 0.1))
    return (t, dt) => {
      const target = MATCH.target(g, t), a = near(t, target), b = far(t, target)
      const lead = a + ((a - b) / 0.08) * person.lag * person.predict
      if (t < person.orient) return { down: false }
      hand.to(0.5, heightFor(clamp((MATCH_OPEN - lead) / (MATCH_OPEN - MATCH_SHUT), 0, 1)), dt)
      return { down: true, x: hand.x, y: hand.y }
    }
  },
  stop(g, person, rng) {
    const runOn = (g.flow * STOP_CLOSE) / 2
    const pressAt = Math.max(person.orient, (g.low + g.width / 2 - runOn * 0.8) / g.flow + gauss(rng) * person.timing * 1.3)
    return (t) => ({ down: t >= pressAt })
  },
  release(g, person, rng) {
    const letGo = g.end + person.lag * 0.8 + gauss(rng) * person.timing * 0.6
    return (t) => ({ down: t >= person.orient && t < letGo })
  },
  pulse(g, person, rng) {
    const at = g.beats.map((beat) => beat.at + gauss(rng) * person.timing)
    let i = 0
    return (t) => {
      if (i >= at.length || t + DT < at[i]) return { down: false }
      i++
      return { down: t >= person.orient }
    }
  },
  steady(g, person, rng) {
    const pressAt = person.orient + 0.12
    const nearX = delay(person.lag), nearY = delay(person.lag), farX = delay(person.lag + 0.1), farY = delay(person.lag + 0.1)
    const hand = finger(person, rng)
    return (t, dt) => {
      if (g.since === null) {
        if (t < pressAt) return { down: false }
        hand.place(g.x + gauss(rng) * person.aim, g.y + gauss(rng) * person.aim)
        return { down: true, x: hand.x, y: hand.y }
      }
      const ax = nearX(t, g.x), ay = nearY(t, g.y), bx = farX(t, g.x), by = farY(t, g.y)
      const lead = person.lag * person.predict
      hand.to(ax + ((ax - bx) / 0.1) * lead, ay + ((ay - by) / 0.1) * lead, dt)
      return { down: true, x: hand.x, y: hand.y }
    }
  },
  // Sidesteps what's about to land, the shortest way that doesn't cross under another.
  dodge(g, person, rng) {
    const CLEAR = 0.14, HORIZON = 0.75
    const hand = finger(person, rng)
    return (t, dt) => {
      if (t < person.orient) return { down: false }
      const seen = g.falling
        .map((spike) => ({ x: spike.x, land: (DODGE_Y - spike.y) / g.fall + person.lag * (1 - person.predict) }))
        .filter((spike) => spike.land < HORIZON && spike.land > -0.05)
      const roomAt = (x) => Math.min(1, ...seen.map((spike) => Math.abs(spike.x - x)))
      let goal = g.x
      if (roomAt(g.x) < CLEAR) {
        let least = Infinity
        for (let x = 0.06; x <= 0.94; x += 0.02) {
          const travel = Math.abs(x - g.x) / person.reach
          const crosses = seen.some((spike) => spike.land < travel + 0.1 && (spike.x - g.x) * (spike.x - x) < 0)
          const room = roomAt(x)
          const cost = Math.abs(x - g.x) + (crosses ? 2 : 0) + (room < CLEAR ? 4 + (CLEAR - room) * 10 : 0)
          if (cost < least) {
            least = cost
            goal = x
          }
        }
      }
      hand.to(goal, DODGE_Y, dt)
      return { down: true, x: hand.x, y: hand.y }
    }
  },
}

// This round's person: how quickly they get going varies, and some rounds they lapse.
function forRound(person, rng) {
  const lapse = rng() < person.lapse
  return {
    ...person,
    orient: person.orient * (0.8 + 0.5 * rng()) + (lapse ? 0.6 : 0),
    lag: person.lag * (lapse ? 1.5 : 1),
    timing: person.timing * (lapse ? 1.8 : 1),
  }
}

// One round of `game` at `speed`: 'win' or 'lose'.
export function playRound(game, person, speed, seed) {
  const rng = seeded(seed)
  const g = game.start(rng, speed)
  const player = PLAYERS[game.id](g, forRound(person, rng), rng)
  const input = { x: 0.5, y: 0.5, down: false, presses: [], releases: 0 }
  const seconds = Math.max(MIN_PLAY_SECONDS, game.seconds / speed)
  for (let t = 0; t < seconds; t += DT) {
    const { down = false, x = input.x, y = input.y } = player(t, DT)
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

// The share of `rounds` won.
export function winRate(game, person, speed, rounds = 200) {
  let wins = 0
  for (let i = 0; i < rounds; i++) if (playRound(game, person, speed, 1000 + i * 7) === 'win') wins++
  return wins / rounds
}

// A whole run, up to `limit` seconds: the games cleared, and how long it lasted.
export function playRun(person, seed, limit = 1800) {
  const sim = createSimState()
  const rng = seeded(seed)
  const out = []
  startMicroRun(sim, out, rng, { games: GAMES })
  let g = null, player = null, t = 0, seconds = 0, cleared = 0
  while (sim.micro && seconds < limit) {
    const run = sim.micro
    cleared = run.score
    let pointer = { down: false }
    if (run.phase === 'play') {
      if (run.g !== g) {
        g = run.g
        t = 0
        player = PLAYERS[run.game.id](g, forRound(person, rng), rng)
      }
      pointer = player(t, DT)
      t += DT
    }
    microPointer(sim, pointer.down, pointer.x, pointer.y)
    stepMicro(sim, DT, out, rng)
    out.length = 0
    seconds += DT
  }
  return { cleared, seconds }
}
