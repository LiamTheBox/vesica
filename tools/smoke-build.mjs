// Opens the production build in a headless phone browser and fails unless the app starts:
// no script errors, the start screen shows and the 3D stage mounts. The unit tests and the
// build can pass while the built site is blank (2026-10-23: chunks loading in the wrong
// order), so the deploy runs this before publishing.
// Usage: npm run build && node tools/smoke-build.mjs [dist=dist] [base=/]   (uses Playwright's Chromium)
import { chromium, devices } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import en from '../src/i18n/en.js'

const DIST = process.argv[2] ?? 'dist'
const BASE = process.argv[3] ?? '/'
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (!path.startsWith(BASE)) return res.writeHead(404).end()
  const asked = path.slice(BASE.length)
  const file = normalize(asked === '' || asked.endsWith('/') ? `${asked}index.html` : asked).replace(/^(\.\.[/\\])+/, '')
  try {
    const body = await readFile(join(DIST, file))
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}${BASE}`

const problems = []
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ ...devices['Pixel 7'] })
  page.on('pageerror', (error) => problems.push(`script error: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`)
  })
  await page.goto(url)
  await page.getByText(en['start.tap']).waitFor({ timeout: 30_000 }).catch(() => problems.push('no start screen'))
  await page.locator('canvas').first().waitFor({ timeout: 30_000 }).catch(() => problems.push('no 3D stage'))
} finally {
  await browser.close()
  server.close()
}

if (problems.length) {
  console.error(`The build at ${url} doesn't start:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`The build at ${url} starts.`)
