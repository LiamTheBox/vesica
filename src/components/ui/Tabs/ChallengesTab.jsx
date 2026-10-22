import { useHud, useUiStore } from '../../../store/useUiStore'
import { act } from '../../../sim/engine'
import { startCommuteChallenge, startPrecisionChallenge } from '../../../sim/sim'
import { quitArcadeRun, startArcadeRun } from '../../../sim/arcade'
import { quitMicroRun, startMicroRun } from '../../../sim/micro/runner'
import { describeBest } from '../../../challenges/bests'
import { STICKERS } from '../../../challenges/stickers'
import { formatNumber, t } from '../../../i18n'
import Sheet from '../Sheet'

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
    <div className="p-3.5 bg-slate-900/70 border border-amber-800/50 rounded-2xl flex flex-col gap-2">
      <div className="font-extrabold text-xs text-slate-200">{t('stickers.title', { count, total: STICKERS.length })}</div>
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

export default function ChallengesTab() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)
  const results = useUiStore((s) => s.challengeResults)
  const bests = useUiStore((s) => s.bests)
  const activeChallenge = useHud((h) => h.activeChallenge)
  const challengeSeconds = useHud((h) => h.challengeSeconds)
  const totalLeaked = useHud((h) => h.totalLeaked)
  const arcadeScore = useHud((h) => h.arcadeScore)
  const microScore = useHud((h) => h.microScore)

  if (currentTab !== 'challenges') return null
  const inArcade = activeChallenge === 'arcade'
  const inMicro = activeChallenge === 'micro'

  return (
    <Sheet title={t('challenges.title')} subtitle={t('challenges.subtitle')} titleTone="text-cyan-400" onClose={() => setTab('sim')}>
      <div className="p-3.5 bg-slate-900/70 border border-fuchsia-800/60 rounded-2xl flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <div className="font-extrabold text-xs text-slate-200">{t('challenges.arcade')}</div>
          <StatusBadge running={inArcade} runningText={t('challenges.arcade.running', { score: formatNumber(arcadeScore) })} result={results.arcade} />
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('challenges.arcade.about')}
        </p>
        {bests.arcade && <p className="text-[11px] font-mono font-bold text-amber-300">{describeBest('arcade', bests.arcade)}</p>}
        <button onClick={() => act(startArcadeRun)} className="w-full py-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 rounded-xl font-bold text-xs uppercase tracking-wider transition">
          {t(inArcade ? 'challenges.arcade.restart' : 'challenges.arcade.start')}
        </button>
      </div>

      <div className="p-3.5 bg-slate-900/70 border border-violet-800/60 rounded-2xl flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <div className="font-extrabold text-xs text-slate-200">{t('challenges.micro')}</div>
          <StatusBadge running={inMicro} runningText={t('challenges.micro.running', { score: microScore })} result={results.micro} />
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('challenges.micro.about')}
        </p>
        {bests.micro && <p className="text-[11px] font-mono font-bold text-amber-300">{describeBest('micro', bests.micro)}</p>}
        <button onClick={() => act(startMicroRun)} className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl font-bold text-xs uppercase tracking-wider transition">
          {t(inMicro ? 'challenges.micro.restart' : 'challenges.micro.start')}
        </button>
      </div>

      <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-2">
        <div className="font-extrabold text-xs text-slate-200">{t('challenges.sandbox')}</div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('challenges.sandbox.about')}
        </p>
        <button
          onClick={() => { act(quitArcadeRun); act(quitMicroRun); setTab('sim') }}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition"
        >
          {t(inArcade || inMicro ? 'challenges.sandbox.endRun' : 'challenges.sandbox.start')}
        </button>
      </div>

      <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <div className="font-extrabold text-xs text-slate-200">{t('challenges.commute')}</div>
          <StatusBadge
            running={activeChallenge === 'commute'}
            runningText={t('challenges.commute.running', { s: challengeSeconds, leaked: totalLeaked })}
            result={results.commute}
          />
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('challenges.commute.about')}
        </p>
        {bests.commute && <p className="text-[11px] font-mono font-bold text-amber-300">{describeBest('commute', bests.commute)}</p>}
        <button onClick={() => act(startCommuteChallenge)} className="w-full py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 rounded-xl font-bold text-xs uppercase tracking-wider transition">
          {t('challenges.commute.start')}
        </button>
      </div>

      <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <div className="font-extrabold text-xs text-slate-200">{t('challenges.precision')}</div>
          <StatusBadge running={activeChallenge === 'precision'} runningText={t('challenges.precision.running')} result={results.precision} />
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('challenges.precision.about')}
        </p>
        {bests.precision && <p className="text-[11px] font-mono font-bold text-amber-300">{describeBest('precision', bests.precision)}</p>}
        <button onClick={() => act(startPrecisionChallenge)} className="w-full py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 rounded-xl font-bold text-xs uppercase tracking-wider transition">
          {t('challenges.precision.start')}
        </button>
      </div>

      <Stickers />
    </Sheet>
  )
}
