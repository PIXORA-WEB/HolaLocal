import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', testMatch: ['onboardingRegression.spec.js', 'businessProfileSave.spec.js'],
  workers: 1, retries: 0, timeout: 420000,
  expect: { timeout: 60000 },
  outputDir: 'test-results/onboarding',
  use: { actionTimeout: 60000, baseURL: 'http://127.0.0.1:4175', viewport: { width: 390, height: 844 }, screenshot: 'only-on-failure', trace: 'off' },
  webServer: { command: 'npm run dev -- --mode browser-test --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false },
})
