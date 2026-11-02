import { useUiStore } from '../../store/useUiStore'
import { haptic } from '../../feedback/feedback'
import { t } from '../../i18n'
import RailButton from './RailButton'

const TOOLS = [
  { key: 'poke', icon: '👉' },
  { key: 'squeeze', icon: '🤏' },
  { key: 'slap', icon: '👋' },
  { key: 'orbit', icon: '🔄' },
]

// What stays on until changed: what one finger does on the bladder (one at a time), and the
// cutaway view. On the left edge of the stage; what happens once, on a tap, is on the right.
export default function ToolRail() {
  const mode = useUiStore((s) => s.interactionMode)
  const setMode = useUiStore((s) => s.setInteractionMode)
  const isCutawayActive = useUiStore((s) => s.isCutawayActive)
  const toggleCutaway = useUiStore((s) => s.toggleCutaway)

  return (
    <div className="stage-rail glass-hud pointer-events-auto flex flex-col gap-1 p-1 rounded-2xl">
      <div role="radiogroup" aria-label={t('tools.label')} className="flex flex-col gap-1">
        {TOOLS.map((tool) => (
          <RailButton
            key={tool.key}
            role="radio"
            aria-checked={mode === tool.key}
            icon={tool.icon}
            label={t(`tools.${tool.key}`)}
            title={t(`tools.${tool.key}.title`)}
            active={mode === tool.key}
            onClick={() => { setMode(tool.key); haptic(20) }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="h-px mx-1 flex-shrink-0 bg-slate-700/70" />
      <RailButton
        aria-pressed={isCutawayActive}
        icon="🔬"
        label={t('tools.cutaway')}
        title={t('tools.cutaway.title')}
        active={isCutawayActive}
        onClick={() => { toggleCutaway(); haptic(20) }}
      />
    </div>
  )
}
