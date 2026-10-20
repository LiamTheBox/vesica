// Renders public/icons/icon.svg to the PNG sizes the web app manifest and iOS need.
// Usage: node tools/make-icons.mjs  (uses Playwright's Chromium)
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icons/icon.svg', 'utf8')
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180, 'favicon-32.png': 32 }

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size] of Object.entries(sizes)) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: false })
}
await browser.close()
console.log('wrote', Object.keys(sizes).join(', '))
