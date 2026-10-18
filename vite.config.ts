/// <reference types="vitest/config" />
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // basicSsl: getUserMedia requires a secure origin, so phones on the LAN need HTTPS.
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    host: true,
    // Same-origin API keeps the phone on one HTTPS origin (no CORS / mixed content).
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { target: ['safari15', 'chrome100', 'edge100', 'firefox100'] },
  // Playwright owns e2e/; Vitest runs unit tests only.
  test: { exclude: ['e2e/**', 'node_modules/**'] },
})
