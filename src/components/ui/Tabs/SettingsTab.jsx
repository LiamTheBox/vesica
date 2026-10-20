import { useState } from 'react'
import { useUiStore } from '../../../store/useUiStore'
import { audio } from '../../../audio/AudioManager'

export default function SettingsTab() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)

  const [masterMuted, setMasterMuted] = useState(audio.isMasterMuted)
  const [voiceEnabled, setVoiceEnabled] = useState(audio.voiceEnabled)
  const [voiceVol, setVoiceVol] = useState(audio.voiceVolume)
  const [sfxEnabled, setSfxEnabled] = useState(audio.sfxEnabled)
  const [sfxVol, setSfxVol] = useState(audio.sfxVolume)

  if (currentTab !== 'settings') return null

  const toggleMaster = () => {
    audio.isMasterMuted = !audio.isMasterMuted
    if (audio.isMasterMuted) {
      if (audio.synth) audio.synth.cancel()
      if (audio.masterGain) audio.masterGain.gain.setValueAtTime(0, audio.ctx.currentTime)
    } else {
      if (audio.masterGain) audio.masterGain.gain.setValueAtTime(1.0, audio.ctx.currentTime)
    }
    setMasterMuted(audio.isMasterMuted)
  }

  const toggleVoice = (e) => {
    audio.voiceEnabled = e.target.checked
    if (!audio.voiceEnabled && audio.synth) audio.synth.cancel()
    setVoiceEnabled(audio.voiceEnabled)
  }

  const handleVoiceVol = (e) => {
    const val = parseFloat(e.target.value)
    audio.voiceVolume = val
    setVoiceVol(val)
  }

  const toggleSfx = (e) => {
    audio.sfxEnabled = e.target.checked
    if (audio.sfxGain && audio.ctx) {
      audio.sfxGain.gain.setValueAtTime(audio.sfxEnabled ? audio.sfxVolume : 0, audio.ctx.currentTime)
    }
    setSfxEnabled(audio.sfxEnabled)
  }

  const handleSfxVol = (e) => {
    const val = parseFloat(e.target.value)
    audio.sfxVolume = val
    if (audio.sfxGain && audio.ctx && audio.sfxEnabled) {
      audio.sfxGain.gain.setValueAtTime(val, audio.ctx.currentTime)
    }
    setSfxVol(val)
  }

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto p-4 flex flex-col justify-center items-center bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-lg w-full glass-modal p-5 rounded-3xl flex flex-col gap-4 border border-slate-700/60">
        <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-200 font-mono uppercase tracking-wider">App Preferences</h2>
            <p className="text-xs text-slate-400">Acoustic, Haptic & Simulation Configuration</p>
          </div>
          <button onClick={() => setTab('sim')} className="text-slate-400 hover:text-white text-lg font-bold p-1">✕</button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Master Sound</span>
          <button onClick={toggleMaster} className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700">
            {masterMuted ? 'Muted (Unmute All)' : 'Enabled (Mute All)'}
          </button>
        </div>

        <div className="flex flex-col gap-1.5 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
          <div className="flex justify-between text-xs font-bold text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={voiceEnabled} onChange={toggleVoice} className="rounded bg-slate-800 border-slate-600 text-amber-500" />
              <span>🗣️ Spoken Voice Engine</span>
            </label>
            <span className="font-mono text-slate-400">{Math.round(voiceVol * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05" value={voiceVol} onChange={handleVoiceVol} className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" />
          <p className="text-[10px] text-slate-500 font-mono">10s strict interval with anti-repetition memory buffer</p>
        </div>

        <div className="flex flex-col gap-1.5 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
          <div className="flex justify-between text-xs font-bold text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={sfxEnabled} onChange={toggleSfx} className="rounded bg-slate-800 border-slate-600 text-amber-500" />
              <span>🔊 Procedural Hydro-Acoustics</span>
            </label>
            <span className="font-mono text-slate-400">{Math.round(sfxVol * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05" value={sfxVol} onChange={handleSfxVol} className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer" />
        </div>
      </div>
    </div>
  )
}
