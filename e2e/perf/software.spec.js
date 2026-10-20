import { expect, test } from '@playwright/test'
import { measureFps, quality, startPoking, startProduction } from './play'

// ROADMAP M7 gate, on software WebGL as a stand-in for a weak phone GPU: Auto quality
// notices, steps down, and remembers.

test('Auto quality steps down to a playable frame rate and remembers it', async ({ page }, testInfo) => {
  test.setTimeout(150_000)
  await startProduction(page)
  expect(await quality(page)).toBe('high')
  await startPoking(page)

  // Each step: ~3 s settling + two slow 2 s windows. Software rendering is slow, so
  // allow plenty of wall-clock time.
  await expect.poll(() => quality(page), { timeout: 90_000, intervals: [1000] }).toBe('low')
  await page.waitForTimeout(2000)
  const fps = await measureFps(page, 5)
  testInfo.annotations.push({ type: 'fps at low', description: JSON.stringify(fps) })
  expect(fps.mean).toBeGreaterThanOrEqual(30)

  // The next visit starts at the tier this device settled on.
  await page.reload()
  await page.waitForSelector('[data-quality]')
  expect(await quality(page)).toBe('low')
})
