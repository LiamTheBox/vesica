import { useFrame } from '@react-three/fiber'
import { useSimStore } from '../store/useSimStore'
import * as THREE from 'three'
import { PHYSICS_CONFIGS } from './constants'
import { audio } from '../audio/AudioManager'

export function SimEngine() {
  useFrame((state, delta) => {
    const dt = Math.min(0.08, delta)
    const store = useSimStore.getState()
    const phys = PHYSICS_CONFIGS.jello
    
    let extraDrip = 0
    const activeBevs = [...store.activeBeverages]
    let bevChanged = false
    let newHydration = store.hydration
    
    for (let i = activeBevs.length - 1; i >= 0; i--) {
      const b = activeBevs[i]
      const step = Math.min(b.rem, b.rate * dt)
      b.rem -= step
      extraDrip += step / dt
      newHydration = newHydration * 0.98 + b.hyd * 0.02
      if (b.rem <= 0) {
        activeBevs.splice(i, 1)
        bevChanged = true
      } else {
        bevChanged = true
      }
    }

    const totalDrip = store.baseDrip + extraDrip
    let newVolume = Math.min(store.maxCapacity * 1.25, store.volume + totalDrip * dt)
    const fillRatio = Math.max(0.01, newVolume / store.maxCapacity)
    
    // Kegel Stamina
    let newStamina = store.kegelStamina
    let isClenching = store.isClenching
    if (isClenching) {
      newStamina = Math.max(0, newStamina - 0.22 * dt)
      if (newStamina <= 0.02) isClenching = false
    } else {
      newStamina = Math.min(1.0, newStamina + 0.16 * dt)
    }

    // Voiding & Leak States
    let isAttemptingVoid = store.isAttemptingVoid
    let voidLatencyTimer = store.voidLatencyTimer
    let isActivelyVoiding = store.isActivelyVoiding
    let newSphincterDilation = store.sphincterDilation
    let newFlowRate = 0
    let isStressLeaking = store.isStressLeaking
    let stressLeakLoss = store.stressLeakTargetLoss
    let newTotalLeaked = store.totalLeakedVolume
    let involuntaryVoiding = store.involuntaryVoiding
    let toneStrain = store.sphincterToneStrain
    let newCough = store.coughImpulseIntensity

    // Challenge Logic
    let newChallengeTimer = store.challengeTimer
    let newPotholeTimer = store.challengePotholeTimer
    let activeChallenge = store.activeChallenge

    if (activeChallenge === 'commute') {
      newChallengeTimer -= dt
      newPotholeTimer -= dt
      if (newPotholeTimer <= 0) {
        newCough = 1.0
        newPotholeTimer = 7.0 + Math.random() * 4.0
        audio.playCoughBurst()
        audio.speak('cough')
      }
      if (newChallengeTimer <= 0) {
        activeChallenge = null
      }
    }

    if (isAttemptingVoid && !isActivelyVoiding && !involuntaryVoiding) {
      voidLatencyTimer += dt
      if (voidLatencyTimer >= 1.0) isActivelyVoiding = true
    }

    let newSqueezeY = THREE.MathUtils.lerp(store.squeezeAmountY, store.targetSqueezeY, dt * 10.0)
    if (newCough > 0) newCough = Math.max(0, newCough - dt * 3.5)

    const incompressibilityBoost = 1.0 + Math.pow(fillRatio, 3.0) * 2.5
    let pressure = 4.0 + Math.pow(fillRatio, 2.6) * 56.0 + (newCough * 38.0) + (newSqueezeY * 34.0 * incompressibilityBoost) + (store.detrusorSpasmIntensity * 24.0)
    let maxPressure = Math.max(pressure, store.maxRecordedPressure)

    // Check for stress leak
    const clenchResistance = isClenching ? 2.5 : 1.0
    const baseSphincterCapacity = (50.0 - (toneStrain * 18.0)) * clenchResistance
    if (pressure > baseSphincterCapacity && !isActivelyVoiding && !isStressLeaking && !involuntaryVoiding && fillRatio > 0.5) {
      isStressLeaking = true
      stressLeakLoss = Math.min(newVolume * 0.15, 25.0 + Math.random() * 20.0)
      toneStrain = Math.min(1.0, toneStrain + 0.25)
    }

    if (isStressLeaking) {
      const leakStep = 22.0 * dt
      newVolume = Math.max(0, newVolume - leakStep)
      newTotalLeaked += leakStep
      stressLeakLoss -= leakStep
      newFlowRate = 18.0
      if (stressLeakLoss <= 0 || pressure < (baseSphincterCapacity - 8.0)) {
        isStressLeaking = false
      }
    }

    // Check for total failure
    if (toneStrain >= 1.0 && pressure > 65.0 && !involuntaryVoiding) {
      involuntaryVoiding = true
    }

    if (involuntaryVoiding) {
      const drainSpeed = 28.0
      const emptied = drainSpeed * dt
      newVolume = Math.max(0, newVolume - emptied)
      newFlowRate = drainSpeed
      newSphincterDilation = 1.0
      if (newVolume <= 70) {
        involuntaryVoiding = false
        toneStrain = 0
        newStamina = 1.0
      }
    } else if (isActivelyVoiding) {
      newSphincterDilation = THREE.MathUtils.lerp(newSphincterDilation, 1.0, dt * 5.0)
      newFlowRate = Math.min(newVolume / dt, (newSphincterDilation * 26.0) + (pressure / 8.0) * 8.0)
      const emptied = newFlowRate * dt
      newVolume = Math.max(0, newVolume - emptied)
      if (newVolume <= 10) {
        isAttemptingVoid = false
        isActivelyVoiding = false
        voidLatencyTimer = 0
      }
    } else if (!isStressLeaking) {
      newSphincterDilation = THREE.MathUtils.lerp(newSphincterDilation, 0.0, dt * 8.0)
    }

    // Telemetry Buffer
    let newHistory = store.telemetryHistory || []
    newHistory.push({ pressure, volume: newVolume, tone: toneStrain })
    if (newHistory.length > 120) newHistory.shift()

    // Slosh Dynamics
    let sVelX = store.sloshVelX + (-store.sloshAngleX * phys.sloshSpring) * dt
    let sVelZ = store.sloshVelZ + (-store.sloshAngleZ * phys.sloshSpring) * dt
    sVelX *= phys.sloshDamping; sVelZ *= phys.sloshDamping
    let sAngleX = store.sloshAngleX + sVelX * dt
    let sAngleZ = store.sloshAngleZ + sVelZ * dt

    const fluidK = 12.0 / (0.5 + fillRatio * 1.5)
    let fCoreVelX = (store.fluidCoreVelocity.x + (-store.fluidCoreOffset.x * fluidK + (sAngleX * 0.4)) * dt) * 0.92
    let fCoreVelZ = (store.fluidCoreVelocity.z + (-store.fluidCoreOffset.z * fluidK + (sAngleZ * 0.4)) * dt) * 0.92
    let fCoreOffX = store.fluidCoreOffset.x + fCoreVelX * dt
    let fCoreOffZ = store.fluidCoreOffset.z + fCoreVelZ * dt

    let activeRipples = []
    for (let i = 0; i < store.ripples.length; i++) {
      const rip = { ...store.ripples[i] }
      rip.radius += rip.speed * dt
      rip.amplitude -= rip.decay * dt * 0.12
      if (rip.radius <= rip.maxRadius && rip.amplitude > 0) activeRipples.push(rip)
    }

    store.updateSim({
      volume: newVolume,
      pressure: pressure,
      maxRecordedPressure: maxPressure,
      kegelStamina: newStamina,
      sphincterToneStrain: toneStrain,
      isClenching,
      isAttemptingVoid,
      isActivelyVoiding,
      voidLatencyTimer,
      sphincterDilation: newSphincterDilation,
      flowRate: newFlowRate,
      hydration: newHydration,
      squeezeAmountY: newSqueezeY,
      coughImpulseIntensity: newCough,
      isStressLeaking,
      stressLeakTargetLoss: stressLeakLoss,
      totalLeakedVolume: newTotalLeaked,
      involuntaryVoiding,
      activeChallenge,
      challengeTimer: newChallengeTimer,
      challengePotholeTimer: newPotholeTimer,
      telemetryHistory: newHistory,
      sloshVelX: sVelX, sloshVelZ: sVelZ, sloshAngleX: sAngleX, sloshAngleZ: sAngleZ,
      fluidCoreVelocity: new THREE.Vector3(fCoreVelX, 0, fCoreVelZ),
      fluidCoreOffset: new THREE.Vector3(fCoreOffX, 0, fCoreOffZ),
      ripples: activeRipples,
      jiggleIntensity: Math.max(0, store.jiggleIntensity - dt * phys.jiggleDecay),
      ...(bevChanged && { activeBeverages: activeBevs })
    })
  })
  return null
}
