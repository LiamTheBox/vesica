import { expect, test } from '@playwright/test'
import { startApp } from './helpers/app'

// Mobile layout (ROADMAP M6), on every device profile.

const rectOf = (page, selector) => page.evaluate((sel) => {
  const r = document.querySelector(sel).getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}, selector)

test('nothing overflows, overlaps or leaves the screen', async ({ page }) => {
  await startApp(page)
  const report = await page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const buttons = [...document.querySelectorAll('button')]
      .map((el) => ({ name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
    const offscreen = buttons.filter(({ r }) => r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5).map((b) => b.name)
    const overlaps = []
    for (let i = 0; i < buttons.length; i++) {
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i].r
        const b = buttons[j].r
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (w > 1 && h > 1) overlaps.push(`${buttons[i].name} × ${buttons[j].name}`)
      }
    }
    return { overflowX: document.documentElement.scrollWidth - vw, offscreen, overlaps }
  })
  expect(report.overflowX).toBeLessThanOrEqual(0)
  expect(report.offscreen).toEqual([])
  expect(report.overlaps).toEqual([])
})

test('no button label is clipped', async ({ page }) => {
  await startApp(page)
  // Also check the labels that appear while holding / voiding.
  await page.evaluate(() => window.__vesica.pause())
  const check = () => page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .map((el) => `${el.textContent.trim().slice(0, 30)} (${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight})`),
  )
  expect(await check()).toEqual([])
  for (const state of [{ isClenching: true }, { isAttemptingVoid: true, voidLatencyTimer: 0.4 }, { isAttemptingVoid: true, isActivelyVoiding: true, clenchExhausted: true, isClenching: false }]) {
    await page.evaluate((s) => window.__vesica.setState(s), state)
    expect(await check(), JSON.stringify(state)).toEqual([])
  }
})

test('the stage leaves real room for the bladder', async ({ page }) => {
  await startApp(page)
  const stage = await rectOf(page, '[data-testid="stage"]')
  const viewport = page.viewportSize()
  expect(stage.width * stage.height).toBeGreaterThan(0.2 * viewport.width * viewport.height)
  expect(stage.height).toBeGreaterThan(150)
})

test('a full bladder is framed inside the stage', async ({ page }, testInfo) => {
  await startApp(page)
  // Full and held still: paused, no jiggle or strain tremor, so the wall's springs
  // settle on one shape (they run on frame time, so how long that takes varies).
  await page.evaluate(() => {
    window.__vesica.pause()
    window.__vesica.setState({ volume: 750, jiggleIntensity: 0, sphincterToneStrain: 0, sloshAngleX: 0, sloshAngleZ: 0 })
  })

  const measure = () => page.evaluate(() => {
    const { camera, scene, size } = window.__vesica.three()
    let wall
    scene.traverse((o) => { if (!wall && o.isMesh && o.renderOrder === 10) wall = o })
    const pos = wall.geometry.attributes.position
    const v = new wall.position.constructor()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < pos.count; i += 7) {
      v.fromBufferAttribute(pos, i).applyMatrix4(wall.matrixWorld).project(camera)
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
    return { box: { minX, minY, maxX, maxY }, stage: { x: r.x, y: r.y, width: r.width, height: r.height } }
  })
  let { box, stage } = await measure()
  for (let tries = 0; tries < 60; tries++) {
    await page.waitForTimeout(400)
    const next = await measure()
    const moved = Math.max(...['minX', 'minY', 'maxX', 'maxY'].map((k) => Math.abs(next.box[k] - box[k])))
    ;({ box, stage } = next)
    if (moved < 0.5) break
  }
  await page.screenshot({ path: testInfo.outputPath('full-bladder.png') })

  const tolerance = 6
  expect(box.minY).toBeGreaterThanOrEqual(stage.y - tolerance)
  expect(box.maxY).toBeLessThanOrEqual(stage.y + stage.height + tolerance)
  expect(box.minX).toBeGreaterThanOrEqual(stage.x - tolerance)
  expect(box.maxX).toBeLessThanOrEqual(stage.x + stage.width + tolerance)
  // And it's not a speck: at least a third of the stage's height.
  expect(box.maxY - box.minY).toBeGreaterThan(stage.height / 3)
})

test('tabs open as sheets that fit the screen', async ({ page }) => {
  await startApp(page)
  for (const tab of ['Telemetry', 'Challenges', 'Settings']) {
    await page.getByRole('button', { name: new RegExp(tab) }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Measure after the slide-up animation (it starts 24 px low).
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    const r = await dialog.boundingBox()
    const viewport = page.viewportSize()
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.y + r.height).toBeLessThanOrEqual(viewport.height + 0.5)
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
  }
})
