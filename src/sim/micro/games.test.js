import { describe, expect, it } from 'vitest'
import {
  BALANCE, CLENCH, GAMES, heightFor, HOLD, HOLD_BAND, HOLD_SQUEEZE, MATCH, MATCH_OPEN, MATCH_SHUT, PUSH, RELEASE, SEAL, STOP, STOP_CLOSE,
} from './games'
import { DT, play } from '../../test/micro'

const SPEEDS = [1, 1.6, 2.2]
const SEEDS = [1, 2, 3, 4, 5]

// Every game, at every speed, with every set of rolls.
const everyRound = (test) => {
  for (const speed of SPEEDS) for (const seed of SEEDS) test(speed, seed)
}

describe('the microgames (M8)', () => {
  it('each has a one-word verb, a length and its rules', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length)
    for (const game of GAMES) {
      expect(game.verb).toMatch(/^[A-Z]+!$/)
      expect(game.seconds).toBeGreaterThan(2)
      expect(['win', 'lose']).toContain(game.timeout)
    }
  })

  it('CLENCH!: a press as each pulse reaches the ring wins; too early, or none, loses', () => {
    // Pressed for a frame when the next pulse is about to be in the ring.
    const onTime = (g) => {
      const next = g.pulses.find((p) => !p.caught)
      return { down: !!next && Math.abs(g.t + DT - next.arrive) < DT / 2 + 1e-9 }
    }
    everyRound((speed, seed) => {
      expect(play(CLENCH, { speed, seed, control: onTime })).toBe('win')
      expect(play(CLENCH, { speed, seed })).toBe('lose')
      expect(play(CLENCH, { speed, seed, control: (g) => ({ down: g.t > 0.05 && g.t < 0.1 }) })).toBe('lose')
    })
  })

  it('PUSH!: tapping fast keeps the pressure down; not tapping lets it reach the top', () => {
    let frame = 0
    const tenASecond = () => ({ down: frame++ % 6 < 3 })
    everyRound((speed, seed) => {
      expect(play(PUSH, { speed, seed, control: tenASecond })).toBe('win')
      expect(play(PUSH, { speed, seed })).toBe('lose')
    })
  })

  it('SEAL!: tapping each crack as it shows wins; missing them loses', () => {
    let tapped = false
    const tapNext = (g) => {
      const crack = g.cracks.find((c) => !c.sealed && g.t >= c.at)
      tapped = !tapped && !!crack
      return crack && tapped ? { down: true, x: crack.x + 0.04, y: crack.y - 0.03 } : { down: false }
    }
    everyRound((speed, seed) => {
      expect(play(SEAL, { speed, seed, control: tapNext })).toBe('win')
      expect(play(SEAL, { speed, seed })).toBe('lose')
      // Taps in the middle of the ring don't reach the cracks on it.
      let toggle = false
      expect(play(SEAL, { speed, seed, control: () => ({ down: (toggle = !toggle), x: 0.5, y: 0.5 }) })).toBe('lose')
    })
  })

  it('BALANCE!: holding and pulling against the tip keeps it up; letting go, it falls', () => {
    // Pull the top back toward upright, harder the further and faster it's going.
    const steady = (g) => ({ down: true, x: 0.5 - Math.max(-1, Math.min(1, 1.5 * g.angle + 0.4 * g.spin)) / 2 })
    everyRound((speed, seed) => {
      expect(play(BALANCE, { speed, seed, control: steady })).toBe('win')
      expect(play(BALANCE, { speed, seed })).toBe('lose')
      // Dragging is only felt while pressed.
      expect(play(BALANCE, { speed, seed, control: (g) => ({ ...steady(g), down: false }) })).toBe('lose')
    })
  })

  it('HOLD!: squeezing just enough keeps the needle in the band; none, or all the way, loses', () => {
    // Squeeze for the steady rise, plus more the higher the needle is.
    const steady = (g) => {
      const squeeze = Math.max(0, Math.min(1, g.rise / HOLD_SQUEEZE + 6 * (g.needle - (HOLD_BAND - g.half / 3))))
      return { down: true, y: heightFor(squeeze) }
    }
    everyRound((speed, seed) => {
      expect(play(HOLD, { speed, seed, control: steady })).toBe('win')
      expect(play(HOLD, { speed, seed })).toBe('lose')
      expect(play(HOLD, { speed, seed, control: () => ({ down: true, y: 0 }) })).toBe('lose')
    })
  })

  it('MATCH!: squeezing to the target ring as it changes wins; not squeezing loses', () => {
    const follow = (g) => ({ down: true, y: heightFor((MATCH_OPEN - MATCH.target(g, g.t + DT)) / (MATCH_OPEN - MATCH_SHUT)) })
    everyRound((speed, seed) => {
      expect(play(MATCH, { speed, seed, control: follow })).toBe('win')
      expect(play(MATCH, { speed, seed })).toBe('lose')
    })
  })

  it('STOP!: shutting it in time for the run-on to land in the band wins; too soon or never loses', () => {
    const timed = (g) => ({ down: g.level + (g.flow * STOP_CLOSE) / 2 >= g.low + g.width / 2 })
    everyRound((speed, seed) => {
      expect(play(STOP, { speed, seed, control: timed })).toBe('win')
      expect(play(STOP, { speed, seed, control: (g) => ({ down: g.t > 0.1 }) })).toBe('lose')
      expect(play(STOP, { speed, seed })).toBe('lose')
    })
  })

  it('RELEASE!: holding through the spike and letting go just after wins; anything else loses', () => {
    const through = (g) => ({ down: g.t + DT < g.end + g.window / 2 })
    everyRound((speed, seed) => {
      expect(play(RELEASE, { speed, seed, control: through })).toBe('win')
      expect(play(RELEASE, { speed, seed })).toBe('lose') // never held
      expect(play(RELEASE, { speed, seed, control: () => ({ down: true }) })).toBe('lose') // never let go
      // Let go while it's on.
      expect(play(RELEASE, { speed, seed, control: (g) => ({ down: g.t + DT < g.begin + g.rise + g.stay / 2 }) })).toBe('lose')
    })
  })
})
