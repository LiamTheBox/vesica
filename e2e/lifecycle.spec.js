import { expect, test } from '@playwright/test'
import { startApp } from './helpers/app'

// Background behaviour (ROADMAP M7) and the challenge wake lock (M6).

// Pretends the app went to the background (or came back), as switching apps does.
const setHidden = (page, hidden) => page.evaluate((hidden) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
  document.dispatchEvent(new Event('visibilitychange'))
}, hidden)

test('in the background, rendering, the simulation and audio pause', async ({ page }) => {
  await page.addInitScript(() => {
    // Keep hold of the game's AudioContext and count speech cancels.
    const Native = window.AudioContext
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args)
        window.__audioCtx = this
      }
    }
    window.__speechCancels = 0
    const cancel = speechSynthesis.cancel.bind(speechSynthesis)
    speechSynthesis.cancel = () => { window.__speechCancels++; cancel() }
  })
  await startApp(page)
  await expect.poll(() => page.evaluate(() => window.__audioCtx?.state)).toBe('running')
  const urgeTimer = () => page.evaluate(() => window.__vesica.getState().urgeWaveTimer)

  const cancelsBefore = await page.evaluate(() => window.__speechCancels)
  await setHidden(page, true)
  expect(await page.evaluate(() => window.__vesica.three().frameloop)).toBe('never')
  await expect.poll(() => page.evaluate(() => window.__audioCtx.state)).toBe('suspended')
  const frozen = await urgeTimer()
  await page.waitForTimeout(1500)
  expect(await urgeTimer()).toBe(frozen)
  expect(await page.evaluate(() => window.__speechCancels)).toBe(cancelsBefore + 1) // the queued voice line was dropped

  await setHidden(page, false)
  expect(await page.evaluate(() => window.__vesica.three().frameloop)).toBe('always')
  await expect.poll(() => page.evaluate(() => window.__audioCtx.state)).toBe('running')
  await expect.poll(urgeTimer).not.toBe(frozen)
})

test.describe('the screen stays awake during a challenge', () => {
  test.beforeEach(async ({ page }) => {
    // A Wake Lock API stand-in that records what the game asks for.
    await page.addInitScript(() => {
      const locks = []
      window.__locks = locks
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            const lock = new EventTarget()
            lock.released = false
            lock.release = async () => {
              if (lock.released) return
              lock.released = true
              lock.dispatchEvent(new Event('release'))
            }
            locks.push(lock)
            return lock
          },
        },
      })
    })
    await startApp(page)
  })

  const held = (page) => page.evaluate(() => window.__locks.filter((l) => !l.released).length)
  const requests = (page) => page.evaluate(() => window.__locks.length)

  test('takes the lock again after the app comes back', async ({ page }) => {
    await page.evaluate(() => window.__vesica.act('startCommuteChallenge'))
    await expect.poll(() => held(page)).toBe(1)

    // The browser drops the lock when the page is hidden.
    await setHidden(page, true)
    await page.evaluate(() => window.__locks.forEach((l) => l.release()))
    await setHidden(page, false)
    await expect.poll(() => held(page)).toBe(1)
    expect(await requests(page)).toBe(2)
  })

  test('a reset lets the screen sleep; Retry ends up with exactly one lock', async ({ page }) => {
    await page.evaluate(() => window.__vesica.act('startCommuteChallenge'))
    await expect.poll(() => held(page)).toBe(1)
    // Retry: reset + start in one go, while the first lock is still held.
    await page.evaluate(() => window.__vesica.act('startCommuteChallenge'))
    await page.waitForTimeout(200)
    expect(await held(page)).toBe(1)

    await page.evaluate(() => window.__vesica.act('resetOrgan'))
    await expect.poll(() => held(page)).toBe(0)
  })
})
