// Real shared UI + real Firebase Analytics SDK; all Google endpoints intercepted.
// The test-only Vite transform exercises collection using a synthetic stream.
// Never included by index.html/build; does not change production browser-test safety.
import {chromium} from 'playwright'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {initializeApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getFirestore,Timestamp} from 'firebase-admin/firestore'
import {BROWSER_TEST_CORE_ENVIRONMENT} from './browserTestEnvironment.mjs'
import {analyticsEnglish} from '../../src/i18n/analyticsEnglish.js'
import {analyticsTranslations} from '../../src/i18n/locales/analyticsTranslations.js'
Object.assign(process.env,BROWSER_TEST_CORE_ENVIRONMENT)
const output=resolve('../../../review-evidence/analytics-consent')
await mkdir(output,{recursive:true})
const hub=await fetch('http://127.0.0.1:4400/emulators').then(r=>r.json())
assert.equal(hub.auth.port,9099);assert.equal(hub.firestore.port,8080)
const app=initializeApp({projectId:BROWSER_TEST_CORE_ENVIRONMENT.VITE_FIREBASE_PROJECT_ID})
const auth=getAuth(app),db=getFirestore(app)
const uid='analytics-consent-synthetic',email='analytics-consent@example.test',password='Synthetic-Only!123'
await auth.getUser(uid).catch(()=>auth.createUser({uid,email,password,emailVerified:true}))
await db.doc(`users/${uid}`).set({uid,email,accountType:'customer',role:'customer',roles:['customer'],termsAccepted:true,termsVersion:'1.0',privacyAccepted:true,privacyVersion:'1.0',accountStatus:'active',emailVerified:true,profileCompleted:true,firstName:'Synthetic',lastName:'Visitor',displayName:'SYNTHETIC PRIVATE NAME',country:'Spain',city:'Málaga',preferredLanguage:'en',createdAt:Timestamp.now(),legalConsent:{termsVersion:'1.0',privacyVersion:'1.0',acceptedAt:Timestamp.now()}})
let testMeasurement=false
const server=await createServer({mode:'browser-test',plugins:[{name:'test-only-analytics-command-boundary',enforce:'pre',transform(code,id){
 if(testMeasurement&&id.endsWith('/src/services/analyticsController.js'))return code.replace("const configured = import.meta.env.VITE_ANALYTICS_CONSENT_ENABLED === 'true'\n  && import.meta.env.MODE !== 'browser-test'\n  && /^G-[A-Z0-9]+$/.test(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '')","const configured = true").replace('const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID',"const measurementId = 'G-SYNTHETIC'")
}}],server:{host:'127.0.0.1',port:4195,strictPort:true}})
await server.listen()
const browser=await chromium.launch({args:['--disable-dev-shm-usage']})
const results=[]
try {
 for(const width of (process.env.SDK_ONLY ? [] : [390,1440])){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390})
  const requests=[]
  context.on('request',r=>requests.push(r.url()))
  await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:/.test(r.request().url())?r.continue():r.abort())
  context.setDefaultTimeout(15000)
  const page=await context.newPage()
  await page.goto('http://127.0.0.1:4195/events')
  for(const [code,copy]of Object.entries({en:analyticsEnglish,...analyticsTranslations})){
   await page.evaluate(code=>{localStorage.setItem('holalocal.uiLanguage',code);localStorage.removeItem('holalocal.analyticsChoice.v1')},code)
   await page.reload();await page.getByRole('button',{name:copy.accept,exact:true}).waitFor()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),code)
   const accept=page.getByRole('button',{name:copy.accept,exact:true}),reject=page.getByRole('button',{name:copy.reject,exact:true})
   assert.deepEqual(await accept.evaluate(n=>({bg:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color})),await reject.evaluate(n=>({bg:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color})))
   await reject.focus();assert.equal(await reject.evaluate(n=>n.matches(':focus-visible')),true)
   if(code==='en')await page.getByRole('heading',{level:1}).waitFor()
   if(code==='en')await reject.blur()
   if(code==='en')await page.screenshot({path:resolve(output,`bar-${width}.png`)})
   await reject.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.analytics-choice').count(),0)
   await page.reload();assert.equal(await page.locator('.analytics-choice').count(),0)
   await page.getByRole('button',{name:copy.settings,exact:true}).click();await page.locator('.analytics-choice').waitFor()
   await page.getByRole('button',{name:copy.accept,exact:true}).click()
   await page.reload();assert.equal(await page.locator('.analytics-choice').count(),0)
   results.push({code,width,rejectReload:true,acceptReload:true,equalButtons:true,keyboard:true})
  }
  console.log('Locale/layout completed',width)
  assert.equal(requests.filter(u=>/analyticsClient|firebase_analytics|googletagmanager|google-analytics|firebaseinstallations/.test(u)).length,0)
  await context.close()
 }
 // Switch only the test server's controller to enabled. Other safety gates remain.
 testMeasurement=true;server.moduleGraph.invalidateAll()
 for(const signedIn of [false,true]){
  const context=await browser.newContext({viewport:{width:390,height:900}})
  const external=[],sdkLoads=[]
  context.on('request',r=>{if(r.url().includes('analyticsClient'))sdkLoads.push(r.url())})
  await context.route('**/*',async r=>{
    const url=r.request().url()
    if(/^http:\/\/127\.0\.0\.1:/.test(url))return r.continue()
    external.push({url,method:r.request().method()})
    if(url.includes('firebase.googleapis.com/v1alpha/'))return r.fulfill({json:{appId:process.env.VITE_FIREBASE_APP_ID,measurementId:'G-SYNTHETIC'}})
    if(url.includes('firebaseinstallations.googleapis.com'))return r.fulfill({json:{fid:'c1234567890123456789012',refreshToken:'SYNTHETIC',authToken:{token:'SYNTHETIC',expiresIn:'604800s'}}})
    // No Google script or measurement payload is sent to the internet.
    return r.abort()
  })
  context.setDefaultTimeout(15000)
  const page=await context.newPage();await page.goto('http://127.0.0.1:4195/events?email=PRIVATE#token')
  await page.getByRole('button',{name:'Accept analytics',exact:true}).waitFor()
  if(signedIn){await page.evaluate(async({email,password})=>{const {getFirebaseAuth}=await import('/src/firebase/auth.js');const {signInWithEmailAndPassword}=await import('/node_modules/.vite/deps/firebase_auth.js');await signInWithEmailAndPassword(getFirebaseAuth(),email,password)},{email,password})}
  assert.equal(sdkLoads.length,0);assert.equal(external.length,0)
  await page.getByRole('button',{name:'Accept analytics',exact:true}).click()
  console.log('SDK accepted',signedIn)
  await page.waitForFunction(()=>window.dataLayer?.some(args=>args[0]==='event'&&args[1]==='page_view'))
  const events=()=>page.evaluate(()=>window.dataLayer.filter(args=>args[0]==='event').map(args=>[args[1],args[2]]))
  assert.equal((await events()).length,1)
  const config=await page.evaluate(()=>Array.from(window.dataLayer.find(args=>args[0]==='config')))
  assert.equal(config[2].send_page_view,false);assert.equal(config[2].allow_google_signals,false);assert.equal(config[2].user_id,null)
  await page.reload();await page.waitForFunction(()=>window.dataLayer?.some(a=>a[0]==='event'&&a[1]==='page_view'))
  assert.equal((await events()).length,1,'returning accepted visit sends one page view')
  if(signedIn) assert.equal(await page.evaluate(async()=>{const {getFirebaseAuth}=await import('/src/firebase/auth.js');return getFirebaseAuth().currentUser?.uid}),uid)
  const navigate=async path=>{await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))},path);await page.waitForTimeout(180)}
  await navigate('/services?businessId=PRIVATE&query=SECRET')
  await page.waitForFunction(()=>window.dataLayer.filter(a=>a[0]==='event').length===2)
  assert.equal((await events()).length,2)
  await navigate('/services?query=ANOTHER');assert.equal((await events()).length,2)
  await navigate('/login?token=PRIVATE');assert.equal(await page.evaluate(()=>window['ga-disable-G-SYNTHETIC']),true)
  await navigate('/events');await page.waitForFunction(()=>window.dataLayer.filter(a=>a[0]==='event').length===3);assert.equal((await events()).length,3)
  assert.ok(!(JSON.stringify(await events())).match(/PRIVATE|SECRET|token|businessId|example.test|SYNTHETIC PRIVATE NAME/))
  // Seed representative Google cookies locally; this checks our removal, not
  // Google's cookie creation (the actual remote tag is deliberately blocked).
  await context.addCookies([{name:'_ga',value:'synthetic',domain:'127.0.0.1',path:'/'},{name:'_ga_SYNTHETIC',value:'synthetic',domain:'127.0.0.1',path:'/'},{name:'core_preference',value:'keep',domain:'127.0.0.1',path:'/'}])
  const settingsPage=signedIn?page:await context.newPage()
  if(!signedIn){await settingsPage.goto('http://127.0.0.1:4195/events');await settingsPage.waitForFunction(()=>window.dataLayer?.some(a=>a[0]==='event'))}
  await settingsPage.getByRole('button',{name:'Privacy settings',exact:true}).click()
  await settingsPage.getByRole('button',{name:'Reject analytics',exact:true}).click()
  await page.waitForFunction(()=>window['ga-disable-G-SYNTHETIC']===true)
  if(!signedIn)await settingsPage.close()
  assert.equal(await page.evaluate(()=>window['ga-disable-G-SYNTHETIC']),true)
  assert.deepEqual((await context.cookies()).map(c=>c.name),['core_preference'])
  const before=external.length;await navigate('/community');assert.equal((await events()).length,3)
  await page.reload();await page.getByRole('heading',{level:1}).waitFor()
  assert.equal(await page.evaluate(()=>!!window.dataLayer),false)
  assert.equal(external.length,before)
  results.push({signedIn,realSDK:true,remoteTagBlocked:true,publicPageViews:3,withdrawalReload:true,coreCookiePreserved:true,externalAttempts:external.length})
  await context.close()
 }
 await writeFile(resolve(output,process.env.SDK_ONLY ? 'sdk-results.json' : 'browser-results.json'),JSON.stringify(results,null,2))
 console.log('PASS',results.length,'locale/layout and real-SDK command-boundary cases; zero live Google delivery.')
}finally{await browser.close();await server.close()}
