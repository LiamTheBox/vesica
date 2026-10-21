import { expect, test } from '@playwright/test'
import { portState, startApp } from './helpers/app'

// Challenge experience on the Sim screen (ROADMAP M3). Runs on Pixel 7 only.
// Simulated time is stepped explicitly; see KNOWN_ISSUES.md (real-time waits).

const v = (page, fn, ...args) => page.evaluate(fn, args)
const banner = (page) => page.getByTestId('challenge-banner')
const resultCard = (page) => page.getByRole('dialog', { name: 'Challenge result' })

async function openChallenges(page) {
  await page.getByRole('button', { name: /Challenges/ }).click()
}

test('commute: live banner, result card, saved best', async ({ page }) => {
  await startApp(page)
  await openChallenges(page)
  await page.getByRole('button', { name: 'Start Commute Run' }).click()

  await expect(banner(page)).toContainText('COMMUTE')
  await expect(banner(page)).toContainText('/ 20 ml leaked')

  // Win: an empty-ish bladder can't leak, then fast-forward past the 60 s mark.
  await v(page, () => {
    window.__vesica.pause()
    window.__vesica.setState({ volume: 100, challengeTimer: 0.05 })
    window.__vesica.step(10)
  })
  await expect(resultCard(page)).toContainText('VICTORY! (0ml lost)')
  await expect(resultCard(page)).toContainText('New best!')
  await expect(banner(page)).toBeHidden()

  await resultCard(page).getByRole('button', { name: 'OK' }).click()
  await expect(resultCard(page)).toBeHidden()

  // The best survives a reload.
  await page.reload()
  await startApp(page)
  await openChallenges(page)
  await expect(page.getByText('Best: 0 ml lost')).toBeVisible()
})

test('precision: hold to void, result card, retry', async ({ page }) => {
  await startApp(page)
  await openChallenges(page)
  await page.getByRole('button', { name: 'Attempt Precision Void' }).click()
  await expect(banner(page)).toContainText('PRECISION')

  await v(page, () => {
    window.__vesica.pause()
    window.__vesica.setState({ baseDrip: 0 })
  })
  const empty = page.getByRole('button', { name: /EMPTY \(HOLD\)|RELAXING|VOIDING/ })
  const box = await empty.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // Step until ~200 ml has left, then let go.
  await v(page, () => {
    const s = () => window.__vesica.getState()
    for (let i = 0; i < 3000 && s().precisionStartVolume - s().volume < 197; i++) window.__vesica.step(1)
  })
  await page.mouse.up()

  await expect(resultCard(page)).toContainText(/SUCCESS \((19[0-9]|20[0-9]|210)ml\)/)
  await resultCard(page).getByRole('button', { name: 'Retry' }).click()
  await expect(resultCard(page)).toBeHidden()
  await expect(banner(page)).toContainText('PRECISION')
  expect((await portState(page)).volume).toBe(520)
})
