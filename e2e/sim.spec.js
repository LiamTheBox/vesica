import { expect, test } from '@playwright/test'
import { portState, portUi, startApp } from './helpers/app'
import { openOriginal } from './helpers/original'

// Simulation behaviour doesn't depend on screen size: this file only runs on Pixel 7
// (see playwright.config.js).

const vesica = (page, fn, ...args) => page.evaluate(fn, args)

// Headless Chromium renders WebGL in software at a few fps, and each frame advances the
// sim by at most 0.08 s, so real-time waits are unreliable. Tests that depend on timing
// pause the frame loop and step simulated time explicitly (60 steps = 1 s).
const pause = (page) => vesica(page, () => window.__vesica.pause())
const step = (page, frames) => vesica(page, ([n]) => window.__vesica.step(n), frames)

test('React stays idle while the simulation runs', async ({ page }) => {
  await startApp(page)
  await page.waitForTimeout(500)
  await vesica(page, () => window.__vesica.resetRenders())
  await page.waitForTimeout(3000)
  const renders = await vesica(page, () => ({ ...window.__vesica.renders }))

  // Before M1 the whole app re-rendered every frame (~180 times in 3 s).
  expect(renders.App ?? 0).toBe(0)
  expect(renders.HUD ?? 0).toBe(0)
  // The telemetry bar only re-renders when a displayed number changes.
  expect(renders.TelemetryBar ?? 0).toBeLessThanOrEqual(20)
})

test.describe('same scenario in the original and the port', () => {
  test('a cough at 80% full forces a stress leak', async ({ page }) => {
    test.skip(!(await openOriginal(page)), 'original needs CDN access')
    // The leak reseals within ~0.25 s as the cough fades, so check what it left behind.
    // The original can't be stepped, so give its slow software-rendered loop time.
    await page.evaluate('sim.volume = 600; triggerCoughImpulse()')
    await expect.poll(() => page.evaluate('sim.totalLeakedVolume'), { timeout: 20000 }).toBeGreaterThan(0)

    await startApp(page)
    await pause(page)
    await vesica(page, () => {
      window.__vesica.clearEvents()
      window.__vesica.setState({ volume: 600 })
      window.__vesica.act('cough')
    })
    await step(page, 60)
    expect((await portState(page)).totalLeakedVolume).toBeGreaterThan(0)
    const events = await vesica(page, () => window.__vesica.events.map((e) => e.type))
    expect(events).toEqual(expect.arrayContaining(['cough', 'leakStart', 'leakEnd']))
  })

  test('an urge wave arrives over 45% full and shows its warning', async ({ page }) => {
    test.skip(!(await openOriginal(page)), 'original needs CDN access')
    await page.evaluate('sim.volume = 400; sim.urgeWaveTimer = 0')
    await expect(page.locator('#urgeWaveWarning')).toBeVisible()

    await startApp(page)
    await pause(page)
    await vesica(page, () => window.__vesica.setState({ volume: 400, urgeWaveTimer: 0 }))
    await step(page, 1)
    await expect(page.getByText('DETRUSOR CONTRACTION WAVE INCOMING!')).toBeVisible()
    await step(page, 30)
    expect((await portState(page)).detrusorSpasmIntensity).toBeCloseTo(1, 1)
    await step(page, 3 * 60 + 5)
    await expect(page.getByText('DETRUSOR CONTRACTION WAVE INCOMING!')).toBeHidden()
  })
})

// Presses and holds a button with the mouse (true multi-touch holds are covered in M5).
async function hold(page, locator) {
  const box = await locator.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
}

test.describe('controls drive the simulation', () => {
  test.beforeEach(async ({ page }) => {
    await startApp(page)
  })

  test('drinking water queues 180 ml', async ({ page }) => {
    await page.getByRole('button', { name: /Water/ }).click()
    const state = await portState(page)
    expect(state.activeBeverages).toHaveLength(1)
    expect(state.activeBeverages[0].rem).toBeGreaterThan(170)
  })

  test('holding Clench clenches until released', async ({ page }) => {
    const button = page.getByRole('button', { name: /CLENCH/ })
    await hold(page, button)
    await expect(button).toContainText('CLENCHING!')
    expect((await portState(page)).isClenching).toBe(true)
    await page.mouse.up()
    await expect(button).toContainText('CLENCH (HOLD)')
    expect((await portState(page)).isClenching).toBe(false)
  })

  test('holding Empty starts voiding after the 1 s latency', async ({ page }) => {
    await pause(page)
    await vesica(page, () => window.__vesica.setState({ volume: 400 }))
    // The label changes while held, so find the button by all three of its labels.
    const button = page.getByRole('button', { name: /EMPTY \(HOLD\)|RELAXING VALVE|VOIDING/ })
    await hold(page, button)
    await step(page, 57) // 0.95 s
    await expect(button).toContainText('RELAXING VALVE…')
    expect((await portState(page)).isActivelyVoiding).toBe(false)
    await step(page, 6) // 1.05 s
    await expect(button).toContainText('VOIDING…')
    expect((await portState(page)).flowRate).toBeGreaterThan(0)
    await page.mouse.up()
    await expect(button).toContainText('EMPTY (HOLD)')
  })

  test('the commute challenge runs and reports its result', async ({ page }) => {
    await page.getByRole('button', { name: /Challenges/ }).click()
    await page.getByRole('button', { name: 'Start Commute Run' }).click()

    const ui = await portUi(page)
    expect(ui.currentTab).toBe('sim')
    expect(ui.hud.activeChallenge).toBe('commute')
    expect((await portState(page)).volume).toBeGreaterThan(570)

    // Fast-forward to the end of the run.
    await vesica(page, () => {
      window.__vesica.pause()
      window.__vesica.setState({ challengeTimer: 0.05 })
      window.__vesica.step(10)
      window.__vesica.resume()
    })
    expect((await portUi(page)).challengeResults.commute.text).toMatch(/^(VICTORY!|FAILED) \(\d+ml lost\)$/)

    // The result card covers the screen until dismissed (M3), then the tab keeps the result.
    await page.getByRole('dialog', { name: 'Challenge result' }).getByRole('button', { name: 'OK' }).click()
    await page.getByRole('button', { name: /Challenges/ }).click()
    await expect(page.getByText(/^(VICTORY!|FAILED) \(\d+ml lost\)$/)).toBeVisible()
  })
})
