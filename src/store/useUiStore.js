import { create } from 'zustand'
import { EMPTY_BESTS } from '../challenges/bests'
import { loadJson, saveJson } from './persist'
import { isTier } from '../settings/quality'

// UI state plus a rounded HUD snapshot of the simulation. The live simulation lives
// in `src/sim/engine.js`; components subscribe here so they only re-render when a
// displayed value changes, never once per frame.

export const DEFAULT_SETTINGS = {
  masterMuted: false,
  voiceEnabled: true,
  voiceVolume: 1.0,
  voiceName: '', // an installed voice's name; '' picks one (on the device first)
  chatGap: 30, // seconds between the bladder's own chatter, at least (reactions don't wait for it)
  sfxEnabled: true,
  sfxVolume: 0.8,
  haptics: true,
  shakeToSlosh: true, // device motion sloshes the bladder
  graphics: 'auto', // 'auto' or a tier from settings/quality.js
}

const savedAutoQuality = loadJson('quality', { tier: 'high' }).tier

export const initialHud = {
  volume: 120,
  maxCapacity: 750,
  endless: false, // no limit to what it holds (the arcade)
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
  urgeWarned: false,
  coughWarned: false,
  leakGrace: false,
  sootheSeconds: 0,
  arcadeScore: 0,
  arcadeCombo: 0,
  arcadeLevel: 0,
  arcadeSeconds: 0,
  micro: false, // a microgames run is on
  microLives: 0,
  microScore: 0,
  microLevel: 0,
}

export const useUiStore = create((set) => ({
  currentTab: 'sim',
  interactionMode: 'poke',
  isCutawayActive: false,
  currentSubtitle: null,
  // How the bladder feels (feedback/mood.js), shown as its face.
  mood: 'calm',
  // Last result per challenge: { success, text }
  challengeResults: { commute: null, precision: null, arcade: null, micro: null },
  // Most recent result, shown as a card on the Sim screen: { challenge, success, text, detail, newBest, id }
  lastResult: null,
  // Latest arcade score line, flashed under the score: { text, tone, id }
  arcadeToast: null,
  // Best results, kept on the device.
  bests: loadJson('bests', EMPTY_BESTS),
  settings: loadJson('settings', DEFAULT_SETTINGS),
  hud: initialHud,
  // Where the 3D stage sits on screen ({ x, y, width, height }), for camera framing.
  stageRect: null,
  // The player has panned or zoomed away from the fitted view; bumping viewResetId recenters.
  viewMoved: false,
  viewResetId: 0,
  // Tier Auto quality settled on for this device; kept so a slow phone starts there.
  autoQuality: isTier(savedAutoQuality) ? savedAutoQuality : 'high',
  // The page is in the background: rendering and audio pause.
  appHidden: false,

  setTab: (tab) => set({ currentTab: tab }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  toggleCutaway: () => set((state) => ({ isCutawayActive: !state.isCutawayActive })),
  dismissResult: () => set({ lastResult: null }),
  recenterView: () => set((state) => ({ viewResetId: state.viewResetId + 1 })),
  setAutoQuality: (tier) => {
    set({ autoQuality: tier })
    saveJson('quality', { tier })
  },
}))

// The rendering tier in use: the player's choice, or what Auto settled on.
export const selectQualityTier = (state) =>
  isTier(state.settings.graphics) ? state.settings.graphics : state.autoQuality

export const useHud = (selector) => useUiStore((state) => selector(state.hud))
