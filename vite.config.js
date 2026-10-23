import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// Installable, offline-capable app: the service worker precaches the build, fonts included.
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
    build: {
      // Three.js alone is ~740 kB minified: R3F registers the whole THREE namespace, so
      // it can't be tree-shaken.
      chunkSizeWarningLimit: 760,
      rolldownOptions: {
        output: {
          // Libraries in their own long-lived chunks: an app update re-downloads only the app.
          // Chunks split by hand can import each other in a loop (three needs the bundler's
          // helpers, which had landed in an app chunk that loads three first), and the live
          // site then stopped on a blank screen; strict execution order runs every module in
          // source order, with the helpers in a chunk of their own.
          strictExecutionOrder: true,
          codeSplitting: {
            groups: [
              { name: 'three', test: /node_modules[\\/](three|three-stdlib)[\\/]/ },
              { name: 'r3f', test: /node_modules[\\/](@react-three|its-fine|react-use-measure|suspend-react)[\\/]/ },
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/ },
            ],
          },
        },
      },
    },
    test: {
      include: ['src/**/*.test.{js,jsx}'],
      environment: 'node',
    },
  }
})
