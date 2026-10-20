import { defineConfig, devices } from '@playwright/test'

const PORT = 5199

// Only Chromium is installed locally, so every phone profile runs on Chromium with
// that device's viewport, touch support, pixel ratio and user agent.
const phone = (name) => ({
  name,
  use: { ...devices[name], browserName: 'chromium', defaultBrowserType: 'chromium' },
})

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  // Headless Chromium renders WebGL in software; more than two pages at once starves
  // the CPU and stalls the page's main thread.
  workers: 2,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    phone('iPhone SE'),
    phone('iPhone 15 Pro'),
    phone('iPhone 15 Pro landscape'),
    phone('Pixel 7'),
    phone('iPad (gen 7)'),
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
})
