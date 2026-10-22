// Plays the arcade headless with scripted players who react like people (0.2-0.4 s), to
// check its balance after a change to the rules. Prints, for each player, how many runs
// were lost and when, the leaks, saves, slips, clenches that gave out, and the score.
// Usage: node tools/arcade-bots.mjs [runs=20] [minutes=10]   (REACT=0.3 sets the mean reaction, in s)
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
const { createSimState, soothe, startClench, stopClench } = await import('../src/sim/sim.js')
const { scoreArcade, startArcadeRun, stepGame } = await import('../src/sim/arcade.js')

const DT = 1 / 60
const RUNS = Number(process.argv[2] ?? 20)
const MINUTES = Number(process.argv[3] ?? 10)
const REACT = Number(process.env.REACT ?? 0.3)

// onWarning: share of urge warnings it clenches for; onWave: share of the other waves it
// clenches for when they land; onSneeze: share of sneezes it braces for; slips: clenches
// when SLIPPING! shows (for 0.8 s); sootheAt: the strain at which it presses Soothe;
// holder: keeps Clench down for good, pressing again whenever it gives out.
const PLAYERS = {
  never: {},
  slipOnly: { slips: true },
  lazy: { onWarning: 0.25, slips: true },
  late: { onWave: 1, slips: true },
  typical: { onWarning: 0.85, onWave: 0.8, onSneeze: 0.6, slips: true, sootheAt: 0.7 },
  strong: { onWarning: 0.95, onWave: 1, onSneeze: 0.9, slips: true, sootheAt: 0.5 },
  flawless: { onWarning: 1, onWave: 1, onSneeze: 1, slips: true, sootheAt: 0.5 },
  holder: { holder: true },
}

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A player's action, scored the way the engine does it.
function play(sim, events, action) {
  const out = []
  action(sim, out)
  scoreArcade(sim, out)
  events.push(...out)
}

function playRun(player, seed) {
  const rng = seeded(seed)
  const mind = seeded(seed * 7 + 1)
  const react = () => Math.max(0.12, REACT + (mind() - 0.5) * 0.2)
  const sim = createSimState()
  startArcadeRun(sim, [], rng)
  const reasons = new Set() // why it's clenching: wave, sneeze, slip
  const later = [] // [time, fn]
  const at = (time, fn) => later.push([time, fn])
  let nextPress = 0
  const run = { lostAt: null, firstLeak: null, leaks: 0, saves: 0, slips: 0, gaveOut: 0, score: 0 }

  for (let t = 0; t < MINUTES * 60 && sim.arcade; t += DT) {
    for (let i = later.length - 1; i >= 0; i--) {
      if (later[i][0] <= t) { later[i][1](); later.splice(i, 1) }
    }
    const events = []
    const wanted = player.holder || reasons.size > 0
    if (wanted && !sim.isClenching && t >= nextPress) {
      play(sim, events, startClench)
      if (!sim.isClenching) nextPress = t + react() // locked out: tries again
    }
    if (!wanted && sim.isClenching) play(sim, events, stopClench)
    if (player.sootheAt && sim.sphincterToneStrain >= player.sootheAt && sim.sootheCooldown <= 0) play(sim, events, soothe)
    stepGame(sim, DT, events, rng)

    for (const e of events) {
      switch (e.type) {
        case 'urgeWarning':
          if (mind() < (player.onWarning ?? 0)) at(t + react(), () => reasons.add('wave'))
          break
        case 'urgeStart':
          if (!reasons.has('wave') && mind() < (player.onWave ?? 0)) at(t + react(), () => reasons.add('wave'))
          break
        case 'urgeEnd':
          at(t + react() * 0.7, () => reasons.delete('wave'))
          break
        case 'sneezeWarning':
          if (mind() < (player.onSneeze ?? 0)) at(t + react(), () => reasons.add('sneeze'))
          break
        case 'cough':
          at(t + 0.25, () => reasons.delete('sneeze'))
          break
        case 'leakWarning': {
          run.slips++
          if (!player.slips) break
          const r = react()
          at(t + r, () => reasons.add('slip'))
          at(t + r + 0.8, () => reasons.delete('slip'))
          break
        }
        case 'leakSaved': run.saves++; break
        case 'clenchExhausted': run.gaveOut++; nextPress = t + react(); break
        case 'leakStart':
        case 'failureStart': run.leaks++; run.firstLeak ??= t; break
        case 'challengeResult': run.score = e.score; if (!e.success) run.lostAt = t; break
      }
    }
  }
  if (sim.arcade) run.score = Math.round(sim.arcade.score)
  return run
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const spread = (xs) => (xs.length ? `${clock(median(xs))} (${clock(Math.min(...xs))}-${clock(Math.max(...xs))})` : '-')

console.log(`${RUNS} runs each, up to ${MINUTES} min, reacting in ${REACT} s ± 0.1`)
console.log('player     lost   first leak            lost at               leaks  saves  slips  gave out  score')
for (const [name, player] of Object.entries(PLAYERS)) {
  const runs = Array.from({ length: RUNS }, (_, i) => playRun(player, 1000 + i))
  const lost = runs.filter((r) => r.lostAt != null).map((r) => r.lostAt)
  const leaked = runs.filter((r) => r.firstLeak != null).map((r) => r.firstLeak)
  const med = (key) => String(median(runs.map((r) => r[key])))
  console.log([
    name.padEnd(10), `${lost.length}/${RUNS}`.padEnd(6), spread(leaked).padEnd(21), spread(lost).padEnd(21),
    med('leaks').padStart(5), med('saves').padStart(6), med('slips').padStart(6), med('gaveOut').padStart(9), med('score').padStart(7),
  ].join(' '))
}
