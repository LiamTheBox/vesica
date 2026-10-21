import { expect, test } from '@playwright/test'
import { startApp } from './helpers/app'

// HUD states from the original's updateUI() (ROADMAP M4). Runs on Pixel 7 only.

const STATES = [
  ['nominal', { volume: 200 }, 'NOMINAL', 'App Runtime • Hydro-Acoustics', 'RESTING (0%)', 0],
  ['distended', { volume: 400 }, 'DISTENDED', 'Active elastic stretch', 'RESTING (0%)', 0],
  ['overpressure', { volume: 650, sphincterToneStrain: 0.6 }, 'OVERPRESSURE', 'High retention wall stress', 'STRAINED (60%)', 0.35],
  ['stress leak', { volume: 650, isStressLeaking: true, sphincterToneStrain: 0.25 }, 'STRESS LEAK', 'Equilibrating peak overpressure...', 'LEAKING (25% Strain)', 0.7],
  ['total failure', { volume: 650, involuntaryVoiding: true }, 'INVOLUNTARY VOID', 'Total sphincter failure!', 'COLLAPSE (100%)', null],
  ['clenched', { volume: 200, isClenching: true }, 'NOMINAL', 'App Runtime • Hydro-Acoustics', 'CLENCHED (0%)', 0],
  ['voiding', { volume: 400, isActivelyVoiding: true, sphincterDilation: 0.5 }, 'DISTENDED', 'Active elastic stretch', 'DILATING (50%)', 0],
]

test.describe('HUD shows the organ state', () => {
  test.beforeEach(async ({ page }) => {
    await startApp(page)
    // The start tap can land on the bladder (it fills a portrait phone's width) and poke it.
    await page.evaluate(() => {
      window.__vesica.pause()
      window.__vesica.setState({ sphincterToneStrain: 0 })
    })
  })

  for (const [name, state, badge, sub, readout, vignette] of STATES) {
    test(name, async ({ page }, testInfo) => {
      await page.evaluate((s) => window.__vesica.setState(s), state)
      await expect(page.getByTestId('status-badge')).toHaveText(badge)
      await expect(page.getByText(sub)).toBeVisible()
      await expect(page.getByTestId('sphincter-readout')).toHaveText(readout)
      if (vignette === null) {
        await expect(page.getByTestId('vignette')).toHaveClass(/fatigue-vignette/) // pulsing
      } else {
        await expect(page.getByTestId('vignette')).toHaveCSS('opacity', String(vignette))
      }
      await page.screenshot({ path: testInfo.outputPath(`${name.replace(' ', '-')}.png`) })
    })
  }
})

test('settings persist across a reload and change the chat gap', async ({ page }) => {
  await startApp(page)
  await page.getByRole('button', { name: /Settings/ }).click()
  const haptics = page.getByLabel(/Mobile Haptic Vibration/)
  await expect(haptics).toBeChecked()
  await haptics.uncheck()
  await page.getByLabel(/Chats on its own at most every/).fill('20')
  await expect(page.getByText('20s')).toBeVisible()

  await page.reload()
  await startApp(page)
  await page.getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByLabel(/Mobile Haptic Vibration/)).not.toBeChecked()
  await expect(page.getByText('20s')).toBeVisible()
})
