import { create } from 'zustand'
import { EMPTY_BESTS } from '../challenges/bests'
import { loadJson } from './persist'

// UI state plus a rounded HUD snapshot of the simulation. The live simulation lives
// in `src/sim/engine.js`; components subscribe here so they only re-render when a
// displayed value changes, never once per frame.

export const DEFAULT_SETTINGS = {
  masterMuted: false,
  voiceEnabled: true,
  voiceVolume: 1.0,
  voiceGap: 10, // seconds between spoken lines, at least
  sfxEnabled: true,
  sfxVolume: 0.8,
  haptics: true,
}

export const initialHud = {
  volume: 120,
  maxCapacity: 750,
  staminaPct: 100,
  pressure: 7.2,
  flowRate: 0,
  tonePct: 0,
  dilationPct: 0,
  isClenching: false,
  clenchExhausted: false,
  isAttemptingVoid: false,
  isActivelyVoiding: false,
  voidProgress: 0,
  voidSecondsLeft: 1.0,
  isStressLeaking: false,
  involuntaryVoiding: false,
  isUrgeWaveActive: false,
  totalLeaked: 0,
  maxPressure: 7.2,
  activeChallenge: null,
  challengeSeconds: 0,
}

export const useUiStore = create((set) => ({
  currentTab: 'sim',
  interactionMode: 'poke',
  isCutawayActive: false,
  currentSubtitle: null,
  // Last result per challenge: { success, text }
  challengeResults: { commute: null, precision: null },
  // Most recent result, shown as a toast on the Sim screen: { challenge, success, text, id }
  lastResult: null,
  // Best results, kept on the device.
  bests: loadJson('bests', EMPTY_BESTS),
  settings: loadJson('settings', DEFAULT_SETTINGS),
  hud: initialHud,

  setTab: (tab) => set({ currentTab: tab }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  toggleCutaway: () => set((state) => ({ isCutawayActive: !state.isCutawayActive })),
  dismissResult: () => set({ lastResult: null }),
}))

export const useHud = (selector) => useUiStore((state) => selector(state.hud))
