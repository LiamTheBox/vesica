import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// Installable, offline-capable app: the service worker precaches the build and caches
// the Google Fonts on first use.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'],
  manifest: {
    name: 'Vesica 3D Bladder Simulator',
    short_name: 'Vesica 3D',
    description: 'Hold on: a soft-body bladder simulator for touch screens.',
    start_url: '.',
    display: 'standalone',
    orientation: 'any',
    background_color: '#020617',
    theme_color: '#020617',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})

// `npm run dev:phone` serves over HTTPS on the LAN so a real phone gets a secure
// context (required for device motion, service workers and wake lock).
export default defineConfig(({ mode }) => {
  const phone = mode === 'phone'
  return {
    plugins: [
      tailwindcss(),
      react(),
      pwa,
      ...(phone ? [basicSsl()] : []),
    ],
    server: phone ? { host: true } : undefined,
    test: {
      include: ['src/**/*.test.{js,jsx}'],
      environment: 'node',
    },
  }
})
