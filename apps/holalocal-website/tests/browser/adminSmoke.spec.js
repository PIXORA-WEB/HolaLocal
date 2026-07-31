import { expect, test } from '@playwright/test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import {
  TEST_BUSINESS_ID,
  TEST_PASSWORD,
  TEST_PROJECT_ID,
  TEST_USERS,
} from './fixtures.js'

const adminApp = getApps().find((app) => app.name === 'browser-tests')
  ?? initializeApp({ projectId: TEST_PROJECT_ID }, 'browser-tests')
const db = getFirestore(adminApp)
db.settings({ host: '127.0.0.1:8080', ssl: false })

async function signIn(page, user) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/^password$/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /log in|sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function signOutWithSdk(page) {
  await page.evaluate(async () => {
    const { logoutUser } = await import('/src/firebase/auth.js')
    await logoutUser()
  })
}

async function callable(page, payload) {
  return page.evaluate(async (input) => {
    const { moderateBusinessCallable } = await import('/src/firebase/functionsClient.js')
    try {
      return { ok: true, value: (await moderateBusinessCallable(input)).data }
    } catch (error) {
      return { ok: false, code: error.code, message: error.message }
    }
  }, payload)
}

async function resetPendingBusiness() {
  const businessRef = db.doc(`businesses/${TEST_BUSINESS_ID}`)
  await businessRef.update({
    status: 'pending_review',
    publishedAt: null,
    submittedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  await db.doc(`businessPrivate/${TEST_BUSINESS_ID}`).update({ currentRejection: null })
  const events = await businessRef.collection('moderationEvents').listDocuments()
  await Promise.all(events.map((event) => event.delete()))
}

async function storageRead(page, storagePath) {
  return page.evaluate(async (path) => {
    const { getBytes, ref } = await import('/@id/firebase/storage')
    const { storage } = await import('/src/firebase/storageClient.js')
    try {
      await getBytes(ref(storage, path))
      return 'allowed'
    } catch (error) {
      return error.code
    }
  }, storagePath)
}

test.describe.serial('emulator-only Admin Dashboard smoke', () => {
  test('route claims, rejection, owner resubmission, approval, privacy and responsive UI', async ({ browser }) => {
    await resetPendingBusiness()
    const anonymous = await browser.newContext()
    const anonymousPage = await anonymous.newPage()
    await anonymousPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`)
    await expect(anonymousPage).toHaveURL(/\/login/)
    await expect(anonymousPage.getByText('Private moderation information')).toHaveCount(0)
    expect(await storageRead(
      anonymousPage,
      `businesses/${TEST_BUSINESS_ID}/logos/logo.png`,
    )).not.toBe('allowed')

    const customer = await browser.newContext()
    const customerPage = await customer.newPage()
    await signIn(customerPage, TEST_USERS.customer)
    await customerPage.goto('/admin')
    await expect(customerPage.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
    await expect(customerPage.getByText('Overview', { exact: true })).toHaveCount(0)
    await customerPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`)
    await expect(customerPage.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
    const deniedCount = await customerPage.evaluate(async () => {
      const { getBusinessStatusCounts } = await import('/src/services/adminService.js')
      try {
        await getBusinessStatusCounts()
        return 'allowed'
      } catch (error) {
        return error.code
      }
    })
    expect(deniedCount).not.toBe('allowed')
    const deniedReview = await customerPage.evaluate(async (businessId) => {
      const { getAdminBusinessReview } = await import('/src/services/adminService.js')
      try {
        await getAdminBusinessReview(businessId)
        return 'allowed'
      } catch (error) {
        return error.code
      }
    }, TEST_BUSINESS_ID)
    expect(deniedReview).not.toBe('allowed')
    expect(await storageRead(
      customerPage,
      `businesses/${TEST_BUSINESS_ID}/gallery/gallery.png`,
    )).not.toBe('allowed')

    const admin = await browser.newContext()
    const adminPage = await admin.newPage()
    await signIn(adminPage, TEST_USERS.admin)
    await adminPage.goto('/admin')
    await expect(adminPage).toHaveTitle(/Overview.*HolaLocal|HolaLocal.*Overview/)
    await expect(adminPage.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(adminPage.getByRole('heading', { name: 'Pending review' }).locator('..').getByText('1', { exact: true })).toBeVisible()
    await adminPage.getByRole('link', { name: /View Pending review businesses/i }).click()
    await expect(adminPage).toHaveURL(/status=pending_review/)
    await expect(adminPage.getByRole('combobox', { name: 'Status' })).toHaveValue('pending_review')
    const row = adminPage.getByRole('row', { name: /Browser Smoke Cleaning/ })
    await expect(row).toContainText('Cleaning')
    await expect(row).toContainText('Marbella')
    await expect(row).toContainText('Pending review')
    await expect(row.locator('img')).toHaveJSProperty('complete', true)
    await expect(row).not.toContainText(TEST_USERS.owner.email)
    await adminPage.getByLabel('Filter this page by business name').fill('missing record')
    await expect(adminPage.getByRole('row', { name: /Browser Smoke Cleaning/ })).toHaveCount(0)
    await adminPage.getByLabel('Filter this page by business name').fill('')
    await row.getByRole('link', { name: /Review Browser Smoke Cleaning/ }).click()

    await expect(adminPage.getByRole('heading', { name: 'Public profile information' })).toBeVisible()
    await expect(adminPage.getByRole('heading', { name: 'Private moderation information' })).toBeVisible()
    await expect(adminPage.getByText(TEST_USERS.owner.uid, { exact: true })).toBeVisible()
    await expect(adminPage.getByText(TEST_USERS.owner.email, { exact: true })).toBeVisible()
    await expect(adminPage.getByText('private.owner@example.invalid')).toHaveCount(0)
    await expect(adminPage.locator('.admin-review__logo')).toHaveJSProperty('complete', true)
    await expect(adminPage.locator('.admin-review__gallery img')).toHaveJSProperty('complete', true)
    expect(await storageRead(
      adminPage,
      `businesses/${TEST_BUSINESS_ID}/logos/logo.png`,
    )).toBe('allowed')

    const rejectButton = adminPage.getByRole('button', { name: 'Reject', exact: true })
    await rejectButton.focus()
    await rejectButton.click()
    await expect(adminPage.getByRole('dialog')).toBeVisible()
    await expect(adminPage.getByLabel('Reason category')).toBeFocused()
    await adminPage.keyboard.press('Escape')
    await expect(adminPage.getByRole('dialog')).toHaveCount(0)
    await expect(rejectButton).toBeFocused()
    await rejectButton.click()
    await adminPage.getByRole('button', { name: 'Reject', exact: true }).last().click()
    await expect(adminPage.locator('#rejection-reason-error')).toBeVisible()
    await expect(adminPage.locator('#rejection-guidance-error')).toBeVisible()
    await adminPage.getByLabel('Reason category').selectOption('unclear_service_information')
    await adminPage.getByLabel('Owner-facing guidance').fill('Please clarify each service and the result customers should expect.')
    const submitReject = adminPage.getByRole('dialog').locator('button[type="submit"]')
    await adminPage.route('**/moderateBusiness', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    }, { times: 1 })
    const rejectSubmission = submitReject.click()
    await expect(submitReject).toBeDisabled()
    await rejectSubmission
    await expect(adminPage.locator('.form-message[role="status"]')).toContainText('Business rejected and guidance saved.')

    let business = (await db.doc(`businesses/${TEST_BUSINESS_ID}`).get()).data()
    let privateBusiness = (await db.doc(`businessPrivate/${TEST_BUSINESS_ID}`).get()).data()
    let events = await db.collection(`businesses/${TEST_BUSINESS_ID}/moderationEvents`).get()
    expect(business.status).toBe('rejected')
    expect(business.publishedAt).toBeNull()
    expect(privateBusiness.currentRejection.reasonCode).toBe('unclear_service_information')
    expect(privateBusiness.currentRejection.guidance).toContain('clarify each service')
    expect(events.size).toBe(1)
    expect(events.docs[0].data().moderatorUid).toBe(TEST_USERS.admin.uid)

    const owner = await browser.newContext()
    const ownerPage = await owner.newPage()
    await signIn(ownerPage, TEST_USERS.owner)
    await ownerPage.goto('/business/dashboard')
    await expect(ownerPage.locator('html')).toHaveAttribute('lang', 'es')
    await expect(ownerPage.getByRole('heading', { name: 'Tu negocio necesita cambios' })).toBeVisible()
    await expect(ownerPage.locator('.business-summary__badges')).toContainText('Rechazado')
    await expect(ownerPage.locator('.business-summary__badges')).not.toContainText('Rejected')
    await expect(ownerPage.getByText('Información de servicios poco clara')).toBeVisible()
    await expect(ownerPage.getByText(privateBusiness.currentRejection.guidance, { exact: true })).toBeVisible()
    const ownerWrite = await ownerPage.evaluate(async (businessId) => {
      const { doc, updateDoc } = await import('/@id/firebase/firestore')
      const { db: firestore } = await import('/src/firebase/firestoreClient.js')
      try {
        await updateDoc(doc(firestore, 'businessPrivate', businessId), { currentRejection: null })
        return 'allowed'
      } catch (error) {
        return error.code
      }
    }, TEST_BUSINESS_ID)
    expect(ownerWrite).not.toBe('allowed')
    const ownerHistoryRead = await ownerPage.evaluate(async (businessId) => {
      const { collection, getDocs } = await import('/@id/firebase/firestore')
      const { db: firestore } = await import('/src/firebase/firestoreClient.js')
      try {
        await getDocs(collection(firestore, 'businesses', businessId, 'moderationEvents'))
        return 'allowed'
      } catch (error) {
        return error.code
      }
    }, TEST_BUSINESS_ID)
    expect(ownerHistoryRead).not.toBe('allowed')
    await ownerPage.goto('/business/edit')
    const tagline = ownerPage.locator('#business-tagline')
    const currentTagline = await tagline.inputValue()
    await tagline.fill(currentTagline.endsWith(' — owner corrected')
      ? 'Reliable local cleaning — owner corrected again'
      : 'Reliable local cleaning — owner corrected')
    await ownerPage.locator('#business-profile-form button[type="submit"]').click()
    await expect(ownerPage.locator('.business-form__success[role="status"]')).toBeVisible()
    await ownerPage.goto('/business/dashboard')
    await ownerPage.getByRole('button', { name: /Enviar a revisión|Submit for review/i }).click()
    await expect(ownerPage.getByRole('status')).toBeVisible()
    business = (await db.doc(`businesses/${TEST_BUSINESS_ID}`).get()).data()
    privateBusiness = (await db.doc(`businessPrivate/${TEST_BUSINESS_ID}`).get()).data()
    expect(business.status).toBe('pending_review')
    expect(privateBusiness.currentRejection).toBeNull()
    events = await db.collection(`businesses/${TEST_BUSINESS_ID}/moderationEvents`).get()
    expect(events.size).toBe(1)

    await adminPage.reload()
    await expect(adminPage.getByRole('button', { name: 'Approve and publish' })).toBeVisible()
    await adminPage.getByRole('button', { name: 'Approve and publish' }).click()
    await expect(adminPage.getByRole('dialog')).toBeVisible()
    await adminPage.getByRole('button', { name: 'Approve and publish' }).last().click()
    await expect(adminPage.locator('.form-message[role="status"]')).toContainText('Business approved and published.')
    business = (await db.doc(`businesses/${TEST_BUSINESS_ID}`).get()).data()
    events = await db.collection(`businesses/${TEST_BUSINESS_ID}/moderationEvents`).get()
    expect(business.status).toBe('active')
    expect(business.publishedAt).toBeTruthy()
    expect(business.verificationStatus).toBe('unverified')
    expect(events.size).toBe(2)

    await anonymousPage.goto('/services')
    await expect(anonymousPage.getByText('Browser Smoke Cleaning')).toBeVisible()
    await anonymousPage.getByText('Browser Smoke Cleaning').first().click()
    await expect(anonymousPage.getByText(TEST_USERS.owner.email)).toHaveCount(0)
    await expect(anonymousPage.getByText('clarify each service')).toHaveCount(0)

    await adminPage.setViewportSize({ width: 390, height: 844 })
    await adminPage.goto('/admin/businesses')
    const overflow = await adminPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    await expect(adminPage.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible()
    await expect(adminPage.getByRole('combobox', { name: 'Status' })).toBeVisible()

    await signOutWithSdk(adminPage)
    await adminPage.goto('/admin')
    await expect(adminPage).toHaveURL(/\/login/)
    await adminPage.reload()
    await expect(adminPage).toHaveURL(/\/login/)
    await Promise.all([anonymous.close(), customer.close(), owner.close(), admin.close()])
  })

  test('real callable stale, concurrency and payload-bound idempotency', async ({ browser }) => {
    await resetPendingBusiness()
    const first = await browser.newContext()
    const second = await browser.newContext()
    const firstPage = await first.newPage()
    const secondPage = await second.newPage()
    await signIn(firstPage, TEST_USERS.admin)
    await signIn(secondPage, TEST_USERS.adminTwo)

    await Promise.all([
      firstPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`),
      secondPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`),
    ])
    await Promise.all([
      expect(firstPage.getByRole('button', { name: 'Approve and publish' })).toBeVisible(),
      expect(secondPage.getByRole('button', { name: 'Reject', exact: true })).toBeVisible(),
    ])
    expect((await callable(firstPage, {
      businessId: TEST_BUSINESS_ID,
      operation: 'publish',
      requestId: 'browser_stale_first_decision',
      reasonCode: null,
      guidance: null,
    })).ok).toBe(true)
    await secondPage.getByRole('button', { name: 'Reject', exact: true }).click()
    await secondPage.getByLabel('Reason category').selectOption('other')
    await secondPage.getByLabel('Owner-facing guidance').fill(
      'Please update the business details before submitting the profile again.',
    )
    await secondPage.getByRole('dialog').locator('button[type="submit"]').click()
    await expect(secondPage.locator('.form-message[role="status"]')).toContainText(
      'Another moderator has already reviewed this business.',
    )
    expect((await db.collection(`businesses/${TEST_BUSINESS_ID}/moderationEvents`).get()).size).toBe(1)

    await resetPendingBusiness()
    const concurrentIdA = 'browser_concurrent_request_a'
    const concurrentIdB = 'browser_concurrent_request_b'
    const [decisionA, decisionB] = await Promise.all([
      callable(firstPage, {
        businessId: TEST_BUSINESS_ID, operation: 'publish', requestId: concurrentIdA,
        reasonCode: null, guidance: null,
      }),
      callable(secondPage, {
        businessId: TEST_BUSINESS_ID, operation: 'reject', requestId: concurrentIdB,
        reasonCode: 'other', guidance: 'Please update the profile before submitting it again.',
      }),
    ])
    expect([decisionA.ok, decisionB.ok].filter(Boolean)).toHaveLength(1)
    expect([decisionA, decisionB].find((result) => !result.ok)?.code).toContain('failed-precondition')
    let events = await db.collection(`businesses/${TEST_BUSINESS_ID}/moderationEvents`).get()
    expect(events.size).toBe(1)

    await resetPendingBusiness()
    const original = {
      businessId: TEST_BUSINESS_ID,
      operation: 'reject',
      reasonCode: 'other',
      guidance: 'Please provide clearer details before submitting this profile.',
      requestId: 'browser_idempotency_request',
    }
    const initial = await callable(firstPage, original)
    expect(initial.ok).toBe(true)
    expect((await callable(firstPage, { ...original, guidance: `  ${original.guidance}  ` })).value).toEqual(initial.value)
    for (const changed of [
      { operation: 'publish', reasonCode: null, guidance: null },
      { reasonCode: 'incomplete_profile' },
      { guidance: 'This is different guidance for the same moderation request.' },
    ]) {
      expect((await callable(firstPage, { ...original, ...changed })).code).toContain('already-exists')
    }
    expect((await callable(secondPage, original)).code).toContain('already-exists')
    events = await db.collection(`businesses/${TEST_BUSINESS_ID}/moderationEvents`).get()
    expect(events.size).toBe(1)
    const current = (await db.doc(`businessPrivate/${TEST_BUSINESS_ID}`).get()).data().currentRejection
    expect(current.guidance).toBe(original.guidance)
    await Promise.all([first.close(), second.close()])
  })

  test('locale chunks are asynchronous, persisted and last selection wins', async ({ page }) => {
    const localeRequests = []
    page.on('request', (request) => {
      if (/\/assets\/(es|fr|de)-|authenticatedTranslations|legalContent|fallbackLocale|universalOperational|adminTranslations/.test(request.url())) {
        localeRequests.push(request.url())
      }
    })
    await page.goto('/')
    expect(localeRequests).toHaveLength(0)
    await page.getByRole('button', { name: 'Language' }).first().click()
    await page.getByRole('option', { name: /Español/ }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    expect(localeRequests.length).toBeGreaterThan(0)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')

    await page.route('**/src/i18n/locales/fr.json*', (route) => route.abort(), { times: 1 })
    await page.getByRole('button', { name: 'Idioma' }).first().click()
    await page.getByRole('option', { name: /Français/ }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: /Find trusted local help/ })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Language' }).first().click()
    await page.getByRole('option', { name: /Français/ }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    const rejectionTitles = await page.evaluate(async () => {
      const { changeAppLanguage, default: i18n } = await import('/src/i18n/index.js')
      const values = {}
      for (const language of ['en', 'es', 'fr']) {
        await changeAppLanguage(language)
        values[language] = i18n.t('rejection.owner.title')
      }
      return values
    })
    expect(new Set(Object.values(rejectionTitles)).size).toBe(3)

    await page.evaluate(async () => {
      const { changeAppLanguage } = await import('/src/i18n/index.js')
      await Promise.all([changeAppLanguage('fr'), changeAppLanguage('de')])
    })
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.locator('body')).not.toContainText(/admin\.[a-z]|rejection\.[a-z]/)
  })
})
