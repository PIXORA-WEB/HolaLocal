// Existing protected review demo only; no real accounts, provider calls or cloud writes.
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {mkdir} from 'node:fs/promises'
import {supportedUILanguages} from '../../src/utils/languages.js'
import {legalConsentTranslations} from '../../src/i18n/locales/legalConsentTranslations.js'
import {legalConsentEnglishTranslations} from '../../src/i18n/legalConsentEnglishTranslations.js'
const root=resolve(import.meta.dirname,'../../../..'),require=createRequire(resolve(root,'functions/package.json'))
for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','GOOGLE_OAUTH_ACCESS_TOKEN'])assert.ok(!process.env[key])
const hub=await fetch('http://127.0.0.1:4400/emulators',{redirect:'error'}).then(r=>r.json())
for(const [name,port] of Object.entries({auth:9099,firestore:8080,functions:5001,storage:9199}))assert.deepEqual([hub[name]?.host,hub[name]?.port],['127.0.0.1',port])
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
const {initializeApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore')
const db=getFirestore(initializeApp({projectId:'demo-holalocal-functions'}))
const ref=db.doc('users/review-demo-reporter-v1');assert.equal((await ref.get()).exists,true)
await ref.update({termsAccepted:false,privacyAccepted:false})
const output=resolve(process.env.HOLALOCAL_REVIEW_EVIDENCE??resolve(root,'../review-evidence/legal-review-launch/reviews-browser'))
await mkdir(output,{recursive:true})
const browser=await chromium.launch({args:['--disable-dev-shm-usage']})
let page
try{
 const context=await browser.newContext({viewport:{width:390,height:900}})
 await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:/.test(r.request().url())?r.continue():r.abort())
 page=await context.newPage();page.setDefaultTimeout(20000)
 await page.goto('http://127.0.0.1:4190/login')
 await page.locator('input[type=email]').fill('reporter@reviews.example.invalid')
 await page.locator('input[type=password]').fill('Fictional-review-demo-47!')
 await page.getByRole('button',{name:'Log in',exact:true}).click();await page.waitForURL('**/legal-consent');await page.waitForTimeout(500);await page.goto('http://127.0.0.1:4190/legal-consent')
 for(const [code,copy] of Object.entries({en:legalConsentEnglishTranslations,...legalConsentTranslations})){
  await page.locator('.site-header .select-field--compact > button').click()
  await page.getByRole('option',{name:new RegExp(supportedUILanguages.find(language=>language.code===code).name)}).click()
  await page.getByRole('heading',{name:copy.legalConsent.title,exact:true}).waitFor()
  await page.reload();await page.getByRole('heading',{name:copy.legalConsent.title,exact:true}).waitFor()
  const privacy=page.locator('label').filter({has:page.locator('#legal-consent-privacy')})
  assert.ok((await privacy.textContent()).includes(copy.legalConsent.privacyPrefix),code)
  assert.equal(await page.locator('#legal-consent-privacy').isChecked(),false)
  assert.equal(await page.locator('#legal-consent-terms').isChecked(),false)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),code)
 }
 await page.locator('.site-header .select-field--compact > button').click()
 await page.getByRole('option',{name:/English/}).click()
 await page.getByRole('heading',{name:legalConsentEnglishTranslations.legalConsent.title}).waitFor()
 await page.reload()
 await page.getByRole('heading',{name:legalConsentEnglishTranslations.legalConsent.title}).waitFor()
 await page.screenshot({path:resolve(output,'privacy-acknowledgment-mobile.png')})
 await page.locator('#legal-consent-terms').check();await page.locator('#legal-consent-privacy').check()
 await page.getByRole('button',{name:'Accept and continue',exact:true}).click()
 await page.waitForURL(url=>!url.pathname.includes('legal-consent'))
 const saved=(await ref.get()).data()
 assert.equal(saved.termsAccepted,true);assert.equal(saved.privacyAccepted,true)
 assert.equal(saved.termsVersion,'1.0');assert.equal(saved.privacyVersion,'1.0')
 assert.ok(saved.termsAcceptedAt?.toMillis());assert.ok(saved.privacyAcceptedAt?.toMillis())
 await page.reload();await page.waitForTimeout(500);assert.ok(!page.url().includes('legal-consent'))
 console.log('PASS 17-language consent recovery labels, unchecked acknowledgments, mobile layout, real emulator acceptance write and reload with unchanged 1.0 versions.')
}catch(error){
 const saved=(await ref.get()).data()
 console.error(JSON.stringify({url:page?.url(),headings:await page?.locator('h1,h2').allTextContents(),termsAccepted:saved.termsAccepted,privacyAccepted:saved.privacyAccepted,preferredLocale:saved.preferredLocale}))
 if(page)await page.screenshot({path:resolve(output,'consent-failure.png')})
 throw error
}finally{await browser.close();await db.terminate()}
