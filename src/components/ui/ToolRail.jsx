import { useUiStore } from '../../store/useUiStore'
import { haptic } from '../../feedback/feedback'
import { t } from '../../i18n'

const TOOLS = [
  { key: 'poke', icon: '👉' },
  { key: 'squeeze', icon: '🤏' },
  { key: 'slap', icon: '👋' },
  { key: 'orbit', icon: '🔄' },
]

// What one finger does on the bladder. A vertical rail on the right edge, within
// thumb reach on a phone; the active tool is always visible.
export default function ToolRail() {
  const mode = useUiStore((s) => s.interactionMode)
  const setMode = useUiStore((s) => s.setInteractionMode)

  return (
    <div role="radiogroup" aria-label={t('tools.label')} className="stage-rail glass-hud pointer-events-auto flex flex-col gap-1 p-1 rounded-2xl">
      {TOOLS.map((tool) => (
        <button
          key={tool.key}
          role="radio"
          aria-checked={mode === tool.key}
          aria-label={t(`tools.${tool.key}`)}
          onClick={() => { setMode(tool.key); haptic(20) }}
          className={`min-w-11 min-h-11 rounded-xl flex flex-col items-center justify-center transition active:scale-95 ${mode === tool.key ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-400' : 'text-slate-300 hover:bg-slate-800/70'}`}
        >
          <span className="text-base leading-none">{tool.icon}</span>
          <span className="text-[8px] font-mono mt-0.5">{t(`tools.${tool.key}`)}</span>
        </button>
      ))}
    </div>
  )
}
