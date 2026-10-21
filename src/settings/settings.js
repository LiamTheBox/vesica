import { audio } from '../audio/AudioManager'
import { feedbackSettings } from '../feedback/feedback'
import { saveJson } from '../store/persist'
import { useUiStore } from '../store/useUiStore'

// Pushes settings into the audio engine and haptics. Safe before the AudioContext
// exists: gains are applied when it is created.
export function applySettings(settings) {
  audio.isMasterMuted = settings.masterMuted
  audio.voiceEnabled = settings.voiceEnabled
  audio.voiceVolume = settings.voiceVolume
  audio.chatGap = settings.chatGap
  audio.sfxEnabled = settings.sfxEnabled
  audio.sfxVolume = settings.sfxVolume
  feedbackSettings.haptics = settings.haptics

  if (audio.ctx) {
    const now = audio.ctx.currentTime
    audio.masterGain.gain.setValueAtTime(settings.masterMuted ? 0 : 1, now)
    audio.sfxGain.gain.setValueAtTime(settings.sfxEnabled ? settings.sfxVolume : 0, now)
  }
  if (audio.synth && (settings.masterMuted || !settings.voiceEnabled)) audio.synth.cancel()
}

export function updateSettings(patch) {
  const settings = { ...useUiStore.getState().settings, ...patch }
  useUiStore.setState({ settings })
  applySettings(settings)
  saveJson('settings', settings)
}

// Graphics quality: 'auto' or a fixed tier. Choosing Auto again re-detects from the top.
export function setGraphics(graphics) {
  if (graphics === 'auto') useUiStore.getState().setAutoQuality('high')
  updateSettings({ graphics })
}
