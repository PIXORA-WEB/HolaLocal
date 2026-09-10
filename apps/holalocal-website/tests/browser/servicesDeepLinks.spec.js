import process from 'node:process'
import { Buffer } from 'node:buffer'
import { getStorage } from 'firebase-admin/storage'
import { test, expect } from '@playwright/test'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { TEST_PROJECT_ID, TEST_STORAGE_BUCKET } from './fixtures.js'

let app, db
test.beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080' || process.env.GCLOUD_PROJECT !== TEST_PROJECT_ID) throw new Error('Isolated emulator required')
  app = initializeApp({ projectId: TEST_PROJECT_ID }, 'services-links')
  db = getFirestore(app)
  const business = (name, status = 'active', age = 0) => ({
    name, status, ownerId: 'synthetic-owner', managerIds: ['synthetic-owner'], description: 'Synthetic public description.',
    primaryCategoryId: 'cleaner', categoryIds: ['cleaner'], serviceAreas: ['marbella'],
    languages: ['en'], primaryLanguage: 'en', location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
    contact: { preferredContactMethod: 'holalocal', phone:'', phoneVisible:false, email: '', emailVisible: false, website:'',websiteVisible:false,whatsappNumber:'',whatsappVisible:false,allowCallbackRequests:false },
    profileCompleted: true, publishedAt: Timestamp.fromMillis(1700000000000 - age), deletedAt: null, deletionRequestedAt: null,
  })
    const batch = db.batch()
    for (let i = 0; i < 101; i++) batch.set(db.doc(`businesses/deeplink-list-${i}`), business(`Directory fixture ${i}`, 'active', i))
    batch.set(db.doc('businesses/deeplink-outside'), business('Outside capped results', 'active', 1000))
    for (const status of ['draft', 'pending_review', 'rejected', 'suspended', 'archived']) batch.set(db.doc(`businesses/deeplink-${status}`), business(`PRIVATE ${status}`, status))
    batch.set(db.doc('businessPrivate/deeplink-outside'), { ownerId: 'synthetic-owner', contact: { email: 'PRIVATE-CONTACT@example.test' } })
    batch.set(db.doc('businesses/design-long'), { ...business('Long business name for local multilingual home and garden services with comprehensive maintenance support', 'active', -2000), contact: { ...business('').contact, email: 'public@example.test', emailVisible: true, website: 'https://example.invalid', websiteVisible: true, preferredContactMethod: 'holalocal' }, languages: ['en','es','fr','de','nl'] })
    batch.set(db.doc('businesses/design-garden'), { ...business('Garden specialist', 'active', -1000), primaryCategoryId: 'gardener', categoryIds: ['gardener'], languages: ['es'], primaryLanguage: 'es', serviceAreas: ['estepona'], location: {locality:'Estepona',region:'Málaga',countryCode:'ES'} })
    const galleryPath='businesses/design-long/photos/0/a'
    await getStorage(app).bucket(TEST_STORAGE_BUCKET).file(galleryPath).save(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), {resumable:false,contentType:'image/png'})
    batch.update(db.doc('businesses/design-long'), { galleryStoragePaths:[galleryPath], profilePhoto:{downloadUrl:'https://firebasestorage.googleapis.com/v0/b/holalocal-491c9.firebasestorage.app/o/businesses%2Fdesign-long%2Flogos%2Fmissing.png?alt=media&token=123e4567-e89b-42d3-a456-426614174000'} })
    await batch.commit()
})
test.afterAll(async () => { if (app) await deleteApp(app) })
test.beforeEach(async ({page}) => { await page.route('https://**', route => route.abort()) })

test('directory filters, keyboard navigation, responsive details and images', async ({page}) => {
    await page.goto('/services')
    await expect(page.locator('.directory-business-card').first()).toBeVisible()
    await expect(page.getByText('Outside capped results', { exact: true })).toHaveCount(0)
    await page.setViewportSize({width:1440,height:1000})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.locator('.services-filters input').first().fill('Garden specialist')
    await expect(page).toHaveURL(/q=Garden/)
    await expect(page.locator('.directory-business-card')).toHaveCount(1)
    await page.locator('.services-filters input').first().fill('')
    await expect(page).not.toHaveURL(/[?&]q=/)
    await expect(page.locator('.directory-business-card')).toHaveCount(60)
    await page.locator('.services-filters input').nth(1).fill('Estepona')
    await expect(page).toHaveURL(/area=Estepona/)
    await expect(page.locator('.directory-business-card')).toHaveCount(1)
    await page.locator('.services-filters input').nth(1).fill('')
    await expect(page).not.toHaveURL(/[?&]area=/)
    await expect(page.locator('.directory-business-card')).toHaveCount(60)
    await page.getByRole('button',{name:'Category',exact:true}).click()
    await page.getByRole('option',{name:/Gardener/}).click()
    await expect(page).toHaveURL(/service=gardener/)
    await expect(page.locator('.directory-business-card')).toHaveCount(1)
    await page.getByRole('button',{name:'Clear filters',exact:true}).first().click()
    await expect(page.locator('.directory-business-card')).toHaveCount(60)
    await page.locator('.services-filters__select .select-field__button').click()
    await page.getByRole('option', {name:'Français',exact:true}).click()
    await expect(page).toHaveURL(/language=fr/)
    await expect(page.locator('.directory-business-card')).toHaveCount(1)
    await page.locator('.directory-business-card').first().focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/services\/design-long/)
    await expect(page.locator('.business-detail__identity h1')).toContainText('comprehensive maintenance support')
    await expect(page.locator('a[href="mailto:public@example.test"]')).toBeVisible()
    await expect(page.locator('a[href="https://example.invalid"]')).toHaveAttribute('rel','noreferrer')
    await expect(page.locator('.image-avatar--business-detail')).toContainText('LB')
    await expect.poll(()=>page.locator('.business-detail__gallery img').first().evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true)
    await expect(page.locator('.image-avatar--business-detail img')).toHaveCount(0)
    await page.screenshot({path:'test-results/services/detail-desktop.png',fullPage:true})
    await page.setViewportSize({width:390,height:844})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:'test-results/services/detail-mobile.png',fullPage:true})
    await page.evaluate(async()=>{const {changeAppLanguage}=await import('/src/i18n/index.js');await changeAppLanguage('es')})
    await expect(page.locator('#business-about h2')).toContainText('Contacta')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.evaluate(async()=>{const {changeAppLanguage}=await import('/src/i18n/index.js');await changeAppLanguage('en')})
    await page.getByRole('button',{name:'Save business',exact:true}).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('button',{name:'Save business',exact:true})).toBeFocused()
})

test('exact public links reload beyond the cap and hide unavailable/private records', async ({page}) => {
    const calls = []
    page.on('request', request => { if (request.method() === 'POST') calls.push(request.url().split('/').at(-1)) })
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
    await expect(page.locator('.directory-business-card').first()).toBeVisible()
})

test('authenticated save, reload, removal and report persist through real services', async ({page}) => {
    // Real authenticated save/report operations use the unchanged services and rules.
    const uid='services-customer'
    await getAuth(app).createUser({uid,email:'services-customer@example.test',password:'Services!23456',emailVerified:true})
    await db.doc(`users/${uid}`).set({uid,email:'services-customer@example.test',firstName:'Services',lastName:'Customer',displayName:'Services Customer',displayNameNormalized:'services customer',preferredLocale:'en',photoURL:null,profilePhoto:null,createdAt:Timestamp.now(),updatedAt:Timestamp.now(),lastActiveAt:Timestamp.now(),deletionScheduledFor:null,anonymizedAt:null,city:'Marbella',country:'Spain',roles:['customer'],accountType:'customer',accountStatus:'active',profileCompleted:true,onboardingCompleted:true,businessProfileRequired:false,businessProfileCompleted:false,businessId:null,termsAccepted:true,termsVersion:'1.0',termsAcceptedAt:Timestamp.now(),privacyAccepted:true,privacyVersion:'1.0',privacyAcceptedAt:Timestamp.now(),deletionRequestedAt:null})
    await page.goto('/tests/browser/integration.html')
    await page.evaluate(async()=>{const auth=await import('/src/firebase/auth.js');await auth.loginUser('services-customer@example.test','Services!23456')})
    await page.goto('/services/design-long')
    await page.getByRole('button',{name:'Save business',exact:true}).click()
    await expect.poll(async()=>(await db.doc(`users/${uid}/savedBusinesses/design-long`).get()).exists).toBe(true)
    await page.reload()
    await expect(page.locator('.business-detail__save')).toHaveClass(/is-saved/)
    await expect.poll(()=>page.locator('.business-detail__gallery img').first().evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true)
    await page.locator('.business-detail__save').click()
    await expect.poll(async()=>(await db.doc(`users/${uid}/savedBusinesses/design-long`).get()).exists).toBe(false)
    await page.getByRole('button',{name:'Report business',exact:true}).click()
    await page.locator('input[value=misleading_profile]').check()
    await page.locator('.report-form textarea').fill('Synthetic emulator report; no production data.')
    await page.locator('.report-form button[type=submit]').click()
    await expect(page.locator('.report-dialog__success')).toBeVisible()
    const reports=await db.collection('reports').where('reporterId','==',uid).get()
    expect(reports.size).toBe(1)
    expect(reports.docs[0].data().targetId).toBe('design-long')
})
