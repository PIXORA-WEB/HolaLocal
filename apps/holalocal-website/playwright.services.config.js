import config from './playwright.onboarding.config.js'
export default { ...config, testMatch: 'servicesDeepLinks.spec.js', outputDir: 'test-results/services' }
