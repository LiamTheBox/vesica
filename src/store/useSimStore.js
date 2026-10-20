import { create } from 'zustand'
import * as THREE from 'three'

export const useSimStore = create((set, get) => ({
  // --- UI State ---
  currentTab: 'sim',
  interactionMode: 'poke',
  isCutawayActive: false,

  // --- Core Fluid State ---
  volume: 120,
  maxCapacity: 750,
  baseDrip: 1.0,
  activeBeverages: [],
  hydration: 0.85,

  // --- Pressure & Telemetry ---
  pressure: 7.2,
  maxRecordedPressure: 7.2,
  flowRate: 0,
  totalLeakedVolume: 0,
  telemetryHistory: [],

  // --- Sphincter & Voiding Dynamics ---
  isClenching: false,
  kegelStamina: 1.0,
  sphincterToneStrain: 0.0,
  sphincterDilation: 0.0,
  
  isAttemptingVoid: false,
  isActivelyVoiding: false,
  voidLatencyTimer: 0.0,
  
  involuntaryVoiding: false,
  isStressLeaking: false,
  stressLeakTargetLoss: 0,

  // --- External Impulses & Spasms ---
  detrusorSpasmIntensity: 0.0,
  coughImpulseIntensity: 0.0,
  
  // --- Interaction Physics ---
  squeezeAmountY: 0.0,
  targetSqueezeY: 0.0,
  jiggleIntensity: 0.0,
  sloshAngleX: 0,
  sloshAngleZ: 0,
  sloshVelX: 0,
  sloshVelZ: 0,
  fluidCoreOffset: new THREE.Vector3(0, 0, 0),
  fluidCoreVelocity: new THREE.Vector3(0, 0, 0),
  squeezeContactPoint: new THREE.Vector3(0, 0, 0),
  ripples: [],

  // --- Subtitles ---
  currentSubtitle: null,

  // --- Challenges ---
  activeChallenge: null,
  challengeTimer: 0,
  challengePotholeTimer: 0,
  precisionStartVolume: 0,

  // --- Actions ---
  setTab: (tab) => set({ currentTab: tab }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  toggleCutaway: () => set((state) => ({ isCutawayActive: !state.isCutawayActive })),

  ingestBeverage: (bev) => set((state) => {
    const jiggle = Math.min(1.0, state.jiggleIntensity + 0.35)
    return {
      activeBeverages: [...state.activeBeverages, { rem: bev.vol, rate: bev.rate, hyd: bev.hyd }],
      jiggleIntensity: jiggle
    }
  }),

  startClench: () => {
    const { kegelStamina } = get()
    if (kegelStamina > 0.05) {
      set({ isClenching: true })
    }
  },
  stopClench: () => set({ isClenching: false }),

  startVoidAttempt: () => {
    const { involuntaryVoiding, isClenching } = get()
    if (!involuntaryVoiding && !isClenching) {
      set({ isAttemptingVoid: true })
    }
  },
  stopVoidAttempt: () => set({ 
    isAttemptingVoid: false, 
    voidLatencyTimer: 0,
    isActivelyVoiding: false
  }),

  triggerCough: () => set((state) => ({ 
    coughImpulseIntensity: 1.0,
    jiggleIntensity: Math.min(1.0, state.jiggleIntensity + 0.88)
  })),
  
  triggerSoothe: () => set((state) => {
    const newRipples = [...state.ripples, {
      center: new THREE.Vector3(0, 0, 0),
      radius: 0.1,
      maxRadius: 3.5,
      speed: 4.0,
      amplitude: 0.25,
      decay: 4.0
    }]
    return {
      sphincterToneStrain: Math.max(0, state.sphincterToneStrain - 0.35),
      detrusorSpasmIntensity: Math.max(0, state.detrusorSpasmIntensity - 0.6),
      kegelStamina: Math.min(1.0, state.kegelStamina + 0.3),
      ripples: newRipples
    }
  }),

  addRipple: (ripple) => set((state) => ({
    ripples: [...state.ripples, ripple]
  })),

  resetOrgan: () => set({
    volume: 40,
    activeBeverages: [],
    isAttemptingVoid: false,
    isActivelyVoiding: false,
    involuntaryVoiding: false,
    isStressLeaking: false,
    kegelStamina: 1.0,
    sphincterToneStrain: 0,
    detrusorSpasmIntensity: 0,
    coughImpulseIntensity: 0,
    totalLeakedVolume: 0,
    activeChallenge: null,
    ripples: [],
    targetSqueezeY: 0,
    squeezeAmountY: 0
  }),

  // High-frequency store updater
  updateSim: (updates) => set(updates)
}))
