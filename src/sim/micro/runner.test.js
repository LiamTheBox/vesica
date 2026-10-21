import { describe, expect, it } from 'vitest'
import { createSimState, SANDBOX_RULES } from '../sim'
import { stepGame } from '../arcade'
import {
  BOSS_EVERY, BOSS_GAMES, FILL_PER_GAME, LEVEL_EVERY, MAX_LIVES, microPointer, PROMPT_SECONDS, quitMicroRun,
  RESULT_SECONDS, speedAt, START_ML, startMicroRun,
} from './runner'
import { DT, seeded } from '../../test/micro'

// Stand-in games: won by a press during play, lost when the fuse runs out.
const pressGame = (id) => ({
  id, verb: `${id.toUpperCase()}!`, seconds: 2,
  start: () => ({}),
  step: (g, input) => (input.presses.length > 0 ? 'win' : null),
  timeout: 'lose',
})
const FAKES = ['a', 'b', 'c', 'd'].map(pressGame)

function newRun() {
  const sim = createSimState()
  sim.baseDrip = 0
  const out = []
  startMicroRun(sim, out, seeded(7), { games: FAKES })
  return { sim, out }
}

const types = (events) => events.map((e) => e.type)

// Steps the game for up to `seconds`. `wins(n, bossGame)` says whether to win the nth game
// played (in a boss, its bossGame-th game) with a press on its first frame of play, or let its
// fuse run out. Stops when `until` says so.
function run(sim, seconds, { wins = () => true, until } = {}) {
  const events = []
  const rng = seeded(3)
  let pressed = null
  for (let t = 0; t < seconds; t += DT) {
    const live = sim.micro
    if (live) {
      const playing = live.phase === 'play'
      const key = playing ? `${live.played}:${live.boss?.index ?? 0}` : null
      const press = playing && pressed !== key && wins(live.played, live.boss?.index)
      microPointer(sim, press)
      if (press) pressed = key
    }
    stepGame(sim, DT, events, rng)
    if (until?.(sim, events)) break
  }
  return events
}

describe('microgames run (M8)', () => {
  it('starts with four lives at 300 ml, with no urges, sneezes or drinks of its own', () => {
    const { sim, out } = newRun()
    expect(types(out)).toEqual(expect.arrayContaining(['challengeStart', 'microPrompt']))
    expect(sim.micro).toMatchObject({ lives: MAX_LIVES, score: 0, level: 1, phase: 'prompt' })
    expect(sim).toMatchObject({ activeChallenge: 'micro', volume: START_ML, volumeCap: Infinity, fullAt: 1 })
    sim.volume = 700
    const events = run(sim, 60)
    expect(types(events)).not.toContain('urgeStart')
    expect(types(events)).not.toContain('urgeWarning')
    expect(types(events)).not.toContain('cough')
    expect(types(events)).not.toContain('ingest')
  })

  it('shows the verb, then plays against the fuse, then shows the result, then deals another game', () => {
    const { sim } = newRun()
    const first = sim.micro.game.id
    run(sim, PROMPT_SECONDS - 0.05, { wins: () => false })
    expect(sim.micro.phase).toBe('prompt')
    let events = run(sim, 0.1, { wins: () => false })
    expect(sim.micro.phase).toBe('play')
    expect(sim.micro.duration).toBeCloseTo(2, 6)
    events = run(sim, 0.1)
    expect(types(events)).toContain('microWin')
    expect(sim.micro).toMatchObject({ phase: 'result', won: true, score: 1, played: 1 })
    events = run(sim, RESULT_SECONDS + 0.05, { wins: () => false })
    expect(types(events)).toContain('microPrompt')
    expect(sim.micro.game.id).not.toBe(first)
  })

  it("doesn't count a press made before play starts", () => {
    const { sim } = newRun()
    microPointer(sim, true) // held down through the verb...
    const events = run(sim, 3, { wins: () => false, until: (s, e) => types(e).includes('microLose') })
    expect(types(events)).toContain('microLose') // ...is no press during play
  })

  it('a lost game costs a life: a small leak, and the sphincter strains a quarter more', () => {
    const { sim } = newRun()
    const events = run(sim, 4, { wins: () => false, until: (s, e) => types(e).includes('microLose') })
    expect(types(events)).toEqual(expect.arrayContaining(['microLose', 'leakStart']))
    expect(sim.micro.lives).toBe(MAX_LIVES - 1)
    expect(sim.sphincterToneStrain).toBeCloseTo(0.25, 9)
    expect(sim.isStressLeaking).toBe(true)
    const after = run(sim, 2, { wins: () => false, until: (s, e) => types(e).includes('leakEnd') })
    expect(types(after)).toContain('leakEnd')
    expect(sim.totalLeakedVolume).toBeGreaterThanOrEqual(10)
    expect(sim.totalLeakedVolume).toBeLessThanOrEqual(15.5)
  })

  it('out of lives, the sphincter gives way and the run ends with its score', () => {
    const { sim } = newRun()
    const events = run(sim, 60, { wins: (n) => n < 3, until: (s) => !s.micro })
    expect(types(events).filter((t) => t === 'microLose')).toHaveLength(MAX_LIVES)
    expect(types(events)).toEqual(expect.arrayContaining(['failureStart', 'challengeResult']))
    expect(events.find((e) => e.type === 'challengeResult')).toMatchObject({ challenge: 'micro', score: 3, level: 2 })
    expect(sim).toMatchObject({ micro: null, involuntaryVoiding: true, activeChallenge: null, ...SANDBOX_RULES })
  })

  it('fills a little every game, and speeds up every few', () => {
    const { sim } = newRun()
    const events = run(sim, 120, { until: (s) => s.micro.played >= 2 * LEVEL_EVERY })
    expect(sim.volume).toBeCloseTo(START_ML + 2 * LEVEL_EVERY * FILL_PER_GAME, 6)
    expect(events.filter((e) => e.type === 'microLevel').map((e) => e.level)).toEqual([2, 3])
    run(sim, 2, { until: (s) => s.micro.phase === 'play' })
    expect(sim.micro.speed).toBeCloseTo(speedAt(3), 9)
    expect(sim.micro.duration).toBeCloseTo(2 / speedAt(3) < 1.8 ? 1.8 : 2 / speedAt(3), 6)
  })

  it('every 15th game is a boss: three games back to back; winning it gives a life back', () => {
    const { sim } = newRun()
    // Lose the first game, win the rest up to the boss.
    run(sim, 300, { wins: (n) => n > 0, until: (s) => s.micro.played === BOSS_EVERY - 1 && s.micro.phase === 'result' })
    expect(sim.micro.lives).toBe(MAX_LIVES - 1)
    const events = run(sim, 60, { until: (s, e) => types(e).includes('microBoss') })
    expect(types(events)[0]).toBe('microBossStart')
    const prompts = events.filter((e) => e.type === 'microPrompt')
    expect(prompts).toHaveLength(BOSS_GAMES)
    expect(prompts.every((e) => e.boss)).toBe(true)
    expect(new Set(prompts.map((e) => e.game)).size).toBe(BOSS_GAMES)
    expect(events.find((e) => e.type === 'microBoss')).toMatchObject({ won: true })
    expect(sim.micro).toMatchObject({ lives: MAX_LIVES, played: BOSS_EVERY, score: BOSS_EVERY - 1 + BOSS_GAMES - 1 })
  })

  it('a lost boss game ends the boss and costs a life', () => {
    const { sim } = newRun()
    run(sim, 300, { until: (s) => s.micro.played === BOSS_EVERY - 1 && s.micro.phase === 'result' })
    const events = run(sim, 60, {
      wins: (n, bossGame) => bossGame === 0, // win its first game, then let the second go
      until: (s, e) => types(e).includes('microBoss'),
    })
    expect(events.find((e) => e.type === 'microBoss')).toMatchObject({ won: false })
    expect(sim.micro.lives).toBe(MAX_LIVES - 1)
  })

  it('waits while paused, and quitting ends it without a result', () => {
    const { sim } = newRun()
    sim.micro.paused = true
    const before = { ...sim.micro }
    run(sim, 5)
    expect(sim.micro).toMatchObject({ phase: before.phase, t: before.t, played: 0 })
    const out = []
    quitMicroRun(sim, out)
    expect(types(out)).toEqual(['microQuit'])
    expect(sim).toMatchObject({ micro: null, activeChallenge: null, ...SANDBOX_RULES })
  })
})
