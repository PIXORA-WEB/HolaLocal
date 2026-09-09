import process from 'node:process'
import { Buffer } from 'node:buffer'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { expect } from '@playwright/test'
import { TEST_PROJECT_ID, TEST_STORAGE_BUCKET } from './fixtures.js'

// Attached fixtures test display, not trusted upload finalization.
export async function verifyIndependentBusinessDisplay(page, businessId) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
    || !['127.0.0.1:19199', 'http://127.0.0.1:19199'].includes(process.env.STORAGE_EMULATOR_HOST)
    || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199'
    || !TEST_PROJECT_ID.startsWith('demo-')) throw new Error('Display fixtures require isolated emulators')
  const app = initializeApp({ projectId: TEST_PROJECT_ID, storageBucket: TEST_STORAGE_BUCKET }, 'onboarding-display')
  const db = getFirestore(app)
  const bucket = getStorage(app).bucket()
  const paths = { oldLogo: `businesses/${businessId}/logos/logo/a`, logo: `businesses/${businessId}/logos/logo/b`, gallery: `businesses/${businessId}/photos/0/a` }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  try {
    for (const path of Object.values(paths)) await bucket.file(path).save(png, { resumable: false, contentType: 'image/png' })
    await db.doc(`businesses/${businessId}`).update({ logoStoragePath: paths.oldLogo, galleryStoragePaths: [] })
    await page.exposeBinding('attachSyntheticDisplayFixture', async (_source, kind) => {
      if (!['logo', 'gallery'].includes(kind)) throw new Error('Unexpected fixture kind')
      await db.doc(`businesses/${businessId}`).update(kind === 'logo' ? { logoStoragePath: paths.logo } : { galleryStoragePaths: [paths.gallery] })
    })
    await page.goto('/tests/browser/integration.html')
    const result = await page.evaluate(async id => {
      const auth = await import('/src/firebase/auth.js')
      await auth.getFirebaseAuth().authStateReady()
      const service = await import('/src/services/businessService.js')
      const oldUrl = (await service.getBusinessById(id)).logoUrl
      const dependencies = kind => ({
        prepare: async () => ({ stagingPath: 'synthetic-display-only', requestId: 'synthetic-display-only' }),
        upload: async () => ({ generation: '1' }),
        finalize: async () => window.attachSyntheticDisplayFixture(kind), remove: async () => {},
      })
      const file = new File(['fixture'], 'fixture.png', { type: 'image/png' })
      const logo = await service.uploadBusinessLogo(id, file, dependencies('logo'))
      const logoImage = new Image()
      logoImage.src = logo.logoUrl
      await logoImage.decode()
      document.body.append(logoImage)
      const gallery = await service.uploadBusinessGalleryImages(id, [file], dependencies('gallery'))
      for (const src of [gallery.logoUrl, ...gallery.galleryUrls]) {
        const image = new Image(); image.src = src; await image.decode(); document.body.append(image)
      }
      let oldRevoked = false
      try { await fetch(oldUrl) } catch { oldRevoked = true }
      return { logoDecoded: logoImage.naturalWidth > 0, galleryCount: gallery.galleryEntries.length, refreshed: oldUrl !== logo.logoUrl, oldRevoked }
    }, businessId)
    expect(result).toEqual({ logoDecoded: true, galleryCount: 1, refreshed: true, oldRevoked: true })
    await page.reload()
    const reload = await page.evaluate(async id => {
      const auth = await import('/src/firebase/auth.js'); await auth.getFirebaseAuth().authStateReady()
      const service = await import('/src/services/businessService.js')
      const saved = await service.getBusinessById(id)
      for (const src of [saved.logoUrl, ...saved.galleryUrls]) {
        const image = new Image(); image.src = src; await image.decode(); document.body.append(image)
      }
      return { galleryCount: saved.galleryEntries.length, status: saved.status }
    }, businessId)
    expect(reload).toEqual({ galleryCount: 1, status: 'pending_review' })
    // Synthetic fixture only: return to the editor to inspect real controls.
    await db.doc(`businesses/${businessId}`).update({ status: 'draft', submittedAt: null })
    await page.goto('/business/edit')
    await expect(page.locator('.editable-image-avatar img')).toBeVisible()
    await page.locator('.editable-image-avatar').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
    const layout = await page.locator('.editable-image-avatar').evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return { width: bounds.width, contained: [...element.querySelectorAll('.editable-image-avatar__overlay > *')].every(part => {
        const box = part.getBoundingClientRect()
        return box.left >= bounds.left && box.right <= bounds.right && box.bottom <= bounds.bottom
      }) }
    })
    expect(layout.width).toBeGreaterThanOrEqual(112)
    expect(layout.contained).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: 'test-results/onboarding/display-mobile.png' })
  } finally { await deleteApp(app) }
}
