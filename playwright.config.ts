import { defineConfig, devices } from '@playwright/test'

// Runs the app in still-image + mock mode, so no camera or API key is needed.
const PORT = 5174

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `https://localhost:${PORT}`,
    ignoreHTTPSErrors: true,
    // Collapses pen pacing so tests don't wait for the full drawing animation.
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `https://localhost:${PORT}`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
    { name: 'pixel', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-landscape', use: { ...devices['iPhone 15 landscape'] } },
  ],
})
