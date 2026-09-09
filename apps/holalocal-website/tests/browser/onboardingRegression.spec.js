import { verifyBusinessDeletion } from './onboardingDeletionChecks.js'
import { verifyIndependentBusinessDisplay } from './onboardingDisplayChecks.js'
import { test, expect } from '@playwright/test'
import { TEST_PROJECT_ID } from './fixtures.js'

test.beforeAll(async () => {
  test.setTimeout(240000)
  // Load the real callable workers before measuring browser actions; no success is mocked.
  for (const name of ['updateAccountRole', 'ensureOwnerBusiness', 'getOwnerSubscriptionStatus', 'manageBusinessMedia']) {
    const response = await fetch(`http://127.0.0.1:15001/${TEST_PROJECT_ID}/europe-west1/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }),
      signal: AbortSignal.timeout(90000),
    })
    expect(response.status).toBe(401)
  }
})
test('mobile registration, verified email, save/reload and validation feedback', async ({ page }) => {
  await page.route(/^https:\/\//, route => route.abort())
  // Warm the real Firestore rules engine before timing registration navigation.
  await page.goto('/tests/browser/integration.html')
  const denied = await page.evaluate(async () => {
    const { getBusinessById } = await import('/src/services/businessService.js')
    try { await getBusinessById('anonymous-warmup'); return null } catch (error) { return error.code }
  })
  expect(denied).toBe('permission-denied')
  await page.goto('/register')
  await page.locator('#register-email').fill('onboarding-regression@example.test')
  await page.locator('#register-password').fill('Onboarding!23456')
  await page.locator('#register-confirm-password').fill('Onboarding!23456')
  await page.locator('#register-consent input').first().check()
  await page.locator('#register-consent input').last().check()
  await page.locator('form button[type=submit]').click()
  await expect(page).toHaveURL(/verify-email/)
  const codes = await (await fetch(`http://127.0.0.1:19099/emulator/v1/projects/${TEST_PROJECT_ID}/oobCodes`)).json()
  const code = codes.oobCodes.find(entry => entry.email === 'onboarding-regression@example.test')
  expect(code).toBeTruthy()
  await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: code.oobCode }),
  })
  await page.getByRole('button', { name: 'I have verified my email' }).click()
  await expect(page).toHaveURL(/complete-profile/)
  await page.locator('#profile-first-name').fill('Isolated')
  await page.locator('#profile-last-name').fill('Regression')
  await page.locator('#profile-city').fill('Marbella')
  await page.locator('form button[type=submit]').click()
  await expect(page).toHaveURL(/onboarding/)
  await page.locator('#onboarding-business').check()
  await page.locator('form button[type=submit]').click()
  await expect(page).toHaveURL(/business/, { timeout: 30000 })
  await expect(page.locator('a[href="/business/edit"]').first()).toBeVisible({ timeout: 90000 })
  await page.goto('/business/edit')
  await page.locator('#business-name').fill('Isolated regression business')
  await page.locator('#business-description').fill('A local cleaning service used only in the emulator.')
  await page.locator('#business-service-group').click()
  await page.getByRole('option', { name: 'Home & Property', exact: true }).click()
  await page.locator('#business-main-category').click()
  await page.getByRole('option', { name: /clean/i }).first().click()
  await page.getByRole('combobox').fill('Marbella')
  await page.getByRole('option', { name: 'Marbella', exact: true }).click()
  await page.locator('.service-area-selector__search input').fill('Marbella')
  await page.locator('.service-area-selector__results label').filter({ has: page.locator('input[value=marbella]') }).click()
  await expect(page.locator('input[name=serviceAreas][value=marbella]')).toBeChecked()
  await page.locator('.business-form__save button').click()
  await expect(page.locator('.business-form__save')).toContainText('Business profile saved successfully.')
  await page.locator('#business-name').fill('Unsaved next edit')
  await expect(page.locator('.business-form__save')).toContainText('Unsaved changes')
  await page.locator('#business-name').fill('Isolated regression business')
  await expect(page.locator('.business-form__save button')).toBeDisabled()
  await page.reload()
  await expect(page.locator('#business-name')).toHaveValue('Isolated regression business', { timeout: 90000 })
  await page.goto('/business/dashboard')
  await expect(page.getByRole('button', { name: /submit.*review/i })).toBeEnabled()
  await page.goto('/business/edit')
  await page.locator('#business-name').fill('')
  await page.locator('.business-form__save button').click()
  await expect(page.locator('#business-name')).toBeFocused()
  await page.locator('#business-name').fill('Isolated regression business')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  // A real backend state change makes this stale editor's next write forbidden.
  await page.evaluate(async () => {
    const { getFirebaseAuth } = await import('/src/firebase/auth.js')
    const business = await import('/src/services/businessService.js')
    const { getUserProfile } = await import('/src/services/userService.js')
    const profile = await getUserProfile(getFirebaseAuth().currentUser.uid)
    const saved = await business.getBusinessById(profile.businessId)
    await business.submitBusinessForReview(saved.businessId)
  })
  await page.locator('#business-description').fill('This forbidden edit must remain available locally.')
  await page.locator('.business-form__save button').click()
  await expect(page.locator('.business-form__save [role=alert]')).toContainText('not saved')
  await expect(page.locator('#business-description')).toHaveValue('This forbidden edit must remain available locally.')
  await expect(page.locator('.business-form__save button')).toBeEnabled()


})

test('real location removal, replacement, save/reload and review without images', async ({ page }) => {
  await page.route(/^https:\/\//, route => route.abort())
  await page.goto('/tests/browser/integration.html')
  await page.evaluate(async () => {
    const auth = await import('/src/firebase/auth.js')
    const policies = await import('/src/utils/policies.js')
    await auth.registerUser('service-regression@example.test', 'Onboarding!23456', {
      termsAccepted: true, privacyAccepted: true,
      termsVersion: policies.CURRENT_TERMS_VERSION, privacyVersion: policies.CURRENT_PRIVACY_VERSION,
    })
  })
  const codes = await (await fetch(`http://127.0.0.1:19099/emulator/v1/projects/${TEST_PROJECT_ID}/oobCodes`)).json()
  const code = codes.oobCodes.find(entry => entry.email === 'service-regression@example.test')
  expect(code).toBeTruthy()
  const verified = await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: code.oobCode }),
  })
  expect(verified.ok).toBe(true)
  const id = await page.evaluate(async () => {
    const auth = await import('/src/firebase/auth.js')
    const users = await import('/src/services/userService.js')
    const business = await import('/src/services/businessService.js')
    const user = auth.getFirebaseAuth().currentUser
    await auth.reloadAuthenticationUser(user)
    await users.updateUserProfile(user.uid, { firstName: 'Service', lastName: 'Regression', displayName: 'Service Regression',
      preferredLocale: 'en', city: 'Marbella', country: 'Spain', profileCompleted: true })
    const profile = await users.configureAccountType(user.uid, 'business')
    const draft = await business.ensureBusinessProfile(user.uid, profile)
    await business.updateBusinessProfile(draft.businessId, {
      name: 'Service regression', description: 'Isolated integration', primaryCategoryId: 'cleaner', categoryIds: ['cleaner'],
      location: { locality: 'Marbella', region: 'malaga', countryCode: 'ES' },
      serviceAreas: ['santa-margarita', 'duquesa', 'Remote', 'marbella'], languages: ['en'], primaryLanguage: 'en',
      contact: { preferredContactMethod: 'holalocal', email: 'private@example.test', emailVisible: false },
    })
    return draft.businessId
  })
  await page.goto('/business/edit')
  for (const value of ['santa-margarita', 'duquesa', 'Remote']) {
    const chip = page.locator('.service-area-selector__chips button').filter({ hasText: value })
    await expect(chip).toBeVisible()
    await chip.click()
    await expect(chip).toHaveCount(0)
  }
  await page.locator('.service-area-selector__search input').fill('Duquesa')
  await page.locator('.service-area-selector__results label').filter({ has: page.locator('input[value=la-duquesa]') }).click()
  await page.locator('.business-form__save button').click()
  await expect(page.locator('.business-form__save')).toContainText('Business profile saved successfully.')
  await page.reload()
  await expect(page.locator('.service-area-selector__chips button')).toHaveCount(2)
  const stored = await page.evaluate(async id => {
    const { getFirebaseAuth } = await import('/src/firebase/auth.js')
    await getFirebaseAuth().authStateReady()
    const business = await import('/src/services/businessService.js')
    const locations = await import('/src/utils/locations.js')
    const saved = await business.getBusinessById(id)
    const { getBusinessProfileCompletion } = await import('/src/utils/businessCompletion.js')
    return { areas: saved.serviceAreas.map(locations.normalizeServiceAreaId), ready: getBusinessProfileCompletion(saved).ready }
  }, id)
  expect(stored).toEqual({ areas: ['marbella', 'la-duquesa'], ready: true })
  const pending = await page.evaluate(async id => {
    const business = await import('/src/services/businessService.js')
    const saved = await business.submitBusinessForReview(id)
    return { status: saved.status, publishedAt: saved.publishedAt }
  }, id)
  expect(pending).toEqual({ status: 'pending_review', publishedAt: null })
  console.log('PASS: real mobile location removal/save/reload and review submission without images')
  await test.step('independent browser display using attached synthetic fixtures', async () => {
    await verifyIndependentBusinessDisplay(page, id)
  })
  await test.step('real canonical and legacy deletion, reload and unauthorized rejection', async () => {
    await verifyBusinessDeletion(page, id)
  })
})
