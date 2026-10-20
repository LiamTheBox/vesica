import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// `npm run dev:phone` serves over HTTPS on the LAN so a real phone gets a secure
// context (required for device motion, service workers and wake lock).
export default defineConfig(({ mode }) => {
  const phone = mode === 'phone'
  return {
    plugins: [
      tailwindcss(),
      react(),
      ...(phone ? [basicSsl()] : []),
    ],
    server: phone ? { host: true } : undefined,
    test: {
      include: ['src/**/*.test.{js,jsx}'],
      environment: 'node',
    },
  }
})
