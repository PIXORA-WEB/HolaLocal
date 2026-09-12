import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {BROWSER_TEST_CORE_ENVIRONMENT} from './browserTestEnvironment.mjs'
import {adminRetentionCopy} from '../../src/i18n/adminRetentionCopy.js'
const backendRequire=createRequire(new URL('../../../../functions/package.json',import.meta.url))
const {initializeApp}=backendRequire('firebase-admin/app'),{getAuth}=backendRequire('firebase-admin/auth'),{getFirestore,Timestamp}=backendRequire('firebase-admin/firestore')
const cleanupEnabled=process.env.RECORD_RETENTION_CLEANUP_ENABLED==='true'
Object.assign(process.env,BROWSER_TEST_CORE_ENVIRONMENT,{VITE_CUSTOMER_REVIEWS_ENABLED:'false',VITE_ONBOARDING_REGRESSION:'true',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:19099',VITE_FIRESTORE_EMULATOR_URL:'http://127.0.0.1:18080',VITE_FUNCTIONS_EMULATOR_URL:'http://127.0.0.1:15001',VITE_STORAGE_EMULATOR_URL:'http://127.0.0.1:19199'})
const hub=await fetch('http://127.0.0.1:14400/emulators').then(r=>r.json())
for(const [name,port]of Object.entries({auth:19099,firestore:18080,functions:15001}))assert.deepEqual([hub[name].host,hub[name].port],['127.0.0.1',port])
const output=resolve(process.env.HOLALOCAL_RETENTION_EVIDENCE);await mkdir(output,{recursive:true})
const app=initializeApp({projectId:BROWSER_TEST_CORE_ENVIRONMENT.VITE_FIREBASE_PROJECT_ID}),auth=getAuth(app),db=getFirestore(app),now=Timestamp.now()
const password='Synthetic-Retention!123', users={}
for(const role of ['admin','customer']){
 const user=await auth.createUser({uid:'retention-'+role,email:`retention-${role}@example.test`,password,emailVerified:true});users[role]=user
 if(role==='admin')await auth.setCustomUserClaims(user.uid,{admin:true})
 await db.doc(`users/${user.uid}`).set({uid:user.uid,email:user.email,accountType:'customer',roles:['customer'],accountStatus:'active',profileCompleted:true,firstName:'Synthetic',lastName:role,displayName:'Synthetic '+role,country:'Spain',city:'Málaga',preferredLocale:'en',termsAccepted:true,privacyAccepted:true,termsVersion:'1.0',privacyVersion:'1.0',termsAcceptedAt:now,privacyAcceptedAt:now,createdAt:now,updatedAt:now,lastActiveAt:now,displayNameNormalized:'synthetic '+role,photoURL:null,profilePhoto:null,onboardingCompleted:true,businessProfileRequired:false,businessProfileCompleted:false,businessId:null,deletionRequestedAt:null,deletionScheduledFor:null,anonymizedAt:null})
}
const evidence={termsVersion:'1.0',privacyVersion:'1.0',termsAcceptedAt:now,privacyAcceptedAt:now}
await db.doc('accountDeletionRequests/ack-fixture').set({uid:'ack-fixture',state:'completed',lastCompletedStep:'completed',requestedAt:now,completedAt:now,updatedAt:now,requestVersion:8,retainedConsentEvidence:evidence})
await db.doc('businesses/retention-business').set({ownerId:'unrelated-owner',status:'pending_review'})
const report={reporterId:'synthetic-reporter',targetType:'business',targetId:'retention-business',parentId:null,reason:'other',details:'Synthetic business report; no real user data. '.repeat(20),evidence:[],status:'open',priority:'normal',assignedTo:null,resolution:null,createdAt:now,updatedAt:now}
await db.doc('reports/report-open').set(report)
await db.doc('reports/report-due').set({...report,status:'resolved',resolutionVersion:1,resolvedAt:Timestamp.fromMillis(now.toMillis()-91*86400000)})
const server=await createServer({mode:'browser-test',server:{host:'127.0.0.1',port:4196,strictPort:true}});await server.listen()
const browser=await chromium.launch({args:['--disable-dev-shm-usage']})
const results=[]
async function login(role,width){
 const context=await browser.newContext({viewport:{width,height:950}});await context.route('**/*',route=>/^http:\/\/127\.0\.0\.1:/.test(route.request().url())?route.continue():route.abort())
 const page=await context.newPage();page.setDefaultTimeout(30000)
 await page.goto('http://127.0.0.1:4196/login');await page.locator('input[type=email]').fill(users[role].email);await page.locator('input[type=password]').fill(password)
 const reject=page.getByRole('button',{name:'Reject analytics',exact:true});if(await reject.count())await reject.click()
 await page.locator('button[type=submit]').click();await page.waitForURL(url=>url.pathname!=='/login');return {context,page}
}
try{
 const {context,page}=await login('admin',390)
 await page.goto('http://127.0.0.1:4196/admin/account-deletions')
 await page.locator('.admin-retention summary').click()
 const controls=page.locator('.admin-retention'),kind=controls.getByRole('combobox',{name:'Retention reviews',exact:true})
 const row=id=>controls.locator('.admin-retention__record').filter({has:page.locator('code',{hasText:id})})
 await row('ack-fixture').waitFor()
 if(!cleanupEnabled){assert.equal(await controls.getByRole('button',{name:/Run selected cleanup/}).isDisabled(),true);await controls.getByText('Destructive cleanup is disabled.',{exact:true}).waitFor()}
 await row('ack-fixture').getByRole('button',{name:'Review record',exact:true}).click()
 let dialog=page.getByRole('dialog',{name:'Review record',exact:true})
 await dialog.getByLabel('Specific reason',{exact:true}).fill('Synthetic verification need')
 await dialog.getByLabel('When this need ends',{exact:true}).fill('Synthetic verification finished')
 await dialog.getByLabel('Next review (your local time)',{exact:true}).fill(new Date(Date.now()+86400000).toISOString().slice(0,16))
 await dialog.getByRole('button',{name:'Preserve information',exact:true}).click();await dialog.waitFor({state:'hidden'})
 assert.equal((await db.doc('acknowledgmentRetention/ack-fixture').get()).data().decision.reviewerId,users.admin.uid)
 await row('ack-fixture').getByRole('button',{name:'Review record',exact:true}).click();dialog=page.getByRole('dialog',{name:'Review record',exact:true})
 await dialog.getByRole('combobox',{name:'Review record',exact:true}).selectOption('release');await dialog.getByLabel('Specific reason',{exact:true}).fill('Synthetic verification and backup reconciliation complete')
 await dialog.getByRole('button',{name:'End preservation',exact:true}).click();await dialog.waitFor({state:'hidden'})
 await kind.selectOption('business-report');await row('report-open').waitFor();await row('report-open').getByRole('button',{name:'Review record',exact:true}).click()
 dialog=page.getByRole('dialog',{name:'Review record',exact:true});await dialog.getByRole('combobox',{name:'Review record',exact:true}).selectOption('resolve');await dialog.getByLabel('Specific reason',{exact:true}).fill('Synthetic report handled without business moderation')
 await dialog.getByRole('button',{name:'Record report resolution',exact:true}).click();await dialog.waitFor({state:'hidden'})
 const resolution=(await db.doc('reports/report-open').get()).data();assert.equal(resolution.status,'resolved');assert.ok(resolution.resolvedAt instanceof Timestamp)
 assert.equal((await db.doc('businesses/retention-business').get()).data().status,'pending_review')
 if(cleanupEnabled){
  await row('report-due').getByRole('checkbox').check();await controls.getByRole('button',{name:'Run selected cleanup (1/5)',exact:true}).click()
  let confirmation=page.getByRole('dialog',{name:'Run selected cleanup',exact:true})
  await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await db.doc('reports/report-due').get()).exists,true)
  await controls.getByRole('button',{name:'Run selected cleanup (1/5)',exact:true}).click();confirmation=page.getByRole('dialog',{name:'Run selected cleanup',exact:true})
  await confirmation.getByRole('button',{name:'Run selected cleanup',exact:true}).click();await confirmation.waitFor({state:'hidden'})
  assert.equal((await db.doc('reports/report-due').get()).exists,false);assert.equal((await db.doc('reports/report-open').get()).exists,true)
 }
 await page.reload();await page.locator('.admin-retention summary').click();await page.locator('.admin-retention__record').first().waitFor()
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:950})
  for(const [code,copy]of Object.entries(adminRetentionCopy)){
   await page.evaluate(async code=>{const {changeAppLanguage}=await import('/src/i18n/index.js');await changeAppLanguage(code)},code)
   await page.locator('.admin-retention summary').getByText(copy.title,{exact:true}).waitFor()
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,code+'/'+width)
   results.push({code,width,overflow:false})
  }
  await page.evaluate(async()=>{const {changeAppLanguage}=await import('/src/i18n/index.js');await changeAppLanguage('en')})
  await page.screenshot({path:resolve(output,`retention-${width}.png`),fullPage:true})
 }
 const ackRow=row('ack-fixture');await ackRow.getByRole('button',{name:'Review record',exact:true}).click();dialog=page.getByRole('dialog',{name:'Review record',exact:true})
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await ackRow.getByRole('button',{name:'Review record',exact:true}).evaluate(n=>document.activeElement===n),true)
 assert.deepEqual((await db.doc(`users/${users.admin.uid}`).get()).data().termsAcceptedAt,now)
 await context.close()
 const customer=await login('customer',390)
 const error=await customer.page.evaluate(async()=>{const {manageRetentionRecordsCallable}=await import('/src/firebase/functionsClient.js');try{await manageRetentionRecordsCallable({action:'list',kind:'business-report'});return 'unexpected'}catch(error){return error.code}})
 assert.equal(error,'functions/permission-denied')
 await customer.page.goto('http://127.0.0.1:4196/admin/account-deletions');await customer.page.waitForTimeout(1000);assert.equal(await customer.page.locator('.admin-retention').count(),0)
 await customer.context.close()
 await writeFile(resolve(output,'results.json'),JSON.stringify({cleanupEnabled,realCallable:true,reportResolution:true,unchangedBusiness:true,historicalConsent:true,nonAdminDenied:true,checks:results},null,2))
 console.log(`PASS real admin browser/callable integration; cleanup=${cleanupEnabled};${results.length}locale/viewport checks`)
}finally{await browser.close();await server.close()}
