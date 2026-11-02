import { useHud, useUiStore } from '../../../store/useUiStore'
import { act } from '../../../sim/engine'
import { startCommuteChallenge, startPrecisionChallenge } from '../../../sim/sim'
import { quitArcadeRun, startArcadeRun } from '../../../sim/arcade'
import { quitMicroRun, startMicroRun } from '../../../sim/micro/runner'
import { describeBest } from '../../../challenges/bests'
import { STICKERS } from '../../../challenges/stickers'
import { formatNumber, t } from '../../../i18n'
import Sheet from '../Sheet'
import { CARD, CARD_NOTE, CARD_TITLE, MAIN_ACTION, QUIET_ACTION } from '../styles'

const BADGE = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded'
const TONES = {
  ready: `${BADGE} bg-slate-800 text-slate-400`,
  running: `${BADGE} bg-amber-950 text-amber-400 border border-amber-800 animate-pulse`,
  success: `${BADGE} bg-emerald-950 text-emerald-400 border border-emerald-800`,
  failed: `${BADGE} bg-rose-950 text-rose-400 border border-rose-800`,
}

// Every sticker (A12): earned ones in colour, the rest faded with how to earn them.
function Stickers() {
  const earned = useUiStore((s) => s.stickers.earned)
  const count = STICKERS.filter((sticker) => earned[sticker.id]).length
  return (
    <div className={CARD}>
      <div className={CARD_TITLE}>{t('stickers.title', { count, total: STICKERS.length })}</div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {STICKERS.map((sticker) => {
          const got = !!earned[sticker.id]
          return (
            <li key={sticker.id} title={t(`sticker.${sticker.id}.hint`)} className={`flex items-center gap-2 p-1.5 rounded-xl border ${got ? 'bg-amber-950/40 border-amber-700/60' : 'bg-slate-900 border-slate-800'}`}>
              <span className={`text-xl flex-shrink-0 ${got ? '' : 'grayscale opacity-40'}`} aria-hidden="true">{sticker.icon}</span>
              <span className="min-w-0">
                <span className={`block text-[11px] font-bold leading-tight ${got ? 'text-amber-200' : 'text-slate-400'}`}>
                  {t(`sticker.${sticker.id}`)}<span className="sr-only">{t(got ? 'stickers.earned' : 'stickers.notYet')}</span>
                </span>
                {!got && <span className="block text-[9px] text-slate-500 leading-tight">{t(`sticker.${sticker.id}.hint`)}</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function StatusBadge({ running, runningText, result }) {
  if (running) return <span className={TONES.running}>{runningText}</span>
  if (result) return <span className={result.success ? TONES.success : TONES.failed}>{result.text}</span>
  return <span className={TONES.ready}>{t('challenges.ready')}</span>
}

// A challenge: what it is, how it went, its best, and the button to start it.
function ChallengeCard({ id, running, runningText, start, onStart }) {
  const result = useUiStore((s) => s.challengeResults[id])
  const best = useUiStore((s) => s.bests[id])
  return (
    <div className={CARD}>
      <div className="flex justify-between items-center gap-2">
        <div className={CARD_TITLE}>{t(`challenges.${id}`)}</div>
        <StatusBadge running={running} runningText={runningText} result={result} />
      </div>
      <p className={CARD_NOTE}>{t(`challenges.${id}.about`)}</p>
      {best && <p className="text-[11px] font-mono font-bold text-amber-300">{describeBest(id, best)}</p>}
      <button onClick={onStart} className={MAIN_ACTION}>{start}</button>
    </div>
  )
}

export default function ChallengesTab() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)
  const activeChallenge = useHud((h) => h.activeChallenge)
  const challengeSeconds = useHud((h) => h.challengeSeconds)
  const totalLeaked = useHud((h) => h.totalLeaked)
  const arcadeScore = useHud((h) => h.arcadeScore)
  const microScore = useHud((h) => h.microScore)

  if (currentTab !== 'challenges') return null
  const inArcade = activeChallenge === 'arcade'
  const inMicro = activeChallenge === 'micro'

  return (
    <Sheet title={t('challenges.title')} subtitle={t('challenges.subtitle')} onClose={() => setTab('sim')}>
      <ChallengeCard
        id="arcade"
        running={inArcade}
        runningText={t('challenges.arcade.running', { score: formatNumber(arcadeScore) })}
        start={t(inArcade ? 'challenges.arcade.restart' : 'challenges.arcade.start')}
        onStart={() => act(startArcadeRun)}
      />
      <ChallengeCard
        id="micro"
        running={inMicro}
        runningText={t('challenges.micro.running', { score: microScore })}
        start={t(inMicro ? 'challenges.micro.restart' : 'challenges.micro.start')}
        onStart={() => act(startMicroRun)}
      />

      <div className={CARD}>
        <div className={CARD_TITLE}>{t('challenges.sandbox')}</div>
        <p className={CARD_NOTE}>{t('challenges.sandbox.about')}</p>
        <button onClick={() => { act(quitArcadeRun); act(quitMicroRun); setTab('sim') }} className={QUIET_ACTION}>
          {t(inArcade || inMicro ? 'challenges.sandbox.endRun' : 'challenges.sandbox.start')}
        </button>
      </div>

      <ChallengeCard
        id="commute"
        running={activeChallenge === 'commute'}
        runningText={t('challenges.commute.running', { s: challengeSeconds, leaked: totalLeaked })}
        start={t('challenges.commute.start')}
        onStart={() => act(startCommuteChallenge)}
      />
      <ChallengeCard
        id="precision"
        running={activeChallenge === 'precision'}
        runningText={t('challenges.precision.running')}
        start={t('challenges.precision.start')}
        onStart={() => act(startPrecisionChallenge)}
      />

      <Stickers />
    </Sheet>
  )
}
