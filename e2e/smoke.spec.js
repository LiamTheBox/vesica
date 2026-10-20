import { expect, test } from '@playwright/test'
import { canvasBox, collectErrors, findOpenCanvasPoint, portState, startApp } from './helpers/app'
import { openOriginal, readOriginalSim } from './helpers/original'

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
  const before = (await portState(page)).volume
  await page.waitForTimeout(1000)
  const after = (await portState(page)).volume
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

test('the middle of the stage is the bladder, not a control', async ({ page }) => {
  await startApp(page)
  const tag = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.tagName
  })
  expect(tag).toBe('CANVAS')
})

test('parity harness reads the original and the port', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Pixel 7', 'parity harness only needs one device')

  const loaded = await openOriginal(page)
  test.skip(!loaded, 'original needs CDN access to load Three.js')
  const original = await readOriginalSim(page)

  await page.goto('/')
  // Wait for real simulation frames: before the first frame the sim still holds
  // its placeholder pressure (7.2) rather than the computed value.
  await page.waitForFunction(() => window.__vesica?.getState().telemetryLength > 10)
  const port = await portState(page)

  // Both start from the same resting state (a few seconds of drip apart).
  expect(Math.abs(original.volume - port.volume)).toBeLessThan(10)
  expect(Math.abs(original.pressure - port.pressure)).toBeLessThan(1)
  expect(port.kegelStamina).toBe(original.kegelStamina)
  expect(port.sphincterToneStrain).toBe(original.sphincterToneStrain)
})
