import { DRINKS } from './drinks'
import { cough, fillRatioOf, ingestBeverage, resetOrgan, SANDBOX_RULES, stepSim } from './sim'

// Arcade mode, the default: an endless hold on top of the same simulation. The game
// serves drinks, announces every urge wave and (from level 2) every sneeze, and gets
// harder every 30 s. The bladder has no limit (requested): it keeps filling past full,
// but past full it feels no fuller, so the run lasts as long as the clench holds out. Points come from holding (more the fuller you are), from clenching
// on time — as the wave lands, which calms it at once — and from bracing for sneezes.
// Emptying the bladder banks the score; a total failure ends the run.

export const ARCADE_RULES = {
  urgeWarningTime: 1.2,
  urgeStrength: 1,
  urgeIntervalScale: 1,
  urgeSuppressRate: 0.7,
  kegelReliefRate: 0.1,
  clenchGuard: 0.25,
  idleClenchCost: 3, // clenching with nothing to hold back wastes stamina...
  idleRelief: 0, // ...and eases no strain
  clenchLockout: 0.3, // after giving out, the clench needs 30 % stamina back
  leakGraceTime: 0.6, // at 100 % strain there's a moment to clench before it leaks
  sootheCooldownTime: 20,
  volumeCap: Infinity, // it never runs out of room...
  fullAt: 1, // ...and past full, pressure and urgency hold at full's
}

const START_ML = 300
const LEVEL_SECONDS = 30
const HOLD_POINTS = 10 // per second, times the fill multiplier
// A clench pressed during the warning, or this soon after the wave lands, is on time.
const PERFECT_LATE = 0.35
const PERFECT_POINTS = 50 // times the combo
const MAX_COMBO_BONUS = 10 // the combo multiplies points up to this
const PERFECT_STAMINA = 0.15 // refunded on a perfect clench
const GOOD_POINTS = 20
const BRACED_POINTS = 40 // times the combo
const SAVED_POINTS = 30 // clenched during the leak grace
const LEAK_PENALTY = 100
const DRINK_BONUS = 0.5 // points per ml the player chooses to drink
const SNEEZE_WARNING = 1.0
const FIRST_SNEEZE_LEVEL = 2

export const fillMultiplier = (fillRatio) => (fillRatio >= 1 ? 5 : fillRatio >= 0.75 ? 3 : fillRatio >= 0.5 ? 2 : 1)

// Bigger drinks come later in the run.
const MENUS = [['water', 'coffee'], ['water', 'coffee', 'soda'], ['water', 'coffee', 'soda', 'beer']]
const menuFor = (level) => MENUS[Math.min(MENUS.length - 1, Math.floor((level - 1) / 2))]
const serveInterval = (level) => Math.max(12, 26 - 1.5 * (level - 1))
const sneezeInterval = (level, rng) => (12 + rng() * 10) * Math.max(0.6, 1 - 0.05 * (level - FIRST_SNEEZE_LEVEL))

// Each level: stronger, more frequent urges that take longer to calm, announced later,
// and a pelvic floor that tires: holding eases less strain and the brace lets more through.
function applyLevel(sim, level) {
  const up = level - 1
  sim.urgeStrength = Math.min(1.8, 1 + 0.1 * up)
  sim.urgeIntervalScale = Math.max(0.5, 1 - 0.06 * up)
  sim.urgeSuppressRate = ARCADE_RULES.urgeSuppressRate * Math.max(0.35, 1 - 0.07 * up)
  sim.urgeWarningTime = Math.max(0.6, ARCADE_RULES.urgeWarningTime - 0.06 * up)
  sim.kegelReliefRate = ARCADE_RULES.kegelReliefRate * Math.max(0.3, 1 - 0.08 * up)
  sim.clenchGuard = ARCADE_RULES.clenchGuard + Math.min(0.25, 0.025 * up)
}

export function startArcadeRun(sim, out, rng = Math.random) {
  resetOrgan(sim, out, rng, { silent: true })
  Object.assign(sim, ARCADE_RULES)
  sim.volume = START_ML
  sim.urgeWaveTimer = 8
  sim.activeChallenge = 'arcade'
  sim.arcade = {
    time: 0, score: 0, level: 1, combo: 0, bestCombo: 0, perfects: 0, leaks: 0,
    serveTimer: 8, sneezeTimer: 6, perfectArmed: false,
  }
  applyLevel(sim, 1)
  out.push({ type: 'challengeStart', challenge: 'arcade' })
}

// Leaves the run without a result (the player switched to the sandbox).
export function quitArcadeRun(sim, out) {
  if (!sim.arcade) return
  endRules(sim)
  out.push({ type: 'arcadeQuit' })
}

function endRules(sim) {
  sim.arcade = null
  sim.activeChallenge = null
  sim.coughWarned = false
  Object.assign(sim, SANDBOX_RULES)
}

function endRun(sim, out, banked) {
  const a = sim.arcade
  out.push({
    type: 'challengeResult', challenge: 'arcade', success: banked,
    score: Math.round(a.score), seconds: Math.round(a.time), leaks: a.leaks, bestCombo: a.bestCombo,
  })
  endRules(sim)
}

function award(sim, out, reason, points) {
  const a = sim.arcade
  a.score = Math.max(0, a.score + points)
  a.bestCombo = Math.max(a.bestCombo, a.combo)
  out.push({ type: 'arcadePoints', reason, points, combo: a.combo })
}

// Timers, served drinks, sneezes and holding points; runs before the simulation step.
function stepArcade(sim, dt, out, rng) {
  const a = sim.arcade
  a.time += dt
  const level = 1 + Math.floor(a.time / LEVEL_SECONDS)
  if (level !== a.level) {
    a.level = level
    applyLevel(sim, level)
    out.push({ type: 'arcadeLevel', level })
  }

  if (!sim.isStressLeaking && !sim.involuntaryVoiding) {
    a.score += HOLD_POINTS * fillMultiplier(fillRatioOf(sim)) * dt
  }

  a.serveTimer -= dt
  if (a.serveTimer <= 0) {
    const menu = menuFor(level)
    ingestBeverage(sim, out, menu[Math.floor(rng() * menu.length)], rng, { served: true })
    a.serveTimer = serveInterval(level)
  }

  if (level >= FIRST_SNEEZE_LEVEL) {
    a.sneezeTimer -= dt
    if (!sim.coughWarned && a.sneezeTimer <= SNEEZE_WARNING) {
      sim.coughWarned = true
      out.push({ type: 'sneezeWarning' })
    }
    if (a.sneezeTimer <= 0) {
      const braced = sim.isClenching
      sim.coughWarned = false
      cough(sim, out, rng)
      if (braced) {
        a.combo += 1
        award(sim, out, 'braced', BRACED_POINTS * Math.min(a.combo, MAX_COMBO_BONUS))
      } else {
        a.combo = 0
        award(sim, out, 'unbraced', 0)
      }
      a.sneezeTimer = sneezeInterval(level, rng)
    }
  }
}

// Scores the events from `from` on: clench timing, waves, leaks, drinks, banking.
export function scoreArcade(sim, out, from = 0) {
  for (let i = from; i < out.length && sim.arcade; i++) {
    const e = out[i]
    const a = sim.arcade
    switch (e.type) {
      case 'clenchStart':
        a.perfectArmed = sim.urgeWarned || (sim.isUrgeWaveActive && sim.urgeWaveAge <= PERFECT_LATE)
        break
      case 'clenchStop':
      case 'clenchExhausted':
        a.perfectArmed = false
        break
      case 'urgeEnd':
        if (!e.suppressed) {
          a.combo = 0
          award(sim, out, 'missed', 0)
        } else if (a.perfectArmed) {
          a.combo += 1
          a.perfects += 1
          sim.kegelStamina = Math.min(1, sim.kegelStamina + PERFECT_STAMINA)
          award(sim, out, 'perfect', PERFECT_POINTS * Math.min(a.combo, MAX_COMBO_BONUS))
        } else {
          award(sim, out, 'good', GOOD_POINTS)
        }
        a.perfectArmed = false
        break
      case 'leakStart':
        a.leaks += 1
        a.combo = 0
        award(sim, out, 'leak', -LEAK_PENALTY)
        break
      case 'leakSaved':
        award(sim, out, 'saved', SAVED_POINTS)
        break
      case 'ingest':
        if (!e.served) award(sim, out, 'drink', Math.round(DRINKS[e.beverage].vol * DRINK_BONUS))
        break
      case 'voidStart':
        award(sim, out, 'bank', Math.round(sim.volume * fillMultiplier(fillRatioOf(sim))))
        endRun(sim, out, true)
        break
      case 'failureStart':
        endRun(sim, out, false)
        break
    }
  }
}

// One frame of the game: the simulation, plus the arcade's rules while a run is on.
export function stepGame(sim, dt, out, rng = Math.random) {
  const from = out.length
  if (sim.arcade && dt > 0) stepArcade(sim, dt, out, rng)
  stepSim(sim, dt, out, rng)
  if (sim.arcade) scoreArcade(sim, out, from)
}
