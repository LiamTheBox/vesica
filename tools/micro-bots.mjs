// Plays the microgames headless with scripted people (src/test/microPlayers.js), to check
// their balance after a change to the rules. Prints, for each person, each game's win rate by
// speed, then whole runs: the games cleared (low is the worst tenth, high the best tenth), how
// many reach the first boss, and how long a run lasts (runs stop at 30 minutes).
// Usage: node tools/micro-bots.mjs [rounds=300] [runs=100]
import { register } from 'node:module'

// The app's imports leave off '.js' (Vite adds it); this lets plain Node do the same.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context) } catch (error) {
      if (!specifier.startsWith('.') || specifier.endsWith('.js')) throw error
      return next(specifier + '.js', context)
    }
  }
`))
const { GAMES } = await import('../src/sim/micro/games.js')
const { BOSS_EVERY, LEVEL_EVERY, MAX_SPEED, speedAt } = await import('../src/sim/micro/runner.js')
const { PEOPLE, playRun, winRate } = await import('../src/test/microPlayers.js')

const ROUNDS = Number(process.argv[2] ?? 300)
const RUNS = Number(process.argv[3] ?? 100)
const levelAt = (played) => 1 + Math.floor(played / LEVEL_EVERY)
const SPEEDS = [...new Set([0, 15, 30, 50].map((played) => speedAt(levelAt(played))).concat(MAX_SPEED))]
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)]

for (const [name, person] of Object.entries(PEOPLE)) {
  console.log(`\n${name}: win % by speed`)
  console.log(''.padEnd(10) + SPEEDS.map((speed) => speed.toFixed(2).padStart(6)).join(''))
  const totals = SPEEDS.map(() => 0)
  for (const game of GAMES) {
    const rates = SPEEDS.map((speed, k) => {
      const rate = winRate(game, person, speed, ROUNDS)
      totals[k] += rate
      return rate
    })
    console.log(game.id.padEnd(10) + rates.map((rate) => String(Math.round(rate * 100)).padStart(6)).join(''))
  }
  console.log('average'.padEnd(10) + totals.map((total) => String(Math.round((total / GAMES.length) * 100)).padStart(6)).join(''))
}

console.log('\nwhole runs: games cleared')
console.log(''.padEnd(10) + 'low'.padStart(6) + 'median'.padStart(8) + 'high'.padStart(6) + 'first boss'.padStart(12) + 'minutes'.padStart(9))
for (const [name, person] of Object.entries(PEOPLE)) {
  const runs = Array.from({ length: RUNS }, (_, i) => playRun(person, 5000 + i * 13))
  const cleared = runs.map((run) => run.cleared)
  const boss = cleared.filter((n) => n >= BOSS_EVERY).length / RUNS
  console.log(
    name.padEnd(10) + String(quantile(cleared, 0.1)).padStart(6) + String(quantile(cleared, 0.5)).padStart(8) + String(quantile(cleared, 0.9)).padStart(6)
    + `${Math.round(boss * 100)}%`.padStart(12) + (quantile(runs.map((run) => run.seconds), 0.5) / 60).toFixed(1).padStart(9),
  )
}
