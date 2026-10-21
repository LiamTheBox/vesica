import { expect } from '@playwright/test'

export function collectErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

// R3F sizes the canvas with a ResizeObserver after mount; until then it is the
// browser default 300x150 box. Wait for it to fill the viewport before measuring.
// The 3D scene is a lazy chunk, so the canvas mounts after the page's load event; on
// the dev server under two software-rendered pages that can take several seconds.
export async function canvasBox(page) {
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas')
    return c && Math.abs(c.clientWidth - window.innerWidth) < 2 && Math.abs(c.clientHeight - window.innerHeight) < 2
  })
  return canvas.boundingBox()
}

// Loads the port and starts it: in the sandbox by default (the mode most specs were
// written for), or with `mode: 'arcade'` the way a player does, with a tap anywhere
// (arcade is the game's default). Returns the canvas box.
export async function startApp(page, { mode = 'sandbox' } = {}) {
  await page.goto('/')
  const box = await canvasBox(page)
  if (mode === 'sandbox') await page.getByRole('button', { name: /Sandbox/ }).tap()
  else await page.touchscreen.tap(box.x + 8, box.y + box.height / 2)
  await expect(page.getByText('TAP ANYWHERE TO START')).toBeHidden()
  return box
}

// Nearest point to the canvas centre (scanning vertically) that isn't covered by HUD.
export async function findOpenCanvasPoint(page, box) {
  return page.evaluate(({ x, y, height }) => {
    for (let offset = 0; offset < height / 2; offset += 8) {
      for (const py of [y + offset, y - offset]) {
        if (document.elementFromPoint(x, py)?.tagName === 'CANVAS') return { x, y: py }
      }
    }
    return null
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2, height: box.height })
}

export const portState = (page) => page.evaluate(() => window.__vesica.getState())
export const portUi = (page) => page.evaluate(() => window.__vesica.getUi())
