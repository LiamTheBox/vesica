import { defineConfig, devices } from '@playwright/test'

const PORT = 5199 // dev server: has the window.__vesica test hook
const PREVIEW_PORT = 5299 // production build: service worker, no test hook

// Simulation-logic specs don't depend on screen size, so they only run on Pixel 7.
const LOGIC_SPECS = /(sim|interactions|challenges|hud)\.spec\.js/
const PWA_SPECS = /pwa\.spec\.js/

// Only Chromium is installed locally, so every phone profile runs on Chromium with
// that device's viewport, touch support, pixel ratio and user agent.
const phone = (name) => ({
  name,
  use: { ...devices[name], browserName: 'chromium', defaultBrowserType: 'chromium' },
  testIgnore: name === 'Pixel 7' ? PWA_SPECS : [LOGIC_SPECS, PWA_SPECS],
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
    {
      name: 'PWA (production build)',
      use: { ...devices['Pixel 7'], browserName: 'chromium', defaultBrowserType: 'chromium', baseURL: `http://localhost:${PREVIEW_PORT}` },
      testMatch: PWA_SPECS,
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
    },
    {
      command: `npm run build && npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
})
