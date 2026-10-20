import { expect } from '@playwright/test'

// Shared helpers for the performance gate. The production build has no test hook, so
// everything goes through the real UI.

export async function startProduction(page) {
  await page.goto('/')
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas')
    return c && Math.abs(c.clientWidth - window.innerWidth) < 2
  })
  await page.touchscreen.tap(6, page.viewportSize().height / 2) // edge of the view
  await expect(page.getByText('TAP ANYWHERE TO START')).toBeHidden()
}

export const renderer = (page) => page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2')
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
})

export const quality = (page) => page.locator('[data-quality]').getAttribute('data-quality')

// Pokes the bladder every 150 ms (dents, slosh, voice lines), from inside the page so
// a throttled CPU doesn't slow the test's own input down.
export function startPoking(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
    let n = 0
    window.__poker = setInterval(() => {
      const init = {
        pointerId: 77, pointerType: 'touch', isPrimary: true, bubbles: true,
        clientX: stage.x + stage.width / 2 + Math.sin(n) * 30,
        clientY: stage.y + stage.height / 2 + Math.cos(n) * 30,
      }
      canvas.dispatchEvent(new PointerEvent('pointerdown', init))
      window.dispatchEvent(new PointerEvent('pointerup', init))
      n++
    }, 150)
  })
}

// Holds a hold-button (Empty, Clench) with the mouse until the returned release is called.
export async function hold(page, name) {
  const box = await page.getByRole('button', { name }).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  return () => page.mouse.up()
}

// Frames per second over `seconds`, from requestAnimationFrame: mean and the worst
// one-second stretch.
export function measureFps(page, seconds) {
  return page.evaluate((seconds) => new Promise((resolve) => {
    const buckets = new Array(seconds).fill(0)
    const t0 = performance.now()
    const frame = (now) => {
      const i = Math.floor((now - t0) / 1000)
      if (i >= seconds) {
        resolve({ mean: buckets.reduce((a, b) => a + b, 0) / seconds, worst: Math.min(...buckets), perSecond: buckets })
        return
      }
      if (i >= 0) buckets[i]++
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }), seconds)
}
