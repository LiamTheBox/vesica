import { expect, test } from '@playwright/test'
import { findOpenCanvasPoint, portState, startApp } from './helpers/app'

// Touch and tactile input (ROADMAP M5). Multi-finger gestures go through the Chrome
// DevTools Protocol, which, unlike page.touchscreen, can hold several fingers at once.

async function fingers(page) {
  const cdp = await page.context().newCDPSession(page)
  const active = new Map()
  const send = (type) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: [...active.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })),
  })
  return {
    down: (id, x, y) => { active.set(id, { x, y }); return send('touchStart') },
    move: (id, x, y) => { active.set(id, { x, y }); return send('touchMove') },
    // The protocol infers which fingers changed by comparing active-point lists: lifting
    // one finger while others stay down is a touchMove listing the ones still down; only
    // the last lift is a touchEnd (which must list no points).
    up: (id) => { active.delete(id); return send(active.size ? 'touchMove' : 'touchEnd') },
  }
}

const center = async (locator) => {
  const b = await locator.boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
// Chromium delivers touch moves on the next animation frame (a few fps here), so poll
// for the expected state instead of reading it once.
const stateOf = (page, key) => expect.poll(async () => (await portState(page))[key])
const eventsOf = (page, type) => page.evaluate((t) => window.__vesica.events.filter((e) => e.type === t), type)
const pixel7Only = (testInfo) => test.skip(testInfo.project.name !== 'Pixel 7', 'gesture logic runs on Pixel 7 only')

test.describe('multi-touch', () => {
  let bladder

  test.beforeEach(async ({ page }, testInfo) => {
    pixel7Only(testInfo)
    const box = await startApp(page)
    bladder = await findOpenCanvasPoint(page, box)
    // Paused so clench stamina can't run out mid-test; touches still act on the sim.
    await page.evaluate(() => {
      window.__vesica.pause()
      window.__vesica.setState({ sphincterToneStrain: 0, urgeWaveTimer: 999 })
      window.__vesica.clearEvents()
    })
  })

  test('hold Clench with one thumb while poking with the other', async ({ page }) => {
    const touch = await fingers(page)
    const clench = await center(page.getByRole('button', { name: /CLENCH/ }))

    await touch.down(1, clench.x, clench.y)
    await stateOf(page, 'isClenching').toBe(true)

    await touch.down(2, bladder.x, bladder.y)
    for (let i = 1; i <= 4; i++) await touch.move(2, bladder.x + i * 8, bladder.y)
    await stateOf(page, 'isClenching').toBe(true)
    await expect.poll(async () => (await eventsOf(page, 'poke')).length).toBeGreaterThan(1)
    expect((await eventsOf(page, 'poke'))[0]).toMatchObject({ touch: true })

    await touch.up(2)
    await stateOf(page, 'isClenching').toBe(true)
    await touch.up(1)
    await stateOf(page, 'isClenching').toBe(false)
  })

  test('a held button keeps holding when the thumb drifts off it', async ({ page }) => {
    const touch = await fingers(page)
    const button = page.getByRole('button', { name: /CLENCH/ })
    const c = await center(button)
    const box = await button.boundingBox()
    await touch.down(1, c.x, c.y)
    await touch.move(1, c.x, box.y - 30) // well above the button
    await stateOf(page, 'isClenching').toBe(true)
    await touch.up(1)
    await stateOf(page, 'isClenching').toBe(false)
  })

  test('pinching in Squeeze mode squeezes; spreading eases off', async ({ page }) => {
    await page.evaluate(() => window.__vesica.setUi({ interactionMode: 'squeeze' }))
    const touch = await fingers(page)
    await touch.down(1, bladder.x - 80, bladder.y)
    await touch.down(2, bladder.x + 80, bladder.y)
    const start = (await portState(page)).targetSqueezeY
    for (let i = 1; i <= 4; i++) {
      await touch.move(1, bladder.x - 80 + i * 10, bladder.y)
      await touch.move(2, bladder.x + 80 - i * 10, bladder.y)
    }
    await stateOf(page, 'targetSqueezeY').toBeGreaterThan(start)
    const squeezed = (await portState(page)).targetSqueezeY
    await touch.move(2, bladder.x + 120, bladder.y)
    await stateOf(page, 'targetSqueezeY').toBeLessThan(squeezed)
    await touch.up(2)
    await touch.up(1)
    await stateOf(page, 'targetSqueezeY').toBe(0)
  })

  test('pinching with another tool zooms the camera and never pokes', async ({ page }) => {
    const distance = () => page.evaluate(() => window.__vesica.three().camera.position.length())
    const before = await distance()
    const touch = await fingers(page)
    await touch.down(1, bladder.x - 30, bladder.y)
    await touch.down(2, bladder.x + 30, bladder.y)
    for (let i = 1; i <= 6; i++) {
      await touch.move(1, bladder.x - 30 - i * 15, bladder.y)
      await touch.move(2, bladder.x + 30 + i * 15, bladder.y)
    }
    await touch.up(2)
    await touch.up(1)
    expect(await distance()).toBeLessThan(before) // fingers apart = zoom in
    // Only the first finger's touch-down pokes; the pinch itself doesn't.
    expect((await eventsOf(page, 'poke')).length).toBeLessThanOrEqual(1)
  })

  test('the tool rail switches tools', async ({ page }) => {
    const slap = page.getByRole('radio', { name: 'Slap' })
    await slap.tap()
    await expect(slap).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Poke' })).toHaveAttribute('aria-checked', 'false')
    expect((await page.evaluate(() => window.__vesica.getUi())).interactionMode).toBe('slap')
  })
})

test('every button is at least 44 px and named', async ({ page }) => {
  await startApp(page)
  const problems = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('button')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || getComputedStyle(el).visibility === 'hidden') continue
      const name = el.getAttribute('aria-label') || el.textContent.trim()
      if (r.width < 43.5 || r.height < 43.5) out.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`)
      if (!name) out.push(`unnamed button at ${Math.round(r.x)},${Math.round(r.y)}`)
    }
    return out
  })
  expect(problems).toEqual([])
})

test('gestures never scroll or zoom the page', async ({ page }) => {
  const box = await startApp(page)
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 400)
  const { scrollY, scale } = await page.evaluate(() => ({ scrollY: window.scrollY, scale: window.visualViewport.scale }))
  expect(scrollY).toBe(0)
  expect(scale).toBe(1)
})
