import config from './playwright.onboarding.config.js'
export default { ...config, testMatch: 'servicesDeepLinks.spec.js', outputDir: 'test-results/services', use: { ...config.use, launchOptions: { args: ['--disable-dev-shm-usage'] } } }
