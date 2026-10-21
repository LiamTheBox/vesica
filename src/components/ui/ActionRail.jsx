import { useUiStore } from '../../store/useUiStore'
import { act } from '../../sim/engine'
import { agitate, cough, resetOrgan } from '../../sim/sim'
import { haptic } from '../../feedback/feedback'

const RAIL_BUTTON = 'min-w-11 min-h-11 rounded-xl flex flex-col items-center justify-center transition active:scale-95'

// One-shot actions on the organ, on the left edge of the stage (the tool rail is on the right).
export default function ActionRail() {
  const isCutawayActive = useUiStore((s) => s.isCutawayActive)
  const toggleCutaway = useUiStore((s) => s.toggleCutaway)

  const actions = [
    {
      label: 'Cutaway', icon: '🔬', pressed: isCutawayActive,
      onClick: () => { toggleCutaway(); haptic(20) },
    },
    { label: 'Cough', icon: '🤧', onClick: () => act(cough) },
    { label: 'Shake', icon: '📳', onClick: () => act(agitate, 3.2) },
    { label: 'Flush', icon: '🔄', onClick: () => act(resetOrgan) },
  ]

  return (
    <div role="toolbar" aria-label="Organ actions" aria-orientation="vertical" className="stage-rail glass-hud pointer-events-auto flex flex-col gap-1 p-1 rounded-2xl">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          aria-label={a.label}
          aria-pressed={a.pressed}
          title={a.label === 'Cutaway' ? 'Cut away the near half to see inside' : a.label}
          className={`${RAIL_BUTTON} ${a.pressed ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-400' : 'text-slate-300 hover:bg-slate-800/70'}`}
        >
          <span className="text-base leading-none">{a.icon}</span>
          <span className="text-[8px] font-mono mt-0.5">{a.label}</span>
        </button>
      ))}
    </div>
  )
}
