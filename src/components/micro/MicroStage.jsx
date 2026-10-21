import { useEffect, useRef } from 'react'
import { sim } from '../../sim/engine'
import { microPointer } from '../../sim/micro/runner'
import { useUiStore } from '../../store/useUiStore'
import { drawMicro, playArea } from './draw'

// The microgames' play area over the stage (M8). It draws the running game every frame and
// feeds it one pointer: a finger or the left mouse button. Extra fingers and other buttons
// are ignored, so nothing ever needs them. Space or Enter is the press too. The run pauses
// while a sheet is open over it.
export default function MicroStage() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let width = 0
    let height = 0
    let frame = 0
    let pointerId = null

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    // The pointer's place in the play area's unit square.
    const place = (e) => {
      const rect = canvas.getBoundingClientRect()
      const area = playArea(rect.width, rect.height)
      return [(e.clientX - rect.left - area.left) / area.size, (e.clientY - rect.top - area.top) / area.size]
    }
    const onDown = (e) => {
      if (pointerId !== null || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
      e.preventDefault()
      pointerId = e.pointerId
      canvas.setPointerCapture?.(e.pointerId)
      microPointer(sim, true, ...place(e))
    }
    const onMove = (e) => {
      if (e.pointerId === pointerId) microPointer(sim, true, ...place(e))
    }
    const onUp = (e) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      microPointer(sim, false, ...place(e))
    }
    const onKey = (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      if (!e.repeat && pointerId === null) microPointer(sim, e.type === 'keydown')
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('lostpointercapture', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)

    const draw = () => {
      frame = requestAnimationFrame(draw)
      drawMicro(ctx, sim.micro, width, height)
    }
    frame = requestAnimationFrame(draw)

    // Paused while a sheet (a tab, the drinks menu) covers it.
    const pause = (state) => {
      if (sim.micro) sim.micro.paused = state.currentTab !== 'sim'
    }
    pause(useUiStore.getState())
    const unsubscribe = useUiStore.subscribe(pause)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      unsubscribe()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('lostpointercapture', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      data-testid="micro-stage"
      aria-label="Microgame: tap, hold or drag; Space presses"
      className="absolute inset-0 w-full h-full pointer-events-auto touch-none select-none"
    />
  )
}
