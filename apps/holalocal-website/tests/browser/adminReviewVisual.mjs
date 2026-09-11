// Run after customerReviewDisplayName.mjs, only in the protected reviews demo.
import {chromium} from 'playwright'
import {initializeApp} from 'firebase-admin/app'
import {getFirestore,Timestamp} from 'firebase-admin/firestore'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','GOOGLE_OAUTH_ACCESS_TOKEN'])assert.ok(!process.env[key])
const hub=await fetch('http://127.0.0.1:4400/emulators').then(r=>r.json());assert.equal(hub.firestore.port,8080)
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
const db=getFirestore(initializeApp({projectId:'demo-holalocal-functions'}))
const output=resolve('../../../review-evidence/admin-visual-preview');await mkdir(output,{recursive:true})
const business=(await db.doc('businesses/review-demo-business-v1').get()).data();assert.ok(business)
await db.doc('businesses/admin-preview-long-business').set({...business,name:'Synthetic Costa del Sol Home Maintenance, Repairs and Community Property Services',status:'pending_review',publishedAt:null,submittedAt:Timestamp.now(),updatedAt:Timestamp.now(),verificationStatus:'unverified'})
await db.doc('accountDeletionRequests/synthetic-preview-in-progress').set({state:'finalizing',requestVersion:1,requestedAt:Timestamp.now(),updatedAt:Timestamp.now(),leaseExpiresAt:Timestamp.fromMillis(Date.now()+86400000),lastCompletedStep:'saved-businesses'})
for(const doc of (await db.collection('customerReviewQuotas').get()).docs)await doc.ref.update({acceptedAt:[]})
const browser=await chromium.launch({args:['--disable-dev-shm-usage']})
async function login(role){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.route('**/*',r=>/^http:\/\/127\.0\.0\.1:/.test(r.request().url())?r.continue():r.abort());const p=await c.newPage();p.setDefaultTimeout(20000);await p.goto('http://127.0.0.1:4190/login');await p.locator('input[type=email]').fill(role+'@reviews.example.invalid');await p.locator('input[type=password]').fill('Fictional-review-demo-47!');await p.getByRole('button',{name:'Log in',exact:true}).click();await p.waitForURL(u=>!u.pathname.includes('/login'));return p}
try{
 const customer=await login('customer')
 await customer.goto('http://127.0.0.1:4190/services/review-demo-business-v1')
 const submitted=await customer.evaluate(async()=>{const {customerReviewService:api}=await import('/src/services/customerReviewService.js');const own=await api.getOwn({businessId:'review-demo-business-v1'});if(own?.status==='pending')return own;return api.submit({businessId:'review-demo-business-v1',expectedVersion:own.review?.version??own.version??0,rating:5,displayName:'Synthetic neighbour',originalText:'Careful work and clear communication throughout this entirely synthetic example.',declaredSourceLanguage:'en',requestId:crypto.randomUUID()})});assert.ok(submitted)
 const p=await login('admin');const results=[]
 for(const width of [1440,390]){
  await p.setViewportSize({width,height:900})
  for(const [name,path] of [['overview','/admin'],['businesses','/admin/businesses'],['business-detail','/admin/businesses/admin-preview-long-business'],['deletions-populated','/admin/account-deletions'],['reviews','/admin/customer-reviews'],['reports','/admin/customer-review-reports']]){
   await p.goto('http://127.0.0.1:4190'+path);await p.waitForTimeout(1000);if(['reviews','reports'].includes(name))await p.getByRole('button',{name:'Open case',exact:true}).first().waitFor();else if(name==='business-detail')await p.getByText('Public profile information',{exact:true}).waitFor();else if(name==='deletions-populated')await p.locator('.admin-deletion-card').waitFor();else if(name==='businesses')await p.getByRole('link',{name:/Review Synthetic/}).first().waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name)
   await p.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:true});results.push({name,width,overflow:false})
   if(['reviews','reports'].includes(name)){await p.getByRole('button',{name:'Open case',exact:true}).first().click();await p.locator('.admin-customer-reviews__identity').waitFor();await p.screenshot({path:resolve(output,`${name}-case-${width}.png`),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' case')}
  }
 }
 await p.goto('http://127.0.0.1:4190/admin/businesses');await p.getByRole('button',{name:/Suspended/}).click();await p.screenshot({path:resolve(output,'businesses-empty-390.png')})
 await p.goto('http://127.0.0.1:4190/admin/businesses/unavailable-synthetic-business');await p.getByText('Business not found',{exact:true}).waitFor();await p.screenshot({path:resolve(output,'business-unavailable-390.png')})
 await p.route('**/listCustomerReviewModerationQueue',route=>route.abort());await p.goto('http://127.0.0.1:4190/admin/customer-reviews');await p.getByRole('alert').waitFor();await p.screenshot({path:resolve(output,'reviews-error-390.png')});await p.unroute('**/listCustomerReviewModerationQueue');await p.getByRole('button',{name:'Retry',exact:true}).click();await p.getByRole('button',{name:'Open case',exact:true}).waitFor();
 await writeFile(resolve(output,'review-layout-checks.json'),JSON.stringify(results,null,2));console.log('PASS review/report and listing previews; long names, unavailable business, empty queue, no overflow at390/1440.')
}finally{await browser.close()}
