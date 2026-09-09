import process from 'node:process'
import { Buffer } from 'node:buffer'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { expect } from '@playwright/test'
import { TEST_PROJECT_ID, TEST_STORAGE_BUCKET } from './fixtures.js'

export async function verifyBusinessDeletion(page, businessId) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
    || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199'
    || !TEST_PROJECT_ID.startsWith('demo-')) throw new Error('Deletion fixtures require isolated emulators')
  const app = initializeApp({projectId:TEST_PROJECT_ID,storageBucket:TEST_STORAGE_BUCKET}, 'gallery-deletion')
  const db = getFirestore(app), bucket = getStorage(app).bucket()
  const canonical = [`businesses/${businessId}/photos/0/a`,`businesses/${businessId}/photos/1/b`]
  const oldPaths = [`businesses/${businessId}/photos/delete-fixture.png`,`businesses/${businessId}/photos/keep-fixture.png`]
  const token = '123e4567-e89b-42d3-a456-426614174000'
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  // Synthetic production-shaped legacy references exercise the strict parser.
  // Their browser reads are redirected ONLY to the fixed demo emulator below.
  const url = path => `https://firebasestorage.googleapis.com/v0/b/holalocal-491c9.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=${token}`
  const legacy = oldPaths.map(path => ({storagePath:path,downloadUrl:url(path)}))
  try {
    for (const path of [...canonical,...oldPaths]) await bucket.file(path).save(png,{resumable:false,metadata:{contentType:'image/png',metadata:oldPaths.includes(path) ? {firebaseStorageDownloadTokens:token} : {}}})
    await db.doc(`businesses/${businessId}`).update({status:'rejected',galleryStoragePaths:canonical,galleryImages:legacy,galleryImageURLs:legacy.map(x=>x.downloadUrl)})
    await page.route('https://firebasestorage.googleapis.com/**', async route => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname.split('/o/')[1] ?? '')
      if (!oldPaths.includes(path)) return route.abort()
      const response = await route.fetch({url:`http://127.0.0.1:19199/v0/b/${TEST_STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`})
      await route.fulfill({response})
    })
    await page.goto('/business/edit')
    await expect(page.locator('.business-gallery-grid figure')).toHaveCount(4)
    // Exercise the real UI, callable, transaction and Storage deletion.
    await page.locator('.business-gallery-grid figure').nth(0).getByRole('button').click()
    await expect(page.locator('.business-gallery-grid figure')).toHaveCount(3)
    let stored = (await db.doc(`businesses/${businessId}`).get()).data()
    expect(stored.galleryStoragePaths).toEqual([canonical[1]])
    expect((await bucket.file(canonical[0]).exists())[0]).toBe(false)
    expect((await bucket.file(canonical[1]).exists())[0]).toBe(true)
    await page.reload()
    await expect(page.locator('.business-gallery-grid figure')).toHaveCount(3)
    await page.locator('.business-gallery-grid figure').nth(1).getByRole('button').click()
    await expect(page.locator('.business-gallery-grid figure')).toHaveCount(2)
    await page.reload()
    await expect(page.locator('.business-gallery-grid figure')).toHaveCount(2)
    stored = (await db.doc(`businesses/${businessId}`).get()).data()
    expect(stored.galleryStoragePaths).toEqual([canonical[1]])
    expect(stored.galleryImages.map(x=>x.storagePath)).toEqual([oldPaths[1]])
    expect((await bucket.file(oldPaths[0]).exists())[0]).toBe(false)
    expect((await bucket.file(oldPaths[1]).exists())[0]).toBe(true)
    for (const img of await page.locator('.business-gallery-grid img').all()) {
      await expect.poll(()=>img.evaluate(x=>x.complete && x.naturalWidth>0)).toBe(true)
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.locator('.business-gallery-editor').scrollIntoViewIfNeeded()
    await page.screenshot({path:'test-results/onboarding/deletion-mobile.png'})
    // An authenticated different owner must fail at the callable, retaining both images.
    await page.goto('/tests/browser/integration.html')
    const denial = await page.evaluate(async ({id,path}) => {
      const auth = await import('/src/firebase/auth.js')
      await auth.getFirebaseAuth().signOut()
      await auth.loginUser('onboarding-regression@example.test','Onboarding!23456')
      try { await (await import('/src/services/businessService.js')).finalizeBusinessMedia('remove-gallery',id,path); return null }
      catch (error) { return error.code }
    },{id:businessId,path:canonical[1]})
    expect(denial).toBe('functions/permission-denied')
    expect((await db.doc(`businesses/${businessId}`).get()).data().galleryStoragePaths).toEqual([canonical[1]])
    expect((await bucket.file(canonical[1]).exists())[0]).toBe(true)
  } finally { await deleteApp(app) }
}
