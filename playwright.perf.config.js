import { defineConfig, devices } from '@playwright/test'

// Performance gate (ROADMAP M7): `npm run test:perf`. Runs the production build on a
// Pixel 7 profile, one test at a time so pages don't compete for the CPU.
//
// Frame rates only mean something on a real GPU. Headless Chromium reaches it through
// ANGLE on Vulkan; where that isn't available the GPU tests skip. Software WebGL
// (SwiftShader) stands in for a weak phone GPU: its frame rate follows the GPU work.

const PREVIEW_PORT = 5299 // shared with playwright.config.js
const PIXEL_7 = { ...devices['Pixel 7'], browserName: 'chromium', defaultBrowserType: 'chromium' }
export const GPU_ARGS = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']

export default defineConfig({
  testDir: './e2e/perf',
  outputDir: './test-results/perf',
  workers: 1,
  timeout: 240_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'real GPU', testMatch: /gpu\.spec\.js/, use: { ...PIXEL_7, launchOptions: { args: GPU_ARGS } } },
    { name: 'software GPU', testMatch: /software\.spec\.js/, use: PIXEL_7 },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    url: `http://localhost:${PREVIEW_PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
