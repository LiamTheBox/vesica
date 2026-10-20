import { expect, test } from '@playwright/test'
import { hold, measureFps, quality, renderer, startPoking, startProduction } from './play'

// ROADMAP M7 gate, on the real GPU: smooth under a phone-class CPU, and no leaks.

test.beforeEach(async ({ page }) => {
  await startProduction(page)
  const gpu = await renderer(page)
  test.skip(/SwiftShader|llvmpipe|software/i.test(gpu), `needs a hardware GPU (got ${gpu})`)
})

test('holds 45+ fps with a 4x slower CPU over 10 s of heavy play', async ({ page, context }, testInfo) => {
  // Full bladder, voiding (stream + splash), pokes every 150 ms.
  await page.getByRole('button', { name: /Brew/ }).click()
  await page.waitForTimeout(2000)
  await startPoking(page)
  await hold(page, /EMPTY \(HOLD\)/)
  await expect(page.getByRole('button', { name: /VOIDING/ })).toBeVisible()

  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.waitForTimeout(1000)
  const fps = await measureFps(page, 10)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  testInfo.annotations.push({ type: 'fps', description: JSON.stringify(fps) })
  expect(fps.worst).toBeGreaterThanOrEqual(45)
  // Auto quality had no reason to step down.
  expect(await quality(page)).toBe('high')
})

test('memory stays flat over 2 minutes of play', async ({ page, context }, testInfo) => {
  test.setTimeout(200_000)
  const cdp = await context.newCDPSession(page)
  const usage = async () => {
    await cdp.send('HeapProfiler.collectGarbage')
    const { usedSize } = await cdp.send('Runtime.getHeapUsage')
    const { nodes, jsEventListeners } = await cdp.send('Memory.getDOMCounters')
    return { heapMB: usedSize / 2 ** 20, nodes, listeners: jsEventListeners }
  }

  await startPoking(page)
  // One round of everything a session does: drinks, voiding, a cough, the cutaway, a tab.
  const round = async () => {
    await page.getByRole('button', { name: /Water/ }).click()
    await page.getByRole('button', { name: /Brew/ }).click()
    await page.getByRole('button', { name: 'Cough' }).click()
    await page.getByRole('button', { name: 'Cutaway' }).click()
    const release = await hold(page, /EMPTY \(HOLD\)/)
    await page.waitForTimeout(4000)
    await release()
    await page.getByRole('button', { name: 'Cutaway' }).click()
    await page.getByRole('button', { name: /Telemetry/ }).click()
    await page.waitForTimeout(500)
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
    await page.waitForTimeout(1000)
  }

  for (let i = 0; i < 3; i++) await round() // warm up: lazy chunks, shaders, caches
  const before = await usage()
  const end = Date.now() + 120_000
  while (Date.now() < end) await round()
  const after = await usage()

  testInfo.annotations.push({ type: 'memory', description: JSON.stringify({ before, after }) })
  expect(after.heapMB - before.heapMB).toBeLessThan(2)
  expect(after.listeners - before.listeners).toBeLessThanOrEqual(10)
  expect(after.nodes).toBeLessThan(before.nodes * 1.2 + 50)
})
