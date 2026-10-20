import { expect, test } from '@playwright/test'
import { startApp } from './helpers/app'

// Graphics quality setting (ROADMAP M7). How Auto adapts is covered by the perf gate
// (e2e/perf) and the unit tests of settings/quality.js.

// Pixel ratio actually used by the canvas, the tier, and the liquid's material.
const rendering = (page) => page.evaluate(() => {
  const { gl, scene } = window.__vesica.three()
  const canvas = gl.domElement
  let fluid
  scene.traverse((o) => { if (!fluid && o.isMesh && o.renderOrder === 1 && o.material.isMeshPhysicalMaterial) fluid = o })
  return {
    tier: document.querySelector('[data-quality]').dataset.quality,
    dpr: Math.round((canvas.width / canvas.clientWidth) * 100) / 100,
    transmission: fluid.material.transmission,
    transparent: fluid.material.transparent,
    transmissionScale: gl.transmissionResolutionScale,
  }
})

test('the Graphics setting picks the tier, and it survives a reload', async ({ page }) => {
  await startApp(page)
  await page.getByRole('button', { name: /Settings/ }).click()
  const picker = page.getByRole('radiogroup', { name: 'Graphics quality' })
  await expect(picker.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('graphics-hint')).toContainText('now High')

  // Pixel 7: devicePixelRatio 2.625, capped per tier.
  const expected = {
    High: { tier: 'high', dpr: 2, transmission: 0.55, transparent: false, transmissionScale: 0.5 },
    Medium: { tier: 'medium', dpr: 1.5, transmission: 0, transparent: true, transmissionScale: 1 },
    Low: { tier: 'low', dpr: 1, transmission: 0, transparent: true, transmissionScale: 1 },
  }
  for (const [label, want] of Object.entries(expected)) {
    await picker.getByRole('radio', { name: label }).click()
    await expect(picker.getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true')
    await expect.poll(() => rendering(page)).toEqual(want)
  }

  await picker.getByRole('radio', { name: 'Medium' }).click()
  await page.reload()
  await startApp(page)
  await expect.poll(() => rendering(page)).toMatchObject({ tier: 'medium', dpr: 1.5 })
})

test('choosing Auto again re-detects from the top tier', async ({ page }) => {
  // This device settled on Low earlier.
  await page.addInitScript(() => localStorage.setItem('vesica.quality', JSON.stringify({ tier: 'low' })))
  await startApp(page)
  expect((await rendering(page)).tier).toBe('low')

  await page.getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByTestId('graphics-hint')).toContainText('now Low')
  await page.getByRole('radio', { name: 'High' }).click()
  await page.getByRole('radio', { name: 'Auto' }).click()
  await expect(page.getByTestId('graphics-hint')).toContainText('now High')
  await expect.poll(() => rendering(page)).toMatchObject({ tier: 'high', dpr: 2 })
})
