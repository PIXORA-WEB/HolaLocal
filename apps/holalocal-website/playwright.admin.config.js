import { defineConfig, devices } from '@playwright/test'

const artifactGroup = globalThis.process.env.HOLALOCAL_ADMIN_BROWSER_ARTIFACT_GROUP
const approvedArtifactGroups = new Set(['lifecycle-a', 'lifecycle-b', 'lifecycle-c'])
if (artifactGroup && !approvedArtifactGroups.has(artifactGroup)) {
  throw new Error('Unapproved protected browser artifact group.')
}
const artifactSuffix = artifactGroup ? `-${artifactGroup}` : ''

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'adminSmoke.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: `test-results/admin-html${artifactSuffix}` }]],
  outputDir: `test-results/admin-artifacts${artifactSuffix}`,
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 15_000,
    baseURL: 'http://127.0.0.1:4175',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --mode browser-test --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
