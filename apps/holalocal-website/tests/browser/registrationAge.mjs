// Real application and emulator registration; external network blocked.
import assert from 'node:assert/strict'
import {requestAccountDeletion} from '../../../../functions/src/accountDeletion.js'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createRequire} from 'node:module'
const backendRequire=createRequire(new URL('../../../../functions/package.json',import.meta.url))
const {initializeApp}=backendRequire('firebase-admin/app')
const {getAuth}=backendRequire('firebase-admin/auth')
const {getFirestore,Timestamp}=backendRequire('firebase-admin/firestore')
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {BROWSER_TEST_CORE_ENVIRONMENT} from './browserTestEnvironment.mjs'
import {legalPageContent} from '../../src/i18n/locales/legalContent.js'
import {fallbackLocaleCompletionTranslations} from '../../src/i18n/locales/fallbackLocaleCompletionTranslations.js'
Object.assign(process.env,BROWSER_TEST_CORE_ENVIRONMENT,{VITE_ONBOARDING_REGRESSION:'true',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:19099',VITE_FIRESTORE_EMULATOR_URL:'http://127.0.0.1:18080',VITE_FUNCTIONS_EMULATOR_URL:'http://127.0.0.1:15001',VITE_STORAGE_EMULATOR_URL:'http://127.0.0.1:19199'})
const hub=await fetch('http://127.0.0.1:14400/emulators').then(r=>r.json())
for(const [name,port]of Object.entries({auth:19099,firestore:18080}))assert.deepEqual([hub[name].host,hub[name].port],['127.0.0.1',port])
const output=resolve('../../../review-evidence/legal-review-launch/policy-transition-browser');await mkdir(output,{recursive:true})
const app=initializeApp({projectId:BROWSER_TEST_CORE_ENVIRONMENT.VITE_FIREBASE_PROJECT_ID}),auth=getAuth(app),db=getFirestore(app)
const run=Date.now(),password='Synthetic-Registration!123'
const existing=await auth.createUser({email:`age-existing-${run}@example.test`,password,emailVerified:true})
await db.doc(`users/${existing.uid}`).set({uid:existing.uid,email:existing.email,accountType:'customer',roles:['customer'],accountStatus:'active',profileCompleted:true,firstName:'Synthetic',lastName:'Existing',displayName:'Synthetic Existing',country:'Spain',city:'Málaga',preferredLocale:'en',termsAccepted:true,privacyAccepted:true,termsVersion:'1.0',privacyVersion:'1.0',termsAcceptedAt:Timestamp.now(),privacyAcceptedAt:Timestamp.now(),createdAt:Timestamp.now(),updatedAt:Timestamp.now(),lastActiveAt:Timestamp.now(),displayNameNormalized:'synthetic existing',photoURL:null,profilePhoto:null,onboardingCompleted:true,businessProfileRequired:false,businessProfileCompleted:false,businessId:null,deletionRequestedAt:null,deletionScheduledFor:null,anonymizedAt:null})
const server=await createServer({mode:'browser-test',plugins:[{name:'synthetic-policy-publication-date',enforce:'pre',transform(code,id){if(id.split('?')[0].endsWith('/shared/firebase-contract/legalConsent.js'))return code.replaceAll('EFFECTIVE_DATE = null',"EFFECTIVE_DATE = '2099-01-01'")}}],server:{host:'127.0.0.1',port:4194,strictPort:true}});await server.listen()
const browser=await chromium.launch({args:['--disable-dev-shm-usage']}),results=[]
async function contextFor(width){const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:/.test(r.request().url())?r.continue():r.abort());return context}
try{
 for(const width of (process.env.LOGIN_ONLY ? [] : [390,1440])){
  const context=await contextFor(width),page=await context.newPage();await page.goto('http://127.0.0.1:4194/register')
  for(const code of Object.keys(legalPageContent)){
   const copy=fallbackLocaleCompletionTranslations[code]?.auth.registration??JSON.parse(await readFile(new URL(`../../src/i18n/locales/${code}.json`,import.meta.url),'utf8')).auth.registration
   await page.evaluate(code=>localStorage.setItem('holalocal.uiLanguage',code),code);await page.reload()
   const age=page.getByRole('checkbox',{name:copy.ageConfirmation,exact:true});await age.waitFor();assert.equal(await age.isChecked(),false)
   await age.focus();assert.equal(await age.evaluate(n=>n.matches(':focus-visible')),true)
   await page.keyboard.press('Space');assert.equal(await age.isChecked(),true);await page.keyboard.press('Space');assert.equal(await age.isChecked(),false)
   assert.equal(await page.locator('button[type=submit]').isDisabled(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   assert.match(legalPageContent[code].terms.sections.find(s=>s.key==='account').paragraphs[0],/18/)
   results.push({code,width,unchecked:true,keyboard:true,termsMatch:true,overflow:false})
  }
  await page.evaluate(()=>localStorage.setItem('holalocal.uiLanguage','en'));await page.reload()
  const requests=[];page.on('request',r=>requests.push(r.url()))
  const denied=await page.evaluate(async()=>{const {registerUser}=await import('/src/firebase/auth.js');const result=[];for(const ageConfirmed of [undefined,false,'true',1])try{await registerUser('never-created@example.test','Synthetic-Registration!123',{ageConfirmed,termsAccepted:true,privacyAccepted:true});result.push('unexpected')}catch(e){result.push(e.code)}return result})
  assert.deepEqual(denied,Array(4).fill('auth/age-confirmation-required'));assert.equal(requests.some(url=>url.includes('accounts:signUp')),false)
  await page.locator('#register-email').fill(`age-new-${width}-${run}@example.test`);await page.locator('#register-password').fill(password);await page.locator('#register-confirm-password').fill(password)
  const checks=page.locator('#register-consent input');await checks.nth(1).check();await checks.nth(2).check();assert.equal(await page.locator('button[type=submit]').isDisabled(),true)
  await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  await page.getByText('You must confirm that you are at least 18 to create an account.',{exact:true}).waitFor();assert.equal(await page.locator('#register-age').evaluate(n=>n===document.activeElement),true)
  await page.locator('#register-age').check();assert.equal(await page.locator('#register-age-error').count(),0);await page.getByRole('button',{name:'Reject analytics',exact:true}).click();await page.screenshot({path:resolve(output,`registration-${width}.png`),fullPage:true});await page.locator('button[type=submit]').click();await page.waitForURL('**/verify-email')
  const created=await auth.getUserByEmail(`age-new-${width}-${run}@example.test`)
  // Auth state can navigate before the signup profile transaction completes.
  let profile
  for(let attempt=0;attempt<30;attempt++){
   profile=(await db.doc(`users/${created.uid}`).get()).data()
   if(profile)break
   await new Promise(resolve=>setTimeout(resolve,200))
  }
  assert.ok(profile,'registration profile persisted after Auth navigation')
  assert.equal(profile.termsVersion,'1.1');assert.equal(profile.privacyVersion,'1.1');assert.equal('dateOfBirth' in profile,false);assert.equal('ageConfirmed' in profile,false)
  await page.reload();await page.waitForURL('**/verify-email');assert.equal(await page.locator('#register-age').count(),0);await context.close()
 }
 const context=await contextFor(390),page=await context.newPage()
 for(const path of ['/events','/services','/terms','/privacy']){await page.goto('http://127.0.0.1:4194'+path);await page.locator('h1').waitFor();assert.equal(await page.locator('#register-age').count(),0)}
 await page.goto('http://127.0.0.1:4194/login');await page.locator('input[type=email]').fill(existing.email);await page.locator('input[type=password]').fill(password);await page.locator('button[type=submit]').click();await page.waitForURL(url=>url.pathname!=='/login');await page.goto('http://127.0.0.1:4194/profile');await page.waitForURL('**/profile');await page.reload();await page.waitForURL('**/profile');assert.equal(await page.locator('#register-age').count(),0)
 assert.equal('ageConfirmed' in (await db.doc(`users/${existing.uid}`).get()).data(),false)
 const consentBeforeNotice=(await db.doc(`users/${existing.uid}`).get()).data()
 const notice=page.locator('aside.form-message')
 await notice.waitFor();assert.match(await notice.innerText(),/does not mean you agree/)
 await notice.getByRole('button',{name:'Close',exact:true}).focus();assert.equal(await page.locator(':focus-visible').count()>0,true)
 await page.keyboard.press('Enter');assert.equal(await notice.count(),0)
 await page.reload();await page.waitForURL('**/profile');await notice.waitFor()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 const consentAfterNotice=(await db.doc(`users/${existing.uid}`).get()).data()
 for(const key of ['termsVersion','termsAcceptedAt','privacyVersion','privacyAcceptedAt'])assert.deepEqual(consentAfterNotice[key],consentBeforeNotice[key])
 await context.close()
 const prior=(await db.doc(`users/${existing.uid}`).get()).data()
 const nowSeconds=Math.floor(Date.now()/1000)
 await requestAccountDeletion({uid:existing.uid,emailVerified:true,authTime:nowSeconds,claims:{},db,nowSeconds})
 const after=(await db.doc(`users/${existing.uid}`).get()).data()
 assert.equal(after.termsVersion,'1.0');assert.equal(after.privacyVersion,'1.0');assert.deepEqual(after.termsAcceptedAt,prior.termsAcceptedAt);assert.deepEqual(after.privacyAcceptedAt,prior.privacyAcceptedAt)
 assert.ok((await db.doc(`accountDeletionRequests/${existing.uid}`).get()).exists)
 await writeFile(resolve(output,'results.json'),JSON.stringify({checks:results,realRegistrations:results.length ? 2 : 0,guardRejections:results.length ? 8 : 0,historicalDeletionRequestedWithoutReacceptance:true,acceptanceRecordsPreserved:true,existingAccountLoginReload:true,publicBrowsing:true,productionWrites:0},null,2))
 console.log(`PASS ${results.length} locale/viewport checks; ${results.length ? 8 : 0} service guard rejections; ${results.length ? 2 : 0} real emulator registrations/reloads; existing account login/reload and public browsing unaffected.`)
}finally{await browser.close();await server.close()}
