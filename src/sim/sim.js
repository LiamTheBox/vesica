import { BEVERAGE_TYPES, PHYSICS_CONFIGS } from '../physics/constants'

// Simulation core, ported from the original single-file game
// (`Vesica 3D Mobile Web App.html`): `updatePhysics()` without the rendering, plus
// the action handlers without DOM/audio. Functions mutate the `sim` object in place
// (like the original) and push side effects — sounds, voice, haptics, UI flashes —
// onto `out` as events, which the feedback layer turns into output.
//
// Every function that needs randomness takes `rng` so tests can be deterministic.

const TELEMETRY_LENGTH = 120

const lerp = (a, b, t) => a + (b - a) * t

export function createSimState() {
  return {
    volume: 120,
    maxCapacity: 750,
    baseDrip: 1.0,
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
    kegelFatigueRate: 0.22,
    kegelRecoverRate: 0.64, // 4x the original's 0.16 (requested)
    kegelReliefRate: 0.1, // sphincter strain relieved per second of holding (not in the original; requested)
    sphincterToneStrain: 0.0,
    detrusorSpasmIntensity: 0.0,
    sphincterDilation: 0.0,

    isStressLeaking: false,
    stressLeakTargetLoss: 0,

    coughImpulseIntensity: 0.0,

    urgeWaveTimer: 18.0,
    isUrgeWaveActive: false,
    urgeWaveDuration: 0.0,

    creakCooldown: 0,

    pressure: 7.2,
    maxRecordedPressure: 7.2,
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

    activeChallenge: null, // 'commute' | 'precision'
    challengeTimer: 0,
    challengePotholeTimer: 0,
    precisionStartVolume: 0,
  }
}

export const physicsOf = (sim) => PHYSICS_CONFIGS[sim.physicsMode]
export const fillRatioOf = (sim) => Math.max(0.01, sim.volume / sim.maxCapacity)

// --- Actions ---------------------------------------------------------------

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

export function ingestBeverage(sim, out, type, rng = Math.random) {
  const b = BEVERAGE_TYPES[type]
  if (!b) return
  sim.activeBeverages.push({ rem: b.vol, rate: b.rate, hyd: b.hyd })
  impartSloshForce(sim, (rng() - 0.5) * 4.0, (rng() - 0.5) * 4.0)
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + 0.35)
  out.push({ type: 'ingest', beverage: type })
}

export function startClench(sim, out) {
  if (sim.kegelStamina <= 0.05) return
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
  sim.sphincterToneStrain = Math.max(0, sim.sphincterToneStrain - 0.35)
  sim.detrusorSpasmIntensity = Math.max(0, sim.detrusorSpasmIntensity - 0.6)
  sim.kegelStamina = Math.min(1.0, sim.kegelStamina + 0.3)
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
export function resetOrgan(sim, out, rng = Math.random, { silent = false } = {}) {
  sim.volume = 40
  sim.activeBeverages = []
  sim.isAttemptingVoid = false
  sim.voidLatencyTimer = 0
  sim.isActivelyVoiding = false
  sim.involuntaryVoiding = false
  sim.isStressLeaking = false
  sim.kegelStamina = 1.0
  sim.sphincterToneStrain = 0
  sim.detrusorSpasmIntensity = 0
  sim.coughImpulseIntensity = 0
  sim.totalLeakedVolume = 0
  sim.activeChallenge = null
  sim.ripples = []
  sim.targetSqueezeY = 0
  sim.squeezeAmountY = 0
  // The original only hid the urge-wave banner here and let the wave run on; end it
  // so the banner (now derived from state) doesn't linger after a reset.
  sim.isUrgeWaveActive = false
  sim.urgeWaveDuration = 0
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
  // more (not in the original, which only eased it with Soothe).
  if (sim.isClenching) {
    sim.kegelStamina = Math.max(0, sim.kegelStamina - sim.kegelFatigueRate * dt)
    sim.sphincterToneStrain = Math.max(0, sim.sphincterToneStrain - sim.kegelReliefRate * dt)
    if (sim.kegelStamina <= 0.02) {
      sim.isClenching = false
      sim.clenchExhausted = true
      out.push({ type: 'clenchExhausted' })
    }
  } else {
    sim.kegelStamina = Math.min(1.0, sim.kegelStamina + sim.kegelRecoverRate * dt)
    if (sim.kegelStamina > 0.15) sim.clenchExhausted = false
  }

  if (sim.coughImpulseIntensity > 0) {
    sim.coughImpulseIntensity = Math.max(0, sim.coughImpulseIntensity - dt * 3.5)
  }

  // Urge waves
  sim.urgeWaveTimer -= dt
  if (sim.urgeWaveTimer <= 0 && fillRatio > 0.45 && !sim.isActivelyVoiding) {
    sim.isUrgeWaveActive = true
    sim.urgeWaveDuration = 3.5
    sim.urgeWaveTimer = lerp(18.0, 7.0, fillRatio)
    out.push({ type: 'urgeStart' })
  }

  if (sim.isUrgeWaveActive) {
    sim.urgeWaveDuration -= dt
    sim.detrusorSpasmIntensity = Math.min(1.0, sim.detrusorSpasmIntensity + dt * 2.0)
    if (sim.urgeWaveDuration <= 0) {
      sim.isUrgeWaveActive = false
      out.push({ type: 'urgeEnd' })
    }
  } else {
    sim.detrusorSpasmIntensity = Math.max(0, sim.detrusorSpasmIntensity - dt * 1.5)
  }

  // Hydrostatic pressure
  const clenchResistance = sim.isClenching ? 2.5 : 1.0
  const incompressibilityBoost = 1.0 + Math.pow(fillRatio, 3.0) * 2.5
  sim.pressure = 4.0 + Math.pow(fillRatio, 2.6) * 56.0 +
    (sim.detrusorSpasmIntensity * 24.0) +
    (sim.coughImpulseIntensity * 38.0) +
    (sim.squeezeAmountY * 34.0 * incompressibilityBoost)

  if (sim.pressure > sim.maxRecordedPressure) sim.maxRecordedPressure = sim.pressure

  // Tension creaks under load
  if (sim.pressure > 46.0 && sim.creakCooldown <= 0 && rng() > 0.5) {
    out.push({ type: 'creak' })
    sim.creakCooldown = 2.0 + rng() * 2.0
  }

  // Stress leak
  const baseSphincterCapacity = (50.0 - (sim.sphincterToneStrain * 18.0)) * clenchResistance

  if (sim.pressure > baseSphincterCapacity && !sim.isActivelyVoiding && !sim.isStressLeaking && !sim.involuntaryVoiding && fillRatio > 0.5) {
    sim.isStressLeaking = true
    sim.stressLeakTargetLoss = Math.min(sim.volume * 0.15, 25.0 + rng() * 20.0)
    sim.sphincterToneStrain = Math.min(1.0, sim.sphincterToneStrain + 0.25)
    out.push({ type: 'leakStart' })
  }

  if (sim.isStressLeaking) {
    const leakStep = 22.0 * dt
    sim.volume = Math.max(0, sim.volume - leakStep)
    sim.totalLeakedVolume += leakStep
    sim.stressLeakTargetLoss -= leakStep
    sim.flowRate = 18.0

    if (sim.stressLeakTargetLoss <= 0 || sim.pressure < (baseSphincterCapacity - 8.0)) {
      sim.isStressLeaking = false
      out.push({ type: 'leakEnd' })
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

  // Total retention failure
  if (sim.sphincterToneStrain >= 1.0 && sim.pressure > 65.0 && !sim.involuntaryVoiding) {
    sim.involuntaryVoiding = true
    out.push({ type: 'failureStart' })
  }

  if (sim.involuntaryVoiding) {
    const drainSpeed = 28.0
    sim.volume = Math.max(0, sim.volume - drainSpeed * dt)
    sim.flowRate = drainSpeed
    sim.sphincterDilation = 1.0

    if (sim.volume <= 70) {
      sim.involuntaryVoiding = false
      sim.sphincterToneStrain = 0
      sim.kegelStamina = 1.0
      out.push({ type: 'failureEnd' })
    }
  }

  if (sim.isActivelyVoiding && !sim.involuntaryVoiding) {
    sim.sphincterDilation = lerp(sim.sphincterDilation, 1.0, dt * 5.0)
    sim.flowRate = Math.min(sim.volume / dt, (sim.sphincterDilation * 26.0) + (sim.pressure / 8.0) * 8.0)
    sim.volume = Math.max(0, sim.volume - sim.flowRate * dt)

    if (sim.volume <= 10) stopVoidAttempt(sim, out)
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
