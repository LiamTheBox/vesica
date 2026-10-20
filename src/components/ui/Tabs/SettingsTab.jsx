import { useUiStore } from '../../../store/useUiStore'
import { updateSettings } from '../../../settings/settings'

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

export default function SettingsTab() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)
  const settings = useUiStore((s) => s.settings)

  if (currentTab !== 'settings') return null

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto p-4 flex flex-col justify-center items-center bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-lg w-full max-h-full overflow-y-auto glass-modal p-5 rounded-3xl flex flex-col gap-4 border border-slate-700/60">
        <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-200 font-mono uppercase tracking-wider">App Preferences</h2>
            <p className="text-xs text-slate-400">Acoustic, Haptic & Simulation Configuration</p>
          </div>
          <button onClick={() => setTab('sim')} aria-label="Close settings" className="text-slate-400 hover:text-white text-lg font-bold min-w-11 min-h-11">✕</button>
        </div>

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
            label="Talks at most every"
            value={settings.voiceGap}
            display={`${settings.voiceGap}s`}
            min={3}
            max={30}
            step={1}
            onChange={(v) => updateSettings({ voiceGap: v })}
          />
          <p className="text-[10px] text-slate-500 font-mono">Anti-repetition memory: the last 5 lines of each mood aren't repeated</p>
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
      </div>
    </div>
  )
}
