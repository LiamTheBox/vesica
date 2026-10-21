import { useEffect, useState } from 'react'
import { useUiStore } from '../../../store/useUiStore'
import { setGraphics, updateSettings, WALL_FEELS } from '../../../settings/settings'
import { voice } from '../../../audio/voice'
import { QUALITY_TIERS, TIER_ORDER } from '../../../settings/quality'
import Sheet from '../Sheet'

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer min-h-11">
      <span>
        <span className="block text-xs font-bold text-slate-300">{label}</span>
        {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-amber-500" />
    </label>
  )
}

function Slider({ label, value, display, min, max, step, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span className="font-mono">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-6 cursor-pointer" />
    </label>
  )
}

const percent = (v) => `${Math.round(v * 100)}%`

// The installed English voices; the list fills in once the browser has loaded them.
function useVoices() {
  const [voices, setVoices] = useState(() => voice.voices())
  useEffect(() => voice.onVoicesChanged(() => setVoices(voice.voices())), [])
  return voices
}

// Automatic picks a voice on the device; online ones go quiet without a connection.
function VoicePicker() {
  const voiceName = useUiStore((s) => s.settings.voiceName)
  const voices = useVoices()
  if (voices.length === 0) return null
  const choose = (name) => {
    updateSettings({ voiceName: name })
    voice.sample()
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">Voice</span>
      <select value={voiceName} onChange={(e) => choose(e.target.value)} className="min-h-11 rounded-xl bg-slate-800 text-slate-200 text-xs px-2 cursor-pointer">
        <option value="">Automatic</option>
        {voices.map((v) => (
          <option key={v.voiceURI || v.name} value={v.name}>{v.name}{v.localService === false ? ' (online)' : ''}</option>
        ))}
      </select>
    </label>
  )
}

const GRAPHICS_OPTIONS = [{ key: 'auto', label: 'Auto' }, ...TIER_ORDER.map((key) => ({ key, label: QUALITY_TIERS[key].label }))]

function WallFeelPicker() {
  const wallFeel = useUiStore((s) => s.settings.wallFeel)
  const chosen = WALL_FEELS.find((feel) => feel.key === wallFeel) ?? WALL_FEELS[0]
  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
      <span className="text-xs font-bold text-slate-300">🫧 Wall Feel</span>
      <div role="radiogroup" aria-label="Wall feel" className="grid grid-cols-4 gap-1.5">
        {WALL_FEELS.map((feel) => (
          <button
            key={feel.key}
            role="radio"
            aria-checked={chosen.key === feel.key}
            onClick={() => updateSettings({ wallFeel: feel.key })}
            className={`min-h-11 rounded-xl text-xs font-bold transition active:scale-95 ${chosen.key === feel.key ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {feel.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-slate-500 font-mono">{chosen.hint}</p>
    </div>
  )
}

function GraphicsPicker() {
  const graphics = useUiStore((s) => s.settings.graphics)
  const autoQuality = useUiStore((s) => s.autoQuality)
  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
      <span className="text-xs font-bold text-slate-300">🎛️ Graphics Quality</span>
      <div role="radiogroup" aria-label="Graphics quality" className="grid grid-cols-4 gap-1.5">
        {GRAPHICS_OPTIONS.map((option) => (
          <button
            key={option.key}
            role="radio"
            aria-checked={graphics === option.key}
            onClick={() => setGraphics(option.key)}
            className={`min-h-11 rounded-xl text-xs font-bold transition active:scale-95 ${graphics === option.key ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p data-testid="graphics-hint" className="text-[10px] text-slate-500 font-mono">
        {graphics === 'auto'
          ? `Auto picks what this device runs smoothly: now ${QUALITY_TIERS[autoQuality].label}`
          : 'Lower settings run cooler and save battery'}
      </p>
    </div>
  )
}

export default function SettingsTab() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)
  const settings = useUiStore((s) => s.settings)

  if (currentTab !== 'settings') return null

  return (
    <Sheet title="Settings" subtitle="Sound, voice, touch and graphics" titleTone="text-slate-200" width="max-w-lg" onClose={() => setTab('sim')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300">All Sound</span>
        <button
          onClick={() => updateSettings({ masterMuted: !settings.masterMuted })}
          className="text-xs font-bold px-3 min-h-11 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          {settings.masterMuted ? 'Muted (unmute)' : 'On (mute all)'}
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
        <Toggle label="🗣️ Voice" checked={settings.voiceEnabled} onChange={(v) => updateSettings({ voiceEnabled: v })} />
        <VoicePicker />
        <Slider label="Voice volume" value={settings.voiceVolume} display={percent(settings.voiceVolume)} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ voiceVolume: v })} />
        <Slider
          label="Chats on its own at most every"
          value={settings.chatGap}
          display={`${settings.chatGap}s`}
          min={10}
          max={90}
          step={5}
          onChange={(v) => updateSettings({ chatGap: v })}
        />
        <p className="text-[10px] text-slate-500 font-mono">Reactions to what you do don't wait. Lines show as subtitles with the voice off too, and recent ones aren't repeated.</p>
      </div>

      <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
        <Toggle label="🔊 Sound Effects" checked={settings.sfxEnabled} onChange={(v) => updateSettings({ sfxEnabled: v })} />
        <Slider label="Effects volume" value={settings.sfxVolume} display={percent(settings.sfxVolume)} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ sfxVolume: v })} />
      </div>

      <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
        <Toggle
          label="📳 Vibration"
          hint="Tactile pulse on spikes, clenches and voiding"
          checked={settings.haptics}
          onChange={(v) => updateSettings({ haptics: v })}
        />
        <Toggle
          label="🌀 Shake Phone to Slosh"
          hint="Moving the device sloshes the bladder (asks for motion access on iPhone)"
          checked={settings.shakeToSlosh}
          onChange={(v) => updateSettings({ shakeToSlosh: v })}
        />
      </div>

      <WallFeelPicker />
      <GraphicsPicker />
    </Sheet>
  )
}
