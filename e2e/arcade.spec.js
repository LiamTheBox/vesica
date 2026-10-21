import { expect, test } from '@playwright/test'
import { portState, startApp } from './helpers/app'

// Arcade mode, the default (requested 2026-10-21). Runs on Pixel 7 only.
// Simulated time is stepped explicitly; see KNOWN_ISSUES.md (real-time waits).

const v = (page, fn, ...args) => page.evaluate(fn, args)
const step = (page, frames) => v(page, ([n]) => window.__vesica.step(n), frames)
const banner = (page) => page.getByTestId('challenge-banner')
const resultCard = (page) => page.getByRole('dialog', { name: 'Challenge result' })

// Presses and holds a hold-button with the mouse until `page.mouse.up()`.
async function hold(page, name) {
  const box = await page.getByRole('button', { name }).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
}

test('a tap on the start screen starts an arcade run; the Sandbox button skips it', async ({ page }) => {
  await startApp(page, { mode: 'arcade' })
  await expect(banner(page)).toContainText('ARCADE')
  const run = await portState(page)
  expect(run.activeChallenge).toBe('arcade')
  expect(run.volume).toBeGreaterThanOrEqual(300)

  await startApp(page)
  expect((await portState(page)).activeChallenge).toBe(null)
  await expect(banner(page)).toBeHidden()
})

test('an announced urge, clenched on time, scores a perfect', async ({ page }) => {
  await startApp(page, { mode: 'arcade' })
  await v(page, () => {
    window.__vesica.pause()
    window.__vesica.setState({ volume: 560, urgeWaveTimer: 1 })
  })
  await step(page, 6)
  await expect(page.getByText('URGE INCOMING: CLENCH AS IT LANDS')).toBeVisible()
  await hold(page, /CLENCH/)
  await step(page, 90) // the wave lands 1.2 s after the warning, onto the held clench
  await expect(banner(page)).toContainText('PERFECT +50')
  await page.mouse.up()
})

test('emptying banks the score, and the best shows on the Challenges card', async ({ page }) => {
  await startApp(page, { mode: 'arcade' })
  await v(page, () => {
    window.__vesica.pause()
    window.__vesica.setState({ volume: 600 })
  })
  await hold(page, /EMPTY \(HOLD\)/)
  await step(page, 70) // 1 s to relax the valve, then it flows and the run banks
  await page.mouse.up()
  await expect(resultCard(page)).toContainText(/BANKED [\d,]+ PTS/)
  await expect(resultCard(page)).toContainText('New best!')
  await resultCard(page).getByRole('button', { name: 'OK' }).click()

  await page.getByRole('button', { name: /Challenges/ }).click()
  await expect(page.getByText(/Best: [\d,]+ pts/)).toBeVisible()
})
