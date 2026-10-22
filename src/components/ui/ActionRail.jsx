import { useUiStore } from '../../store/useUiStore'
import { act } from '../../sim/engine'
import { agitate, cough, resetOrgan } from '../../sim/sim'
import { haptic } from '../../feedback/feedback'
import { t } from '../../i18n'

const RAIL_BUTTON = 'min-w-11 min-h-11 rounded-xl flex flex-col items-center justify-center transition active:scale-95'

// One-shot actions on the organ, on the left edge of the stage (the tool rail is on the right).
export default function ActionRail() {
  const isCutawayActive = useUiStore((s) => s.isCutawayActive)
  const toggleCutaway = useUiStore((s) => s.toggleCutaway)

  const actions = [
    {
      id: 'cutaway', icon: '🔬', pressed: isCutawayActive, title: t('actions.cutaway.title'),
      onClick: () => { toggleCutaway(); haptic(20) },
    },
    { id: 'cough', icon: '🤧', onClick: () => act(cough) },
    { id: 'shake', icon: '📳', onClick: () => act(agitate, 3.2) },
    { id: 'flush', icon: '🔄', onClick: () => act(resetOrgan) },
  ]

  return (
    <div role="toolbar" aria-label={t('actions.label')} aria-orientation="vertical" className="stage-rail glass-hud pointer-events-auto flex flex-col gap-1 p-1 rounded-2xl">
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={a.onClick}
          aria-label={t(`actions.${a.id}`)}
          aria-pressed={a.pressed}
          title={a.title ?? t(`actions.${a.id}`)}
          className={`${RAIL_BUTTON} ${a.pressed ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-400' : 'text-slate-300 hover:bg-slate-800/70'}`}
        >
          <span className="text-base leading-none">{a.icon}</span>
          <span className="text-[8px] font-mono mt-0.5">{t(`actions.${a.id}`)}</span>
        </button>
      ))}
    </div>
  )
}
