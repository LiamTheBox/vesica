import { resetOrgan, restoreSandboxRules } from '../sim'
import { GAMES } from './games'

// Microgames mode (M8), WarioWare-style: a one-word verb, a few seconds of play against a
// fuse, the result, the next game. Four lives; faster every few games; every 15th is a boss,
// three games back to back. The bladder is the stakes: each game is a spike it survives if
// you win; lose, and a life goes as a small leak, the sphincter straining a quarter more
// each time, until out of lives it gives way and the run ends. It fills a little every game,
// with no limit, as in the arcade. A run has no urges, sneezes or served drinks of its own.

export const MAX_LIVES = 4
export const LEVEL_EVERY = 5 // games per speed-up
export const BOSS_EVERY = 15 // every 15th game is a boss
export const BOSS_GAMES = 3
const SPEED_STEP = 0.12
export const MAX_SPEED = 2.2
const BOSS_SPEED = 0.15 // a boss plays this much faster
export const PROMPT_SECONDS = 0.85 // the verb, before play (shorter as it speeds up)
const BOSS_INTRO_SECONDS = 1.1
const SUB_PROMPT_SECONDS = 0.5 // each verb within a boss
export const RESULT_SECONDS = 0.95
const MIN_PLAY_SECONDS = 1.8
export const START_ML = 300
export const FILL_PER_GAME = 20
const LEAK_ML = 10 // a lost game's leak, up to half as much again
export const MICRO_RULES = { urgeIntervalScale: Infinity, volumeCap: Infinity, fullAt: 1 }

export const speedAt = (level) => Math.min(MAX_SPEED, 1 + SPEED_STEP * (level - 1))

// `games`: which microgames to deal from (tests pass their own).
export function startMicroRun(sim, out, rng = Math.random, { games = GAMES } = {}) {
  resetOrgan(sim, out, rng)
  Object.assign(sim, MICRO_RULES)
  sim.volume = START_ML
  sim.urgeWaveTimer = Infinity
  sim.activeChallenge = 'micro'
  sim.micro = {
    games,
    phase: 'prompt', // 'boss' (the boss's title) → 'prompt' → 'play' → 'result'
    t: 0, // seconds into the phase
    duration: 0, // of the phase
    lives: MAX_LIVES,
    score: 0, // games cleared (each of a boss's three counts)
    played: 0, // games played, a boss counting once
    level: 1,
    time: 0, // seconds the run has been going
    game: null, // the game's definition
    g: null, // its state
    speed: 1,
    playSeconds: 0,
    won: null, // the last result, while it shows
    boss: null, // { queue: [games], index }
    recent: [], // the last few games' ids
    paused: false,
    input: { x: 0.5, y: 0.5, down: false, presses: [], releases: 0 },
  }
  out.push({ type: 'challengeStart', challenge: 'micro' })
  nextGame(sim, out, rng)
}

// Leaves the run without a result.
export function quitMicroRun(sim, out) {
  if (!sim.micro) return
  sim.micro = null
  restoreSandboxRules(sim)
  out.push({ type: 'microQuit' })
}

// The pointer, from the play area: whether it's down, and its place in the unit square (y
// down; left out for a key press).
export function microPointer(sim, down, x, y) {
  const run = sim.micro
  if (!run) return
  const input = run.input
  if (x !== undefined) {
    input.x = x
    input.y = y
  }
  if (down && !input.down) input.presses.push({ x: input.x, y: input.y })
  else if (!down && input.down) input.releases++
  input.down = down
}

// Any game but the last two played (or those in `exclude`).
function deal(run, rng, exclude = []) {
  const skip = new Set([...run.recent.slice(-2), ...exclude.map((game) => game.id)])
  const pool = run.games.filter((game) => !skip.has(game.id))
  const choices = pool.length > 0 ? pool : run.games
  return choices[Math.floor(rng() * choices.length)]
}

function begin(sim, out, rng, game, promptSeconds) {
  const run = sim.micro
  run.game = game
  run.recent.push(game.id)
  if (run.recent.length > 4) run.recent.shift()
  run.speed = Math.min(MAX_SPEED + BOSS_SPEED, speedAt(run.level) + (run.boss ? BOSS_SPEED : 0))
  run.g = game.start(rng, run.speed)
  run.playSeconds = Math.max(MIN_PLAY_SECONDS, game.seconds / run.speed)
  run.phase = 'prompt'
  run.t = 0
  run.duration = promptSeconds / Math.sqrt(run.speed)
  run.won = null
  out.push({ type: 'microPrompt', game: game.id, boss: !!run.boss })
}

function nextGame(sim, out, rng) {
  const run = sim.micro
  if ((run.played + 1) % BOSS_EVERY === 0) {
    const queue = []
    for (let i = 0; i < BOSS_GAMES; i++) queue.push(deal(run, rng, queue))
    run.boss = { queue, index: 0 }
    run.phase = 'boss'
    run.t = 0
    run.duration = BOSS_INTRO_SECONDS
    run.game = null
    run.won = null
    out.push({ type: 'microBossStart' })
    return
  }
  begin(sim, out, rng, deal(run, rng), PROMPT_SECONDS)
}

function loseLife(sim, out, rng) {
  const run = sim.micro
  run.lives--
  if (run.lives <= 0) return
  // A spurt; one still running just runs a little longer.
  if (!sim.isStressLeaking) sim.stressLeakTargetLoss = 0
  sim.isStressLeaking = true
  sim.stressLeakTargetLoss += LEAK_ML * (1 + 0.5 * rng())
  out.push({ type: 'leakStart' })
}

function resolve(sim, out, rng, won) {
  const run = sim.micro
  out.push({ type: won ? 'microWin' : 'microLose', game: run.game.id })
  if (won) run.score++
  // Inside a boss, a win goes straight on to its next game.
  if (run.boss && won && run.boss.index < BOSS_GAMES - 1) {
    run.boss.index++
    begin(sim, out, rng, run.boss.queue[run.boss.index], SUB_PROMPT_SECONDS)
    return
  }

  run.played++
  sim.volume += FILL_PER_GAME
  if (run.boss) {
    out.push({ type: 'microBoss', won })
    if (won) run.lives = Math.min(MAX_LIVES, run.lives + 1)
    run.boss = null
  }
  if (!won) loseLife(sim, out, rng)
  if (run.lives <= 0) {
    gameOver(sim, out)
    return
  }
  sim.sphincterToneStrain = (MAX_LIVES - run.lives) / MAX_LIVES
  const level = 1 + Math.floor(run.played / LEVEL_EVERY)
  if (level > run.level) {
    run.level = level
    out.push({ type: 'microLevel', level })
  }
  run.phase = 'result'
  run.t = 0
  run.duration = RESULT_SECONDS / Math.sqrt(run.speed)
  run.won = won
}

// Out of lives: the sphincter gives way, and the run is over.
function gameOver(sim, out) {
  const run = sim.micro
  sim.sphincterToneStrain = 1
  sim.isStressLeaking = false
  sim.involuntaryVoiding = true
  out.push({ type: 'failureStart' })
  out.push({
    type: 'challengeResult', challenge: 'micro', success: true,
    score: run.score, level: run.level, seconds: Math.round(run.time),
  })
  sim.micro = null
  restoreSandboxRules(sim)
}

// One frame of the run (stepGame calls it before the simulation step). It waits while paused
// (a sheet is open over the play area).
export function stepMicro(sim, dt, out, rng = Math.random) {
  const run = sim.micro
  const input = run.input
  if (!run.paused) {
    run.time += dt
    run.t += dt
    if (run.phase === 'boss' && run.t >= run.duration) {
      begin(sim, out, rng, run.boss.queue[0], SUB_PROMPT_SECONDS)
    } else if (run.phase === 'prompt' && run.t >= run.duration) {
      run.phase = 'play'
      run.t = 0
      run.duration = run.playSeconds
    } else if (run.phase === 'play') {
      const result = run.game.step(run.g, input, dt) ?? (run.t >= run.duration ? run.game.timeout : null)
      if (result) resolve(sim, out, rng, result === 'win')
    } else if (run.phase === 'result' && run.t >= run.duration) {
      nextGame(sim, out, rng)
    }
  }
  // Presses only count in the frame they happen (and not at all before play starts).
  input.presses.length = 0
  input.releases = 0
}
