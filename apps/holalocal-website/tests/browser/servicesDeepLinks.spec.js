import process from 'node:process'
import { test, expect } from '@playwright/test'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { TEST_PROJECT_ID } from './fixtures.js'

test('exact public detail survives direct navigation and reload beyond the directory cap; private records stay unavailable', async ({ page }) => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080' || process.env.GCLOUD_PROJECT !== TEST_PROJECT_ID) throw new Error('Isolated emulator required')
  const app = initializeApp({ projectId: TEST_PROJECT_ID }, 'services-links')
  const db = getFirestore(app)
  const business = (name, status = 'active', age = 0) => ({
    name, status, ownerId: 'synthetic-owner', managerIds: ['synthetic-owner'], description: 'Synthetic public description.',
    primaryCategoryId: 'cleaner', categoryIds: ['cleaner'], serviceAreas: ['marbella'],
    languages: ['en'], primaryLanguage: 'en', location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: { preferredContactMethod: 'holalocal', email: '', emailVisible: false },
    profileCompleted: true, publishedAt: Timestamp.fromMillis(1700000000000 - age), deletedAt: null, deletionRequestedAt: null,
  })
  try {
    const batch = db.batch()
    for (let i = 0; i < 101; i++) batch.set(db.doc(`businesses/deeplink-list-${i}`), business(`Directory fixture ${i}`, 'active', i))
    batch.set(db.doc('businesses/deeplink-outside'), business('Outside capped results', 'active', 1000))
    for (const status of ['draft', 'pending_review', 'rejected', 'suspended', 'archived']) batch.set(db.doc(`businesses/deeplink-${status}`), business(`PRIVATE ${status}`, status))
    batch.set(db.doc('businessPrivate/deeplink-outside'), { ownerId: 'synthetic-owner', contact: { email: 'PRIVATE-CONTACT@example.test' } })
    await batch.commit()
    await page.route('https://**', route => route.abort())
    const calls = []
    page.on('request', request => { if (request.method() === 'POST') calls.push(request.url().split('/').at(-1)) })
    await page.goto('/services')
    await expect(page.locator('.public-business-card').first()).toBeVisible()
    await expect(page.getByText('Outside capped results', { exact: true })).toHaveCount(0)
    calls.length = 0
    await page.goto('/services/deeplink-outside')
    await expect(page.getByRole('heading', { name: 'Outside capped results', exact: true })).toBeVisible()
    expect(calls).toContain('getPublicBusiness')
    expect(calls).not.toContain('listPublicBusinesses')
    await expect(page.getByText('PRIVATE-CONTACT@example.test')).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Outside capped results', exact: true })).toBeVisible()
    for (const id of ['draft', 'pending_review', 'rejected', 'suspended', 'archived', 'missing']) {
      await page.goto(`/services/deeplink-${id}`)
      await expect(page.locator('.services-state h1')).toBeVisible()
      await expect(page.locator('.business-detail')).toHaveCount(0)
      await expect(page.getByText(`PRIVATE ${id}`, { exact: true })).toHaveCount(0)
    }
    await page.route('**/getPublicBusiness', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Synthetic transient failure' } }) }))
    await page.goto('/services/deeplink-outside')
    await expect(page.locator('.services-state--error')).toBeVisible()
    await page.unroute('**/getPublicBusiness')
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Outside capped results', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /back to results/i }).click()
    await expect(page).toHaveURL(/\/services$/)
    await expect(page.locator('.public-business-card').first()).toBeVisible()
  } finally { await deleteApp(app) }
})
