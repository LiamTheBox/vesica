import { useUiStore } from '../../../store/useUiStore'
import { setGraphics, updateSettings } from '../../../settings/settings'
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

const GRAPHICS_OPTIONS = [{ key: 'auto', label: 'Auto' }, ...TIER_ORDER.map((key) => ({ key, label: QUALITY_TIERS[key].label }))]

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
    <Sheet title="App Preferences" subtitle="Acoustic, Haptic & Simulation Configuration" titleTone="text-slate-200" width="max-w-lg" onClose={() => setTab('sim')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300">Master Sound</span>
        <button
          onClick={() => updateSettings({ masterMuted: !settings.masterMuted })}
          className="text-xs font-bold px-3 min-h-11 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          {settings.masterMuted ? 'Muted (Unmute All)' : 'Enabled (Mute All)'}
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
        <Toggle label="🗣️ Spoken Voice Engine" checked={settings.voiceEnabled} onChange={(v) => updateSettings({ voiceEnabled: v })} />
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
        <Toggle label="🔊 Procedural Hydro-Acoustics" checked={settings.sfxEnabled} onChange={(v) => updateSettings({ sfxEnabled: v })} />
        <Slider label="Effects volume" value={settings.sfxVolume} display={percent(settings.sfxVolume)} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ sfxVolume: v })} />
      </div>

      <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800">
        <Toggle
          label="📳 Mobile Haptic Vibration"
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

      <GraphicsPicker />
    </Sheet>
  )
}
