import { useEffect, useRef } from 'react'
import { useHud, useUiStore } from '../../../store/useUiStore'
import { sim } from '../../../sim/engine'
import { WALL_FEELS } from '../../../settings/settings'
import { MOOD_FACES } from '../../../feedback/mood'
import { t } from '../../../i18n'
import Sheet from '../Sheet'

const PANEL = 'bg-slate-900/60 p-2 rounded-xl border border-slate-800'

// The bladder's face every 10 s for the last 3 minutes, newest on the right (A7).
function MoodStrip() {
  const moods = useUiStore((s) => s.moodLog)
  return (
    <div className={PANEL}>
      <div className="text-[9px] text-slate-400 uppercase font-mono mb-1">{t('chart.moods')}</div>
      {moods.length === 0
        ? <p className="text-[11px] text-slate-500">{t('chart.moods.none')}</p>
        : (
          <div role="img" aria-label={t('chart.moods.label', { moods: moods.map((mood) => t(`mood.${mood}`)).join(', ') })} className="flex justify-end gap-0.5 text-sm leading-none">
            {moods.map((mood, i) => <span key={i} title={t(`mood.${mood}`)}>{MOOD_FACES[mood]}</span>)}
          </div>
        )}
    </div>
  )
}

// What it said lately, newest first.
function LineLog() {
  const lines = useUiStore((s) => s.lineLog)
  return (
    <div className={PANEL}>
      <div className="text-[9px] text-slate-400 uppercase font-mono mb-1">{t('chart.lines')}</div>
      {lines.length === 0
        ? <p className="text-[11px] text-slate-500">{t('chart.lines.none')}</p>
        : (
          <ol className="max-h-40 overflow-y-auto flex flex-col gap-1">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-2 text-xs text-slate-200">
                <span aria-hidden="true">{MOOD_FACES[line.mood] ?? '🗣️'}</span>
                <span>"{line.text}"</span>
              </li>
            ))}
          </ol>
        )}
    </div>
  )
}

export default function TelemetryTab() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)
  const canvasRef = useRef(null)

  const maxPressure = useHud((h) => h.maxPressure)
  const totalLeaked = useHud((h) => h.totalLeaked)
  const wallFeel = useUiStore((s) => (WALL_FEELS.includes(s.settings.wallFeel) ? s.settings.wallFeel : WALL_FEELS[0]))

  // Custom hook or direct ref to avoid re-rendering entire tab on every frame
  useEffect(() => {
    if (currentTab !== 'telemetry') return

    let raf
    const renderChart = () => {
      const cvs = canvasRef.current
      if (!cvs) return
      
      // Handle resize internally
      if (cvs.width !== cvs.clientWidth) cvs.width = cvs.clientWidth
      if (cvs.height !== cvs.clientHeight) cvs.height = cvs.clientHeight

      const ctx = cvs.getContext('2d')
      const w = cvs.width
      const h = cvs.height

      ctx.clearRect(0, 0, w, h)

      // Grid background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.lineWidth = 1
      for (let y = 0; y < h; y += 24) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      const hist = sim.telemetryHistory
      if (hist.length < 2) {
        raf = requestAnimationFrame(renderChart)
        return
      }

      // Draw Pressure Curve (Amber)
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      for (let i = 0; i < hist.length; i++) {
        const x = (i / (hist.length - 1)) * w
        const normP = Math.min(1.0, hist[i].pressure / 100.0)
        const y = h - (normP * (h - 16)) - 8
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Draw Volume Fill Curve (Cyan)
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < hist.length; i++) {
        const x = (i / (hist.length - 1)) * w
        const normV = Math.min(1.0, hist[i].volume / sim.maxCapacity)
        const y = h - (normV * (h - 16)) - 8
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      raf = requestAnimationFrame(renderChart)
    }

    raf = requestAnimationFrame(renderChart)
    return () => cancelAnimationFrame(raf)
  }, [currentTab])

  if (currentTab !== 'telemetry') return null

  return (
    <Sheet title={t('chart.title')} subtitle={t('chart.subtitle')} titleTone="text-amber-400" onClose={() => setTab('sim')}>
      <div className="relative w-full h-56 bg-slate-950/90 rounded-2xl border border-slate-800 p-2 overflow-hidden flex flex-col justify-between">
        <canvas ref={canvasRef} className="w-full h-full block"></canvas>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center font-mono">
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">{t('chart.wallFeel')}</div>
          <div className="text-xs font-bold text-cyan-400">{t(`wallFeel.${wallFeel}`)}</div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">{t('chart.leaked')}</div>
          <div className="text-xs font-bold text-rose-400">{t('unit.ml', { n: totalLeaked })}</div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">{t('chart.peak')}</div>
          <div className="text-xs font-bold text-amber-400">{t('unit.cmH2O', { n: maxPressure.toFixed(1) })}</div>
        </div>
      </div>

      <MoodStrip />
      <LineLog />
    </Sheet>
  )
}
