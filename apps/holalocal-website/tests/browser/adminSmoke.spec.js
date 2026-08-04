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

async function resetSubscriptionState() {
  const subscriptionRef = db.doc(`businessSubscriptions/${TEST_BUSINESS_ID}`)
  const events = await subscriptionRef.collection('assignmentEvents').listDocuments()
  await Promise.all(events.map((event) => event.delete()))
  await subscriptionRef.delete()
}

async function assignmentCallable(page, payload) {
  return page.evaluate(async (input) => {
    const { assignBusinessSubscriptionPlan } = await import('/src/services/adminService.js')
    try {
      return { ok: true, value: await assignBusinessSubscriptionPlan(input) }
    } catch (error) {
      return { ok: false, code: error.code, message: error.message }
    }
  }, payload)
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
  test('subscription assignment, private boundaries, owner projection, moderator access and responsive UI', async ({ browser }) => {
    await Promise.all([resetPendingBusiness(), resetSubscriptionState()])
    const assignmentReason = 'Approved Growth access for the local browser validation.'
    const noChangeReason = 'Reconfirmed Growth after reviewing the current business requirements.'

    const admin = await browser.newContext()
    const adminPage = await admin.newPage()
    await signIn(adminPage, TEST_USERS.admin)
    await adminPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`)

    const subscriptionSection = adminPage.getByRole('heading', { name: 'Subscription plan' }).locator('..')
    await expect(subscriptionSection).toBeVisible()
    await expect(subscriptionSection).toContainText('No manual assignment')
    await expect(subscriptionSection).not.toContainText('Fallback plan · No manual assignment')
    await expect(subscriptionSection).not.toContainText('Assignment version')
    await expect(subscriptionSection).not.toContainText('Not provided')
    const planRadios = subscriptionSection.getByRole('radio')
    await expect(planRadios).toHaveCount(4)
    for (const planName of ['Early Access', 'Starter', 'Growth', 'Pro']) {
      await expect(subscriptionSection.getByRole('radio', { name: planName })).toBeVisible()
    }
    const earlyAccessRadio = subscriptionSection.getByRole('radio', { name: 'Early Access' })
    const growthRadio = subscriptionSection.getByRole('radio', { name: 'Growth' })
    await expect(earlyAccessRadio).toBeChecked()
    const initialPlanHistory = subscriptionSection.locator('.admin-plan-history')
    await expect(initialPlanHistory).not.toHaveAttribute('open', '')
    await expect(initialPlanHistory.getByText('Plan history (0)')).toBeVisible()

    await adminPage.getByRole('button', { name: 'Review plan assignment' }).click()
    await expect(adminPage.getByRole('dialog')).toHaveCount(0)
    await expect(adminPage.locator('#subscription-reason-error[role="alert"]')).toBeVisible()
    await expect(adminPage.getByLabel('Administrator reason')).toBeFocused()

    await earlyAccessRadio.focus()
    await adminPage.keyboard.press('ArrowDown')
    await adminPage.keyboard.press('ArrowDown')
    await expect(growthRadio).toBeChecked()
    await adminPage.getByLabel('Administrator reason').fill(assignmentReason)
    await adminPage.getByRole('button', { name: 'Review plan assignment' }).click()
    const confirmation = adminPage.getByRole('dialog')
    await expect(confirmation).toBeVisible()
    await expect(confirmation).toContainText('Browser Smoke Cleaning')
    await expect(confirmation).toContainText('Early Access')
    await expect(confirmation).toContainText('Growth')
    await expect(confirmation).toContainText(assignmentReason)
    await confirmation.getByRole('button', { name: 'Confirm plan assignment' }).click()
    await expect(adminPage.locator('.form-message[role="status"]')).toContainText('Private subscription state initialised.')
    await expect(adminPage.getByText('Growth', { exact: true }).first()).toBeVisible()
    await expect(growthRadio).toBeChecked()
    await expect(subscriptionSection.getByText('Plan history (1)')).toBeVisible()
    await subscriptionSection.getByText('Plan history (1)').click()
    await expect(subscriptionSection).toContainText(`Early Access → Growth`)
    await expect(subscriptionSection).toContainText(assignmentReason)

    let subscription = (await db.doc(`businessSubscriptions/${TEST_BUSINESS_ID}`).get()).data()
    let assignmentEvents = await db.collection(`businessSubscriptions/${TEST_BUSINESS_ID}/assignmentEvents`).get()
    expect(subscription).toMatchObject({
      schemaVersion: 1,
      businessId: TEST_BUSINESS_ID,
      planId: 'growth',
      planRevision: 1,
      accessStatus: 'active',
      assignmentSource: 'admin',
      updatedBy: TEST_USERS.admin.uid,
      assignmentVersion: 1,
    })
    expect(subscription.assignedAt).toBeTruthy()
    expect(subscription.startsAt).toBeTruthy()
    expect(subscription.updatedAt).toBeTruthy()
    expect(assignmentEvents.size).toBe(1)
    expect(assignmentEvents.docs[0].data()).toMatchObject({
      outcome: 'initialized', changed: true, previousPlanId: 'early_access',
      newPlanId: 'growth', assignmentVersionBefore: 0, assignmentVersionAfter: 1,
      reason: assignmentReason, adminUid: TEST_USERS.admin.uid,
    })

    await adminPage.getByLabel('Administrator reason').fill(noChangeReason)
    await adminPage.getByRole('button', { name: 'Review plan assignment' }).click()
    await adminPage.getByRole('dialog').getByRole('button', { name: 'Confirm plan assignment' }).click()
    await expect(adminPage.locator('.form-message[role="status"]')).toContainText('Plan confirmed; no subscription change was required.')
    subscription = (await db.doc(`businessSubscriptions/${TEST_BUSINESS_ID}`).get()).data()
    assignmentEvents = await db.collection(`businessSubscriptions/${TEST_BUSINESS_ID}/assignmentEvents`).get()
    expect(subscription.assignmentVersion).toBe(1)
    expect(assignmentEvents.size).toBe(2)
    expect(assignmentEvents.docs.map((event) => event.data().outcome).sort()).toEqual(['initialized', 'no_change'])
    await expect(subscriptionSection.getByText('Plan history (2)')).toBeVisible()
    if (!await subscriptionSection.locator('.admin-plan-history').evaluate((element) => element.open)) {
      await subscriptionSection.getByText('Plan history (2)').click()
    }
    await expect(subscriptionSection).toContainText(noChangeReason)

    const owner = await browser.newContext()
    const ownerPage = await owner.newPage()
    await signIn(ownerPage, TEST_USERS.owner)
    const ownerDirectAccess = await ownerPage.evaluate(async (businessId) => {
      const { addDoc, collection, doc, getDoc, getDocs, setDoc } = await import('/@id/firebase/firestore')
      const { db: firestore } = await import('/src/firebase/firestoreClient.js')
      const attempts = {}
      for (const [name, operation] of Object.entries({
        readLatest: () => getDoc(doc(firestore, 'businessSubscriptions', businessId)),
        writeLatest: () => setDoc(doc(firestore, 'businessSubscriptions', businessId), { planId: 'pro' }),
        readEvents: () => getDocs(collection(firestore, 'businessSubscriptions', businessId, 'assignmentEvents')),
        writeEvent: () => addDoc(collection(firestore, 'businessSubscriptions', businessId, 'assignmentEvents'), { outcome: 'changed' }),
      })) {
        try {
          await operation()
          attempts[name] = 'allowed'
        } catch (error) {
          attempts[name] = error.code
        }
      }
      return attempts
    }, TEST_BUSINESS_ID)
    for (const result of Object.values(ownerDirectAccess)) expect(result).not.toBe('allowed')

    await ownerPage.goto('/business/subscription')
    await expect(ownerPage.locator('.subscription-current-card h2')).toContainText(/Growth|Crecimiento/)
    await expect(ownerPage.locator('.subscription-plan-card[aria-current="true"]')).toContainText(/Growth|Crecimiento/)
    await expect(ownerPage.locator('body')).not.toContainText(assignmentReason)
    await expect(ownerPage.locator('body')).not.toContainText(noChangeReason)
    await expect(ownerPage.locator('body')).not.toContainText(TEST_USERS.admin.uid)
    await ownerPage.goto('/business/dashboard')
    await expect(ownerPage.locator('.business-dashboard')).toBeVisible()
    await expect(ownerPage.locator('.business-dashboard')).toContainText(/Growth|Crecimiento/)

    const moderator = await browser.newContext()
    const moderatorPage = await moderator.newPage()
    await signIn(moderatorPage, TEST_USERS.moderator)
    await moderatorPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`)
    const moderatorSection = moderatorPage.getByRole('heading', { name: 'Subscription plan' }).locator('..')
    await expect(moderatorSection).toContainText('Growth')
    await expect(moderatorSection).toContainText('Manually assigned')
    await expect(moderatorSection).toContainText('only administrators can assign plans')
    await expect(moderatorSection.getByRole('radio')).toHaveCount(0)
    await expect(moderatorPage.getByLabel('Administrator reason')).toHaveCount(0)
    await expect(moderatorPage.getByRole('button', { name: 'Review plan assignment' })).toHaveCount(0)
    const moderatorAssignment = await assignmentCallable(moderatorPage, {
      businessId: TEST_BUSINESS_ID,
      planId: 'pro',
      reason: 'Moderator must not be able to assign this plan.',
      requestId: 'browser_moderator_assignment_denied',
      expectedAssignmentVersion: 1,
    })
    expect(moderatorAssignment.ok).toBe(false)
    expect(moderatorAssignment.code).toContain('permission-denied')
    expect((await db.doc(`businessSubscriptions/${TEST_BUSINESS_ID}`).get()).data().planId).toBe('growth')

    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await adminPage.setViewportSize({ width, height: width < 900 ? 844 : 1000 })
      await adminPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`)
      const section = adminPage.getByRole('heading', { name: 'Subscription plan' }).locator('..')
      await expect(section).toBeVisible()
      await expect(section.getByRole('radio', { name: 'Growth' })).toBeEnabled()
      await expect(adminPage.getByLabel('Administrator reason')).toBeEditable()
      await expect(adminPage.getByText('Required', { exact: true })).toBeVisible()
      await expect(adminPage.getByText('0 / 2,000', { exact: true })).toBeVisible()
      await expect(adminPage.getByRole('heading', { name: 'Moderation decision' })).toBeVisible()
      await expect(adminPage.getByRole('button', { name: 'Approve and publish' })).toBeVisible()
      await expect(adminPage.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
      const layout = await adminPage.evaluate(() => {
        const sectionElement = document.querySelector('#subscription-assignment-title')?.parentElement
        const rail = document.querySelector('.admin-review-rail')
        const radioGroup = sectionElement?.querySelector('.admin-plan-choice-group')
        const privateCard = document.querySelector('#private-details-title')?.parentElement
        const moderationCard = document.querySelector('#moderation-decision-title')?.parentElement
        return {
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          sectionOverflow: sectionElement ? sectionElement.scrollWidth > sectionElement.clientWidth : true,
          radioOverflow: radioGroup ? radioGroup.scrollWidth > radioGroup.clientWidth : true,
          railOverflowY: rail ? getComputedStyle(rail).overflowY : 'missing',
          railPosition: rail ? getComputedStyle(rail).position : 'missing',
          duplicateStatus: Boolean(privateCard?.querySelector('.admin-status')),
          moderationBeforeSubscription: Boolean(moderationCard && sectionElement && moderationCard.compareDocumentPosition(sectionElement) & Node.DOCUMENT_POSITION_FOLLOWING),
          moderationVisuallyBeforeSubscription: Boolean(moderationCard && sectionElement && moderationCard.getBoundingClientRect().top < sectionElement.getBoundingClientRect().top),
          historyCollapsed: !sectionElement?.querySelector('.admin-plan-history')?.open,
        }
      })
      expect(layout.pageOverflow, `${width}px page overflow`).toBe(false)
      expect(layout.sectionOverflow, `${width}px subscription overflow`).toBe(false)
      expect(layout.radioOverflow, `${width}px radio-card overflow`).toBe(false)
      expect(['auto', 'scroll']).not.toContain(layout.railOverflowY)
      expect(layout.railPosition, `${width}px rail position`).toBe('static')
      expect(layout.duplicateStatus, `${width}px duplicate status`).toBe(false)
      expect(layout.moderationBeforeSubscription, `${width}px DOM card order`).toBe(true)
      expect(layout.moderationVisuallyBeforeSubscription, `${width}px visual card order`).toBe(true)
      expect(layout.historyCollapsed, `${width}px plan history default`).toBe(true)

      await adminPage.getByLabel('Administrator reason').fill('Responsive confirmation inspection only.')
      await adminPage.getByRole('button', { name: 'Review plan assignment' }).click()
      const dialog = adminPage.getByRole('dialog')
      await expect(dialog).toBeVisible()
      const dialogLayout = await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          fitsHorizontally: bounds.left >= 0 && bounds.right <= window.innerWidth,
          fitsVertically: bounds.top >= 0 && bounds.bottom <= window.innerHeight,
          contentAccessible: element.scrollHeight <= element.clientHeight || getComputedStyle(element).overflowY !== 'visible',
        }
      })
      expect(dialogLayout.fitsHorizontally, `${width}px dialog width`).toBe(true)
      expect(dialogLayout.fitsVertically, `${width}px dialog height`).toBe(true)
      expect(dialogLayout.contentAccessible, `${width}px dialog scrolling`).toBe(true)
      await adminPage.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    }

    await Promise.all([admin.close(), owner.close(), moderator.close()])
  })

  test('route claims, rejection, owner resubmission, approval, privacy and responsive UI', async ({ browser }) => {
    await resetPendingBusiness()
    const anonymous = await browser.newContext()
    const anonymousPage = await anonymous.newPage()
    await anonymousPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`)
    await expect(anonymousPage).toHaveURL(/\/login/)
    await expect(anonymousPage.getByText('Private business details')).toHaveCount(0)
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
    await expect(adminPage.getByRole('heading', { name: 'Pending review' }).locator('..').locator('..').getByText('1', { exact: true })).toBeVisible()
    await expect(adminPage.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page')
    await adminPage.getByRole('link', { name: /View Pending review businesses/i }).click()
    await expect(adminPage).toHaveURL(/status=pending_review/)
    await expect(adminPage.getByRole('button', { name: /Pending review/i })).toHaveAttribute('aria-pressed', 'true')
    const row = adminPage.getByRole('row', { name: /Browser Smoke Cleaning/ })
    await expect(row).toContainText('Cleaning')
    await expect(row).toContainText('Marbella')
    await expect(row).toContainText('Pending review')
    await expect(row.locator('img')).toHaveJSProperty('complete', true)
    await expect(row).not.toContainText(TEST_USERS.owner.email)
    const pageSearch = adminPage.getByLabel('Search this page')
    await expect(adminPage.getByText('Searches only the businesses currently loaded on this page.')).toBeVisible()
    await pageSearch.fill('missing record')
    await expect(adminPage.getByRole('row', { name: /Browser Smoke Cleaning/ })).toHaveCount(0)
    await expect(adminPage.getByText('No matching businesses', { exact: true })).toBeVisible()
    await adminPage.getByRole('button', { name: 'Clear search' }).first().click()
    await expect(pageSearch).toHaveValue('')
    await row.getByRole('link', { name: /Review Browser Smoke Cleaning/ }).click()

    await expect(adminPage.getByRole('heading', { name: 'Public profile information' })).toBeVisible()
    await expect(adminPage.getByRole('heading', { name: 'Private business details' })).toBeVisible()
    await expect(adminPage.getByText('1 image', { exact: true })).toBeVisible()
    await expect(adminPage.getByText(/\d+ of \d+ required fields present/)).toBeVisible()
    await expect(adminPage.getByText('Publishing this profile does not mark the business as verified.')).toBeVisible()
    await expect(adminPage.getByText(TEST_USERS.owner.email, { exact: true })).toBeVisible()
    await expect(adminPage.getByText(TEST_USERS.owner.uid, { exact: true })).toBeHidden()
    await adminPage.getByText('Technical details', { exact: true }).click()
    await expect(adminPage.getByText(TEST_USERS.owner.uid, { exact: true })).toBeVisible()
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
    await expect(ownerPage.locator('.form-message--success[role="status"]')).toBeVisible()
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

    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await adminPage.setViewportSize({ width, height: width < 900 ? 844 : 1000 })
      await adminPage.goto('/admin/businesses?status=active')
      const responsiveList = adminPage.locator(width <= 704 ? '.admin-business-cards' : '.admin-table-panel')
      await expect(responsiveList.getByText('Browser Smoke Cleaning', { exact: true })).toBeVisible()
      const overflow = await adminPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(overflow, `${width}px business list overflow`).toBe(false)
      expect(await adminPage.locator('.admin-business-cards').isVisible()).toBe(width <= 704)
      expect(await adminPage.locator('.admin-table-panel').isVisible()).toBe(width > 704)
      expect(await adminPage.locator('.admin-sidebar').isVisible()).toBe(width > 896)
    }

    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await adminPage.setViewportSize({ width, height: width < 900 ? 844 : 1000 })
      await adminPage.goto(`/admin/businesses/${TEST_BUSINESS_ID}`)
      await expect(adminPage.getByRole('heading', { name: 'Private business details' })).toBeVisible()
      const reviewLayout = await adminPage.evaluate(() => ({
        columns: getComputedStyle(document.querySelector('.admin-review__workspace')).gridTemplateColumns.split(' ').length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        railOverflowY: getComputedStyle(document.querySelector('.admin-review-rail')).overflowY,
        railPosition: getComputedStyle(document.querySelector('.admin-review-rail')).position,
      }))
      expect(reviewLayout.overflow, `${width}px review overflow`).toBe(false)
      expect(reviewLayout.columns, `${width}px review columns`).toBe(width <= 896 ? 1 : 2)
      expect(['auto', 'scroll']).not.toContain(reviewLayout.railOverflowY)
      expect(reviewLayout.railPosition, `${width}px review rail position`).toBe('static')
    }

    await adminPage.setViewportSize({ width: 390, height: 844 })
    await adminPage.goto('/admin/businesses?status=active')
    const menuButton = adminPage.getByRole('button', { name: 'Open admin menu' })
    await menuButton.click()
    await expect(adminPage.getByRole('dialog')).toBeVisible()
    await expect(adminPage.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible()
    await adminPage.keyboard.press('Escape')
    await expect(adminPage.getByRole('dialog')).toHaveCount(0)
    await expect(menuButton).toBeFocused()
    await expect(adminPage.locator('body')).not.toContainText('nav.signOut')

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
