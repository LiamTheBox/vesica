import { expect, test } from '@playwright/test'

// Installable, offline-capable app (ROADMAP M6). Runs against the production build
// (`vite preview`), because the service worker only exists there.

test('manifest and icons are installable', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(href)).json()
  expect(manifest).toMatchObject({ short_name: 'Vesica 3D', display: 'standalone', theme_color: '#020617' })

  const sizes = manifest.icons.map((i) => i.sizes)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  for (const icon of [...manifest.icons.map((i) => i.src), 'icons/apple-touch-icon.png']) {
    const res = await request.get(icon)
    expect(res.status(), icon).toBe(200)
    expect(res.headers()['content-type']).toBe('image/png')
  }
  await expect(page).toHaveTitle('Vesica 3D')
})

test('plays offline after the first visit', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // The first load isn't controlled yet; reload so the service worker takes over.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('canvas').first()).toBeVisible()
  await expect(page.getByText('TAP ANYWHERE TO START')).toBeVisible()
  await context.setOffline(false)
})
