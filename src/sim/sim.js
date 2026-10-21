import { PHYSICS_CONFIGS } from '../physics/constants'
import { DRINKS } from './drinks'

// Simulation core, ported from the original single-file game
// (`Vesica 3D Mobile Web App.html`): `updatePhysics()` without the rendering, plus
// the action handlers without DOM/audio. Functions mutate the `sim` object in place
// (like the original) and push side effects — sounds, voice, haptics, UI flashes —
// onto `out` as events, which the feedback layer turns into output.
//
// Every function that needs randomness takes `rng` so tests can be deterministic.
//
// Requested changes to the original's physiology (2026-10-21): the kidneys fill at
// 1 ml / 30 s; the filling pressure rises more steeply; the sphincter tone (strain) is
// the leak gauge: urge waves, coughs, squeezes, pokes and slaps push it up, and leaks
// only start once it reaches 100 %; a held clench calms an urge wave by reflex
// ("freeze and squeeze"); voiding peaks at 20 ml/s and slows as the bladder empties.

const TELEMETRY_LENGTH = 120

const lerp = (a, b, t) => a + (b - a) * t

// What the bladder holds when voiding stops on its own.
const EMPTY_ML = 10

// Urge wave: how long it lasts, and the pressure its full spasm adds.
const URGE_WAVE_SECONDS = 3.5
const URGE_PRESSURE = 24.0
const COUGH_PRESSURE = 38.0

// Sphincter strain per second, at full spasm / cough / squeeze, when the filling pressure
// is 50 cmH2O; it scales with the filling pressure, so the same push strains a full
// bladder's sphincter more. An unclenched wave adds ~29 % at 80 % full, a cough ~14 %.
export const URGE_STRAIN_RATE = 0.09
export const COUGH_STRAIN_RATE = 1.05
export const SQUEEZE_STRAIN_RATE = 0.2
// Leaks start at 100 % strain: a spurt at LEAK_FLOW, or total failure when the pressure
// is above FAILURE_PRESSURE (the original's threshold). After a spurt runs its course the
// sphincter regains some grip.
export const LEAK_FLOW = 12.0
export const FAILURE_PRESSURE = 65.0
export const RESEAL_STRAIN = 0.85
// A clench holding the sphincter at 100 % against more strain burns stamina fast: this
// much per unit of strain it holds back.
export const OVERLOAD_STAMINA = 4.0

// A poke or a slap jolts the pressure for a moment, more the fuller the bladder (taut, it
// has no give): up to this many cmH2O when full, fading in a fraction of a second. It
// doesn't strain the sphincter (pokes and slaps strain it 5 % each, flat; requested), and
// doesn't count toward a total failure.
export const TOUCH_PRESSURE = 12.0
const TOUCH_FADE = 6.0 // per second

// Voiding: a typical adult's peak flow, tapering over the last ~150 ml as the emptying
// bladder's contraction weakens. Voiding eases the strain.
export const PEAK_FLOW = 20.0
const FLOW_TAPER_ML = 150.0
const MIN_FLOW_SHARE = 0.08
export const VOID_RELIEF_RATE = 0.25

// Game rules the arcade changes (see arcade.js); these values leave the simulation as
// the sandbox has it.
export const SANDBOX_RULES = {
  urgeWarningTime: 0, // seconds of warning before an urge wave
  urgeStrength: 1, // peak spasm of a wave
  urgeIntervalScale: 1, // scales the time between waves
  urgeSuppressRate: 0.7, // freeze and squeeze: spasm calmed per second of clench during a wave
  kegelReliefRate: 0.1, // sphincter strain relieved per second of holding (not in the original; requested)
  clenchGuard: 0.25, // a clench braces the sphincter: it takes this share of the strain
  idleClenchCost: 1, // stamina cost of a clench with nothing to hold back
  idleRelief: 1, // share of the strain relief such a clench still gives
  clenchLockout: 0, // stamina needed to clench again after giving out
  leakGraceTime: 0, // seconds at 100 % strain before the leak starts
  sootheCooldownTime: 0, // seconds before Soothe works again
}

export function createSimState() {
  return {
    volume: 120,
    maxCapacity: 750,
    baseDrip: 1 / 30, // ml/s: 1 ml every 30 s (the original's 1 ml/s; requested)
    activeBeverages: [],

    isAttemptingVoid: false,
    voidLatencyTimer: 0.0,
    voidLatencyRequired: 1.0,
    isActivelyVoiding: false,
    involuntaryVoiding: false,
    flowRate: 0,
    totalLeakedVolume: 0,

    isClenching: false,
    clenchExhausted: false,
    kegelStamina: 1.0,
    kegelFatigueRate: 0.11, // half the original's 0.22: a full hold lasts ~9 s (requested)
    kegelRecoverRate: 0.64, // 4x the original's 0.16 (requested)
    sphincterToneStrain: 0.0,
    detrusorSpasmIntensity: 0.0,
    sphincterDilation: 0.0,

    isStressLeaking: false,
    stressLeakTargetLoss: 0,
    leakGrace: 0, // seconds spent at 100 % strain without a clench (arcade grace)

    coughImpulseIntensity: 0.0,
    coughWarned: false, // a cough is on its way (an announced sneeze in the arcade)

    urgeWaveTimer: 18.0,
    isUrgeWaveActive: false,
    urgeWaveDuration: 0.0,
    urgeWaveAge: 0.0,
    urgeWarned: false,

    creakCooldown: 0,
    sootheCooldown: 0,

    pressure: 7.2,
    maxRecordedPressure: 7.2,
    touchPressure: 0, // cmH2O from the latest poke or slap (TOUCH_PRESSURE)
    hydration: 0.85,
    sloshAngleX: 0,
    sloshAngleZ: 0,
    sloshVelX: 0,
    sloshVelZ: 0,
    fluidCoreOffset: { x: 0, y: 0, z: 0 },
    fluidCoreVelocity: { x: 0, y: 0, z: 0 },

    physicsMode: 'jello',
    squeezeAmountY: 0.0,
    targetSqueezeY: 0.0,
    ripples: [],
    jiggleIntensity: 0.0,
    globalJigglePhase: 0.0,

    telemetryHistory: [],

    activeChallenge: null, // 'commute' | 'precision' | 'arcade'
    challengeTimer: 0,
    challengePotholeTimer: 0,
    precisionStartVolume: 0,
    arcade: null, // the arcade run's score and timers (arcade.js)

    ...SANDBOX_RULES,
  }
}

export const physicsOf = (sim) => PHYSICS_CONFIGS[sim.physicsMode]
export const fillRatioOf = (sim) => Math.max(0.01, sim.volume / sim.maxCapacity)

// Pressure from the volume alone: low while the wall stretches, then steep near capacity
// (requested: rises more than the original's 4 + 56·fill^2.6).
export const fillPressure = (fillRatio) => 4.0 + Math.pow(fillRatio, 3.0) * 80.0

// Voiding flow (ml/s) for the volume left and how far the sphincter has opened.
export function voidFlow(volume, dilation) {
  const left = Math.min(1, Math.max(0, volume - EMPTY_ML) / FLOW_TAPER_ML)
  return PEAK_FLOW * dilation * Math.max(MIN_FLOW_SHARE, Math.sqrt(left))
}

// --- Actions ---------------------------------------------------------------

// A poke or slap of `share` of a full one (0..1): its pressure jolt.
export function touchJolt(sim, share) {
  const fill = Math.min(1, fillRatioOf(sim))
  sim.touchPressure = Math.max(sim.touchPressure, TOUCH_PRESSURE * fill * fill * Math.min(1, share))
}

export function impartSloshForce(sim, fx, fz) {
  const dot = sim.sloshVelX * fx + sim.sloshVelZ * fz
  const boost = dot > 0 ? 1.35 : 0.85

  sim.sloshVelX += fx * boost
  sim.sloshVelZ += fz * boost

  sim.fluidCoreVelocity.x += -fx * 0.45
  sim.fluidCoreVelocity.z += -fz * 0.45
}

export function agitate(sim, out, strength = 2.5, rng = Math.random) {
  const phys = physicsOf(sim)
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + strength * 0.4)
  impartSloshForce(sim, (rng() - 0.5) * strength * 3.5, (rng() - 0.5) * strength * 3.5)
  sim.ripples.push({
    center: { x: 0, y: 0, z: 0 },
    radius: 0.1,
    maxRadius: 4.2,
    speed: phys.waveSpeed,
    amplitude: 0.5 * strength,
    decay: phys.rippleDecay,
  })
  out.push({
    type: 'agitation',
    strength,
    speakShaken: strength > 2.0 && sim.volume / sim.maxCapacity > 0.4,
  })
}

// `served`: handed out by the arcade rather than chosen by the player.
export function ingestBeverage(sim, out, type, rng = Math.random, { served = false } = {}) {
  const b = DRINKS[type]
  if (!b) return
  sim.activeBeverages.push({ rem: b.vol, rate: b.rate, hyd: b.hyd })
  impartSloshForce(sim, (rng() - 0.5) * 4.0, (rng() - 0.5) * 4.0)
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + 0.35)
  out.push({ type: 'ingest', beverage: type, served })
}

export function startClench(sim, out) {
  if (sim.kegelStamina <= 0.05 || (sim.clenchExhausted && sim.kegelStamina < sim.clenchLockout)) return
  sim.isClenching = true
  out.push({ type: 'clenchStart' })
}

export function stopClench(sim, out) {
  if (!sim.isClenching) return
  sim.isClenching = false
  out.push({ type: 'clenchStop' })
}

export function startVoidAttempt(sim, out) {
  if (sim.involuntaryVoiding || sim.isClenching) return
  sim.isAttemptingVoid = true
  out.push({ type: 'voidAttemptStart' })
}

export function stopVoidAttempt(sim, out) {
  sim.isAttemptingVoid = false
  sim.voidLatencyTimer = 0

  if (sim.isActivelyVoiding) {
    sim.isActivelyVoiding = false
    out.push({ type: 'voidStop' })

    if (sim.activeChallenge === 'precision') {
      const voided = Math.round(sim.precisionStartVolume - sim.volume)
      out.push({ type: 'challengeResult', challenge: 'precision', success: Math.abs(voided - 200) <= 10, voided })
      sim.activeChallenge = null
    }

    if (sim.volume < 150) out.push({ type: 'voice', category: 'deflated' })
  }
}

export function soothe(sim, out) {
  if (sim.sootheCooldown > 0) return
  sim.sphincterToneStrain = Math.max(0, sim.sphincterToneStrain - 0.35)
  sim.detrusorSpasmIntensity = Math.max(0, sim.detrusorSpasmIntensity - 0.6)
  sim.kegelStamina = Math.min(1.0, sim.kegelStamina + 0.3)
  sim.sootheCooldown = sim.sootheCooldownTime
  sim.ripples.push({ center: { x: 0, y: 0, z: 0 }, radius: 0.1, maxRadius: 3.5, speed: 4.0, amplitude: 0.25, decay: 4.0 })
  out.push({ type: 'soothe' })
}

export function cough(sim, out, rng = Math.random) {
  sim.coughImpulseIntensity = 1.0
  out.push({ type: 'cough' })
  agitate(sim, out, 2.2, rng)
  out.push({ type: 'voice', category: 'cough' })
}

// `silent` skips the "deflated" line, for challenge starts that refill the bladder at once.
// A reset also ends an arcade run and goes back to the sandbox rules.
export function resetOrgan(sim, out, rng = Math.random, { silent = false } = {}) {
  sim.volume = 40
  sim.activeBeverages = []
  sim.isAttemptingVoid = false
  sim.voidLatencyTimer = 0
  sim.isActivelyVoiding = false
  sim.involuntaryVoiding = false
  sim.isStressLeaking = false
  sim.leakGrace = 0
  sim.kegelStamina = 1.0
  sim.sphincterToneStrain = 0
  sim.detrusorSpasmIntensity = 0
  sim.coughImpulseIntensity = 0
  sim.coughWarned = false
  sim.touchPressure = 0
  sim.totalLeakedVolume = 0
  sim.activeChallenge = null
  sim.arcade = null
  Object.assign(sim, SANDBOX_RULES)
  sim.sootheCooldown = 0
  sim.ripples = []
  sim.targetSqueezeY = 0
  sim.squeezeAmountY = 0
  // The original only hid the urge-wave banner here and let the wave run on; end it
  // so the banner (now derived from state) doesn't linger after a reset.
  sim.isUrgeWaveActive = false
  sim.urgeWaveDuration = 0
  sim.urgeWarned = false
  out.push({ type: 'reset' })
  agitate(sim, out, 2.0, rng)
  if (!silent) out.push({ type: 'voice', category: 'deflated' })
}

export function startCommuteChallenge(sim, out, rng = Math.random) {
  resetOrgan(sim, out, rng, { silent: true })
  sim.volume = 580
  sim.totalLeakedVolume = 0
  sim.activeChallenge = 'commute'
  sim.challengeTimer = 60.0
  sim.challengePotholeTimer = 8.0
  out.push({ type: 'challengeStart', challenge: 'commute' })
  agitate(sim, out, 2.0, rng)
}

export function startPrecisionChallenge(sim, out, rng = Math.random) {
  resetOrgan(sim, out, rng, { silent: true })
  sim.volume = 520
  sim.activeChallenge = 'precision'
  sim.precisionStartVolume = 520
  out.push({ type: 'challengeStart', challenge: 'precision' })
}

// --- Per-frame update (original `updatePhysics`, simulation half) ----------

export function stepSim(sim, dt, out, rng = Math.random) {
  if (!(dt > 0)) return
  const phys = physicsOf(sim)

  let extraDrip = 0
  for (let i = sim.activeBeverages.length - 1; i >= 0; i--) {
    const b = sim.activeBeverages[i]
    const step = Math.min(b.rem, b.rate * dt)
    b.rem -= step
    extraDrip += step / dt
    sim.hydration = sim.hydration * 0.98 + b.hyd * 0.02
    if (b.rem <= 0) sim.activeBeverages.splice(i, 1)
  }

  const totalDrip = sim.baseDrip + extraDrip
  sim.volume = Math.min(sim.maxCapacity * 1.25, sim.volume + totalDrip * dt)

  const fillRatio = fillRatioOf(sim)

  sim.squeezeAmountY = lerp(sim.squeezeAmountY, sim.targetSqueezeY, dt * 10.0)

  // Challenge timing
  if (sim.activeChallenge === 'commute') {
    sim.challengeTimer -= dt
    sim.challengePotholeTimer -= dt

    if (sim.challengePotholeTimer <= 0) {
      cough(sim, out, rng) // a heavy road bump
      sim.challengePotholeTimer = 7.0 + rng() * 4.0
    }

    if (sim.challengeTimer <= 0) {
      const leaked = Math.round(sim.totalLeakedVolume)
      out.push({ type: 'challengeResult', challenge: 'commute', success: sim.totalLeakedVolume <= 20, leaked })
      sim.activeChallenge = null
    }
  }

  // Kegel stamina. Holding the Kegel also eases the sphincter's strain, the longer the
  // more (not in the original, which only eased it with Soothe). A clench with nothing to
  // hold back can cost extra (arcade).
  if (sim.isClenching) {
    const idle = !sim.isUrgeWaveActive && !sim.urgeWarned && !sim.coughWarned && sim.coughImpulseIntensity <= 0 &&
      !sim.isStressLeaking && sim.leakGrace <= 0
    sim.kegelStamina = Math.max(0, sim.kegelStamina - sim.kegelFatigueRate * (idle ? sim.idleClenchCost : 1) * dt)
    sim.sphincterToneStrain = Math.max(0, sim.sphincterToneStrain - sim.kegelReliefRate * (idle ? sim.idleRelief : 1) * dt)
    if (sim.kegelStamina <= 0.02) {
      sim.isClenching = false
      sim.clenchExhausted = true
      out.push({ type: 'clenchExhausted' })
    }
  } else {
    sim.kegelStamina = Math.min(1.0, sim.kegelStamina + sim.kegelRecoverRate * dt)
    if (sim.kegelStamina > Math.max(0.15, sim.clenchLockout)) sim.clenchExhausted = false
  }

  if (sim.coughImpulseIntensity > 0) {
    sim.coughImpulseIntensity = Math.max(0, sim.coughImpulseIntensity - dt * 3.5)
  }

  // Urge waves. The arcade announces each one `urgeWarningTime` ahead.
  sim.urgeWaveTimer -= dt
  const urgeReady = fillRatio > 0.45 && !sim.isActivelyVoiding && !sim.isUrgeWaveActive
  if (urgeReady && sim.urgeWarningTime > 0 && !sim.urgeWarned && sim.urgeWaveTimer <= sim.urgeWarningTime) {
    sim.urgeWaveTimer = sim.urgeWarningTime
    sim.urgeWarned = true
    out.push({ type: 'urgeWarning' })
  } else if (!urgeReady && sim.urgeWarned) {
    sim.urgeWarned = false
  }

  if (sim.urgeWaveTimer <= 0 && urgeReady) {
    sim.isUrgeWaveActive = true
    sim.urgeWaveDuration = URGE_WAVE_SECONDS
    sim.urgeWaveAge = 0
    sim.urgeWaveTimer = lerp(18.0, 7.0, fillRatio) * sim.urgeIntervalScale
    sim.urgeWarned = false
    out.push({ type: 'urgeStart' })
  }

  if (sim.isUrgeWaveActive) {
    sim.urgeWaveDuration -= dt
    sim.urgeWaveAge += dt
    if (sim.isClenching) {
      // Freeze and squeeze: tightening the pelvic floor calms the bladder muscle by
      // reflex, so a held clench drains the spasm, and the wave passes once it's gone.
      sim.detrusorSpasmIntensity = Math.max(0, sim.detrusorSpasmIntensity - sim.urgeSuppressRate * dt)
      if (sim.detrusorSpasmIntensity <= 0) {
        sim.isUrgeWaveActive = false
        out.push({ type: 'urgeEnd', suppressed: true })
      }
    } else {
      sim.detrusorSpasmIntensity = Math.min(sim.urgeStrength, sim.detrusorSpasmIntensity + dt * 2.0)
    }
    if (sim.isUrgeWaveActive && sim.urgeWaveDuration <= 0) {
      sim.isUrgeWaveActive = false
      out.push({ type: 'urgeEnd', suppressed: false })
    }
  } else {
    sim.detrusorSpasmIntensity = Math.max(0, sim.detrusorSpasmIntensity - dt * 1.5)
  }

  // Hydrostatic pressure
  const basePressure = fillPressure(fillRatio)
  const incompressibilityBoost = 1.0 + Math.pow(fillRatio, 3.0) * 2.5
  sim.pressure = basePressure +
    (sim.detrusorSpasmIntensity * URGE_PRESSURE) +
    (sim.coughImpulseIntensity * COUGH_PRESSURE) +
    (sim.squeezeAmountY * 34.0 * incompressibilityBoost) +
    sim.touchPressure

  if (sim.pressure > sim.maxRecordedPressure) sim.maxRecordedPressure = sim.pressure

  // Tension creaks under load
  if (sim.pressure > 46.0 && sim.creakCooldown <= 0 && rng() > 0.5) {
    out.push({ type: 'creak' })
    sim.creakCooldown = 2.0 + rng() * 2.0
  }

  // Sphincter strain: whatever pushes on the outlet strains it, more so the fuller the
  // bladder, and much less through a clench. The sphincter is open while voiding.
  const push = URGE_STRAIN_RATE * sim.detrusorSpasmIntensity +
    COUGH_STRAIN_RATE * sim.coughImpulseIntensity +
    SQUEEZE_STRAIN_RATE * sim.squeezeAmountY
  if (push > 0 && !sim.isActivelyVoiding && !sim.involuntaryVoiding) {
    const guard = sim.isClenching ? sim.clenchGuard : 1.0
    const strain = sim.sphincterToneStrain + push * (basePressure / 50.0) * guard * dt
    if (strain > 1.0 && sim.isClenching) sim.kegelStamina = Math.max(0, sim.kegelStamina - (strain - 1.0) * OVERLOAD_STAMINA)
    sim.sphincterToneStrain = Math.min(1.0, strain)
  }

  // At 100 % strain the sphincter gives way unless a clench holds it: a spurt, or total
  // failure under high pressure. The arcade allows `leakGraceTime` to clench first.
  const canLeak = !sim.isActivelyVoiding && !sim.isStressLeaking && !sim.involuntaryVoiding && sim.volume > 0
  if (canLeak && sim.sphincterToneStrain >= 1.0 && !sim.isClenching) {
    if (sim.leakGrace < sim.leakGraceTime) {
      if (sim.leakGrace === 0) out.push({ type: 'leakWarning' })
      sim.leakGrace += dt
    } else {
      sim.leakGrace = 0
      if (sim.pressure - sim.touchPressure > FAILURE_PRESSURE) {
        sim.involuntaryVoiding = true
        out.push({ type: 'failureStart' })
      } else {
        sim.isStressLeaking = true
        sim.stressLeakTargetLoss = Math.min(sim.volume * 0.15, 25.0 + rng() * 20.0)
        out.push({ type: 'leakStart' })
      }
    }
  } else if (sim.leakGrace > 0) {
    if (sim.isClenching) out.push({ type: 'leakSaved' })
    sim.leakGrace = 0
  }

  if (sim.isStressLeaking) {
    if (sim.isClenching) {
      // A clench shuts the leak.
      sim.isStressLeaking = false
      out.push({ type: 'leakEnd' })
    } else {
      const leakStep = Math.min(sim.volume, LEAK_FLOW * dt)
      sim.volume -= leakStep
      sim.totalLeakedVolume += leakStep
      sim.stressLeakTargetLoss -= leakStep
      sim.flowRate = LEAK_FLOW

      if (sim.stressLeakTargetLoss <= 0 || sim.volume <= 0) {
        sim.isStressLeaking = false
        sim.sphincterToneStrain = Math.min(sim.sphincterToneStrain, RESEAL_STRAIN)
        out.push({ type: 'leakEnd' })
      }
    }
  }

  // Void latency
  if (sim.isAttemptingVoid && !sim.isActivelyVoiding && !sim.involuntaryVoiding) {
    sim.voidLatencyTimer += dt
    if (sim.voidLatencyTimer >= sim.voidLatencyRequired) {
      sim.isActivelyVoiding = true
      out.push({ type: 'voidStart' })
    }
  }

  // Total retention failure: the bladder empties itself (it counts as leaked) down to 70 ml.
  if (sim.involuntaryVoiding) {
    sim.sphincterDilation = 1.0
    const flow = Math.min(sim.volume / dt, voidFlow(sim.volume, 1.0))
    sim.volume = Math.max(0, sim.volume - flow * dt)
    sim.totalLeakedVolume += flow * dt
    sim.flowRate = flow

    if (sim.volume <= 70) {
      sim.involuntaryVoiding = false
      sim.sphincterToneStrain = 0
      sim.kegelStamina = 1.0
      out.push({ type: 'failureEnd' })
    }
  }

  if (sim.isActivelyVoiding && !sim.involuntaryVoiding) {
    sim.sphincterDilation = lerp(sim.sphincterDilation, 1.0, dt * 5.0)
    sim.flowRate = Math.min(sim.volume / dt, voidFlow(sim.volume, sim.sphincterDilation))
    sim.volume = Math.max(0, sim.volume - sim.flowRate * dt)
    sim.sphincterToneStrain = Math.max(0, sim.sphincterToneStrain - VOID_RELIEF_RATE * dt)

    if (sim.volume <= EMPTY_ML) stopVoidAttempt(sim, out)
  } else if (!sim.involuntaryVoiding && !sim.isStressLeaking) {
    sim.sphincterDilation = lerp(sim.sphincterDilation, 0.0, dt * 8.0)
    sim.flowRate = 0
  }

  // Telemetry strip-chart buffer
  sim.telemetryHistory.push({ pressure: sim.pressure, volume: sim.volume, tone: sim.sphincterToneStrain })
  if (sim.telemetryHistory.length > TELEMETRY_LENGTH) sim.telemetryHistory.shift()

  // Hydrodynamics
  sim.sloshVelX += (-sim.sloshAngleX * phys.sloshSpring) * dt
  sim.sloshVelZ += (-sim.sloshAngleZ * phys.sloshSpring) * dt
  sim.sloshVelX *= phys.sloshDamping
  sim.sloshVelZ *= phys.sloshDamping

  sim.sloshAngleX += sim.sloshVelX * dt
  sim.sloshAngleZ += sim.sloshVelZ * dt

  const fluidMass = 0.5 + fillRatio * 1.5
  const fluidK = 12.0 / fluidMass
  const core = sim.fluidCoreVelocity
  core.x += (-sim.fluidCoreOffset.x * fluidK + (sim.sloshAngleX * 0.4)) * dt
  core.z += (-sim.fluidCoreOffset.z * fluidK + (sim.sloshAngleZ * 0.4)) * dt
  core.x *= 0.92
  core.y *= 0.92
  core.z *= 0.92

  sim.fluidCoreOffset.x += core.x * dt
  sim.fluidCoreOffset.z += core.z * dt

  for (let r = sim.ripples.length - 1; r >= 0; r--) {
    const rip = sim.ripples[r]
    rip.radius += rip.speed * dt
    rip.amplitude -= rip.decay * dt * 0.12
    if (rip.radius > rip.maxRadius || rip.amplitude <= 0) sim.ripples.splice(r, 1)
  }

  sim.globalJigglePhase += dt * phys.jiggleFreq
  sim.jiggleIntensity = Math.max(0, sim.jiggleIntensity - dt * phys.jiggleDecay)

  if (sim.creakCooldown > 0) sim.creakCooldown -= dt
  sim.touchPressure *= Math.exp(-TOUCH_FADE * dt)
  if (sim.sootheCooldown > 0) sim.sootheCooldown = Math.max(0, sim.sootheCooldown - dt)
}

// Original voice evaluator: which ambient line the bladder would say right now.
export function ambientVoiceCategory(sim) {
  if (sim.isActivelyVoiding || sim.involuntaryVoiding || sim.isStressLeaking) return null
  const fillRatio = fillRatioOf(sim)
  if (fillRatio > 0.88 || sim.sphincterToneStrain > 0.75) return 'critical'
  if (fillRatio > 0.72) return 'full'
  if (fillRatio > 0.45) return 'distended'
  if (fillRatio > 0.18) return 'nominal'
  return null
}
