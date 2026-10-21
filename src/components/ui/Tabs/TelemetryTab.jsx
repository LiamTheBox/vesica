import { useEffect, useRef } from 'react'
import { useHud, useUiStore } from '../../../store/useUiStore'
import { sim } from '../../../sim/engine'
import { WALL_FEELS } from '../../../settings/settings'
import Sheet from '../Sheet'

export default function TelemetryTab() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)
  const canvasRef = useRef(null)

  const maxPressure = useHud((h) => h.maxPressure)
  const totalLeaked = useHud((h) => h.totalLeaked)
  const wallFeel = useUiStore((s) => WALL_FEELS.find((feel) => feel.key === s.settings.wallFeel) ?? WALL_FEELS[0])

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
    <Sheet title="Pressure Chart" subtitle="Pressure (cmH₂O) and volume (ml), live" titleTone="text-amber-400" onClose={() => setTab('sim')}>
      <div className="relative w-full h-56 bg-slate-950/90 rounded-2xl border border-slate-800 p-2 overflow-hidden flex flex-col justify-between">
        <canvas ref={canvasRef} className="w-full h-full block"></canvas>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center font-mono">
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">Wall Feel</div>
          <div className="text-xs font-bold text-cyan-400">{wallFeel.label}</div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">Total Leaked</div>
          <div className="text-xs font-bold text-rose-400">{totalLeaked} ml</div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">Peak Pressure</div>
          <div className="text-xs font-bold text-amber-400">{maxPressure.toFixed(1)} cmH₂O</div>
        </div>
      </div>
    </Sheet>
  )
}
