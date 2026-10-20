import { expect, test } from '@playwright/test'
import { openOriginal, readOriginalSim, readPortState } from './helpers/original'

function collectErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

// Nearest point to the canvas centre (scanning vertically) that isn't covered by HUD.
async function findOpenCanvasPoint(page, box) {
  return page.evaluate(({ x, y, height }) => {
    for (let offset = 0; offset < height / 2; offset += 8) {
      for (const py of [y + offset, y - offset]) {
        if (document.elementFromPoint(x, py)?.tagName === 'CANVAS') return { x, y: py }
      }
    }
    return null
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2, height: box.height })
}

// R3F sizes the canvas with a ResizeObserver after mount; until then it is the
// browser default 300x150 box. Wait for it to fill the viewport before measuring.
async function canvasBox(page) {
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible()
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas')
    return c && Math.abs(c.clientWidth - window.innerWidth) < 2 && Math.abs(c.clientHeight - window.innerHeight) < 2
  })
  return canvas.boundingBox()
}

async function startApp(page) {
  await page.goto('/')
  const box = await canvasBox(page)
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByText('TAP ANYWHERE TO START')).toBeHidden()
  return box
}

test('loads, renders the 3D canvas and starts on tap', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  await page.goto('/')

  const box = await canvasBox(page)

  const overlay = page.getByText('TAP ANYWHERE TO START')
  await expect(overlay).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('1-before-start.png') })

  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await expect(overlay).toBeHidden()

  // The simulation loop is running: the kidneys keep filling the bladder.
  const before = (await readPortState(page)).volume
  await page.waitForTimeout(1000)
  const after = (await readPortState(page)).volume
  expect(after).toBeGreaterThan(before)
  await page.screenshot({ path: testInfo.outputPath('2-started.png') })

  // Poke the 3D view where it isn't covered by HUD — this path used to throw.
  const point = await findOpenCanvasPoint(page, box)
  expect(point, 'some part of the 3D view must be touchable').not.toBeNull()
  await page.touchscreen.tap(point.x, point.y)
  await page.waitForTimeout(300)
  await page.screenshot({ path: testInfo.outputPath('3-poked.png') })

  expect(errors).toEqual([])
})

test('bladder at screen centre is not covered by controls', async ({ page }, testInfo) => {
  // Known layout gap: on a landscape phone the HUD covers the whole bladder. Fixed in M6,
  // at which point Playwright reports "expected to fail, but passed" and this line goes.
  test.fail(testInfo.project.name.includes('landscape'), 'HUD covers the bladder in landscape (ROADMAP M6)')

  const box = await startApp(page)
  const tag = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.tagName,
    [box.x + box.width / 2, box.y + box.height / 2],
  )
  expect(tag).toBe('CANVAS')
})

test('parity harness reads the original and the port', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Pixel 7', 'parity harness only needs one device')

  const loaded = await openOriginal(page)
  test.skip(!loaded, 'original needs CDN access to load Three.js')
  const original = await readOriginalSim(page)

  await page.goto('/')
  // Wait for real simulation frames: before the first frame the store still holds
  // its placeholder pressure (7.2) rather than the computed value.
  await page.waitForFunction(() => window.__vesica?.getState().telemetryLength > 10)
  const port = await readPortState(page)

  // Both start from the same resting state (a few seconds of drip apart).
  expect(Math.abs(original.volume - port.volume)).toBeLessThan(10)
  expect(Math.abs(original.pressure - port.pressure)).toBeLessThan(1)
  expect(port.kegelStamina).toBe(original.kegelStamina)
  expect(port.sphincterToneStrain).toBe(original.sphincterToneStrain)
})
