import { audio } from '../audio/AudioManager'
import { voice } from '../audio/voice'
import { feedbackSettings } from '../feedback/feedback'
import { PHYSICS_CONFIGS } from '../physics/constants'
import { sim } from '../sim/engine'
import { saveJson } from '../store/persist'
import { useUiStore } from '../store/useUiStore'

// Pushes settings into the sound, the voice and haptics. Safe before the AudioContext
// exists: gains are applied when it is created.
export function applySettings(settings) {
  audio.isMasterMuted = settings.masterMuted
  voice.muted = settings.masterMuted
  voice.enabled = settings.voiceEnabled
  voice.volume = settings.voiceVolume
  voice.chatGap = settings.chatGap
  voice.setVoiceName(settings.voiceName)
  voice.setPersonality(settings.personality)
  audio.sfxEnabled = settings.sfxEnabled
  audio.sfxVolume = settings.sfxVolume
  feedbackSettings.haptics = settings.haptics
  if (PHYSICS_CONFIGS[settings.wallFeel]) sim.physicsMode = settings.wallFeel

  if (audio.ctx) {
    const now = audio.ctx.currentTime
    audio.masterGain.gain.setValueAtTime(settings.masterMuted ? 0 : 1, now)
    audio.sfxGain.gain.setValueAtTime(settings.sfxEnabled ? settings.sfxVolume : 0, now)
  }
  if (settings.masterMuted || !settings.voiceEnabled) voice.cancel()
}

export function updateSettings(patch) {
  const settings = { ...useUiStore.getState().settings, ...patch }
  useUiStore.setState({ settings })
  applySettings(settings)
  saveJson('settings', settings)
}

// The original's four soft-body presets (physics/constants.js), in the order Settings offers
// them (named by i18n's wallFeel.<key>). How full it is still changes how it feels.
export const WALL_FEELS = ['jello', 'balloon', 'anatomical', 'highTension']

// Graphics quality: 'auto' or a fixed tier. Choosing Auto again re-detects from the top.
export function setGraphics(graphics) {
  if (graphics === 'auto') useUiStore.getState().setAutoQuality('high')
  updateSettings({ graphics })
}
