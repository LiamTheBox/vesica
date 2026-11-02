import { useHud } from '../../store/useUiStore'
import { act } from '../../sim/engine'
import { agitate, cough, resetOrgan, soothe } from '../../sim/sim'
import { t } from '../../i18n'
import RailButton from './RailButton'

// What happens once, on a tap, on the right edge of the stage, where a thumb can reach it
// while the other holds Clench. Soothe, the one that matters in a hurry, is nearest that
// thumb; Flush, which ends a run, is furthest. In the arcade Soothe needs 25 s to come back,
// and counts down.
export default function ActionRail() {
  const sootheSeconds = useHud((h) => h.sootheSeconds)

  return (
    <div role="toolbar" aria-label={t('actions.label')} aria-orientation="vertical" className="stage-rail glass-hud pointer-events-auto flex flex-col gap-1 p-1 rounded-2xl">
      <RailButton icon="🚽" label={t('actions.flush')} title={t('actions.flush.title')} onClick={() => act(resetOrgan)} />
      <RailButton icon="📳" label={t('actions.shake')} title={t('actions.shake.title')} onClick={() => act(agitate, 3.2)} />
      <RailButton icon="🤧" label={t('actions.cough')} title={t('actions.cough.title')} onClick={() => act(cough)} />
      <RailButton
        icon="🧘"
        label={t('actions.soothe')}
        title={t('actions.soothe.title')}
        note={sootheSeconds > 0 ? t('unit.seconds', { n: sootheSeconds }) : undefined}
        disabled={sootheSeconds > 0}
        onClick={() => act(soothe)}
      />
    </div>
  )
}
