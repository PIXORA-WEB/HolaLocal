// Executes Google's cached, unmodified public tag. Every external browser request
// is fulfilled/blocked locally by default. --approved-ingestion permits the
// single user-approved synthetic run with a durable ledger and eight-PV ceiling.
import {validateProbeRequest} from '../../scripts/analyticsIngestionGuard.mjs'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {BROWSER_TEST_CORE_ENVIRONMENT} from './browserTestEnvironment.mjs'
const output=resolve('../../../review-evidence/analytics-consent/real-tag')
const script=await readFile(resolve(output,'google-tag.js'),'utf8')
const source=JSON.parse(await readFile(resolve(output,'tag-source.json'),'utf8'))
assert.equal(createHash('sha256').update(script).digest('hex'),source.sha256)
const live=process.argv.includes('--approved-ingestion')
const ledger={startedAt:new Date().toISOString(),tagSha256:source.sha256,attemptedPageViews:0,requests:[],stopped:false}
const ledgerPath=resolve(output,'approved-ingestion-ledger.json')
if(live){
 assert.equal(source.safeSettings,true,'Saved tag settings must pass')
 const rehearsal=JSON.parse(await readFile(resolve(output,'real-tag-results.json'),'utf8'))
 assert.equal(rehearsal.tagSha256,source.sha256,'Rehearsal must use this exact tag')
 assert.ok(rehearsal.results.length===2&&rehearsal.results.every(r=>r.checks.every(c=>c.pass)))
 await writeFile(ledgerPath,JSON.stringify(ledger,null,2),{flag:'wx'}) // cannot silently rerun
}
const id='G-FKFR4SFML9'
const privateTokens=['analytics-consent-synthetic','SYNTHETIC PRIVATE NAME','analytics-consent@example.test']
const prohibited=privateTokens.flatMap(value=>[value,createHash('sha256').update(value.toLowerCase()).digest('hex')])
Object.assign(process.env,BROWSER_TEST_CORE_ENVIRONMENT)
const server=await createServer({mode:'browser-test',plugins:[{name:'isolated-real-tag',enforce:'pre',transform(code,path){
 if(path.endsWith('/src/services/analyticsController.js'))return code.replace("const configured = import.meta.env.VITE_ANALYTICS_CONSENT_ENABLED === 'true'\n  && import.meta.env.MODE !== 'browser-test'\n  && /^G-[A-Z0-9]+$/.test(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '')","const configured = true").replace('const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID',`const measurementId = '${id}'`)
}}],server:{host:'127.0.0.1',port:4196,strictPort:true}})
await server.listen()
const browser=await chromium.launch({args:['--disable-dev-shm-usage']})
const results=[]
try{
 for(const signedIn of [false,true]){
  let phase='fresh'
  const packets=[],external=[],checks=[]
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'})
  context.setDefaultTimeout(15000)
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url())
   if(url.hostname==='127.0.0.1'&&['4196','9099','8080','5001'].includes(url.port))return route.continue()
   external.push({phase,host:url.hostname,path:url.pathname})
   if(url.hostname==='www.googletagmanager.com'&&url.pathname==='/gtag/js'&&url.searchParams.get('id')===id)return route.fulfill({contentType:'application/javascript',body:script})
   if(url.hostname==='firebase.googleapis.com'&&url.pathname.includes('/webConfig'))return route.fulfill({json:{appId:process.env.VITE_FIREBASE_APP_ID,measurementId:id}})
   if(url.hostname==='firebaseinstallations.googleapis.com')return route.fulfill({json:{fid:'c1234567890123456789012',refreshToken:'SYNTHETIC',authToken:{token:'SYNTHETIC',expiresIn:'604800s'}}})
   if(url.pathname.endsWith('/collect')){
    const start=packets.length
    for(const line of (req.postData()??'').split('\n')){
     const params=new URLSearchParams(url.search)
     for(const[k,v]of new URLSearchParams(line))params.set(k,v)
     const raw=params.toString()
     packets.push({phase,event:params.get('en'),location:params.get('dl'),title:params.get('dt'),referrer:params.get('dr'),hasPrivateMarker:/PRIVATE|SECRET|example\.test/.test(decodeURIComponent(raw))||prohibited.some(value=>decodeURIComponent(raw).includes(value)),noAccountUserId:['',null,'null'].includes(params.get('uid')),advertisingDisabled:params.get('npa')==='1',parameterNames:[...params.keys()]})
    }
    if(live){
     try{
      const batch=packets.slice(start)
      validateProbeRequest(url,batch,ledger.attemptedPageViews,ledger.stopped)
      ledger.attemptedPageViews+=batch.length // persist attempt BEFORE sending; no retries
      const record={signedIn,phase,pageViews:batch.length,host:url.hostname,status:null}
      ledger.requests.push(record)
      await writeFile(ledgerPath,JSON.stringify(ledger,null,2))
      const response=await route.fetch({maxRetries:0,maxRedirects:0,timeout:15000})
      record.status=response.status()
      if(response.status()!==204)throw new Error(`Measurement HTTP ${response.status()}`)
      await writeFile(ledgerPath,JSON.stringify(ledger,null,2))
      return route.fulfill({response})
     }catch(error){
      ledger.stopped=true;ledger.failure=error.message
      await writeFile(ledgerPath,JSON.stringify(ledger,null,2))
      return route.fulfill({status:503})
     }
    }
    return route.fulfill({status:204})
   }
   return route.abort()
  })
  const page=await context.newPage()
  await page.goto('http://127.0.0.1:4196/events?email=PRIVATE#SECRET')
  await page.getByRole('button',{name:'Accept analytics',exact:true}).waitFor()
  if(signedIn){await page.evaluate(async()=>{const{getFirebaseAuth}=await import('/src/firebase/auth.js');const{signInWithEmailAndPassword}=await import('/node_modules/.vite/deps/firebase_auth.js');await signInWithEmailAndPassword(getFirebaseAuth(),'analytics-consent@example.test','Synthetic-Only!123')})}
  await page.waitForTimeout(1000)
  checks.push({name:'no-choice-no-google',pass:external.length===0})
  phase='accepted'
  await page.getByRole('button',{name:'Accept analytics',exact:true}).click()
  await page.waitForTimeout(6000)
  checks.push({name:'accept-generates-real-page-view',pass:packets.filter(p=>p.phase==='accepted'&&p.event==='page_view').length===1})
  checks.push({name:'accept-creates-google-cookie',pass:(await context.cookies()).some(c=>c.name==='_ga')})
  const navigate=async path=>{await page.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))},path);await page.waitForTimeout(7000)}
  phase='public-navigation';await navigate('/services?search=SECRET')
  checks.push({name:'one-public-page-view',pass:packets.filter(p=>p.phase==='public-navigation'&&p.event==='page_view').length===1})
  phase='query-only';await navigate('/services?search=PRIVATE')
  checks.push({name:'no-query-only-page-view',pass:packets.filter(p=>p.phase==='query-only'&&p.event==='page_view').length===0})
  phase='private-navigation';await navigate('/login?token=SECRET')
  checks.push({name:'no-private-collection',pass:packets.filter(p=>p.phase==='private-navigation').length===0})
  phase='return-public';await navigate('/events')
  phase='withdrawn'
  await page.getByRole('button',{name:'Privacy settings',exact:true}).click()
  await page.getByRole('button',{name:'Reject analytics',exact:true}).click()
  await navigate('/community?email=PRIVATE')
  checks.push({name:'withdrawal-stops-real-tag',pass:packets.filter(p=>p.phase==='withdrawn').length===0})
  checks.push({name:'google-cookies-removed',pass:!(await context.cookies()).some(c=>/^_ga|^_gid|^_gat/.test(c.name))})
  phase='rejected-reload';const before=external.length
  await page.reload();await page.getByRole('heading',{level:1}).waitFor();await page.waitForTimeout(1000)
  checks.push({name:'rejected-reload-no-google',pass:external.length===before})
  checks.push({name:'no-private-payloads',pass:packets.every(p=>!p.hasPrivateMarker&&p.noAccountUserId)})
  checks.push({name:'advertising-disabled-on-wire',pass:packets.length>0&&packets.every(p=>p.advertisingDisabled)})
  results.push({signedIn,checks,packets,external,actualGoogleMeasurementRequests:live?ledger.requests.filter(r=>r.signedIn===signedIn).length:0})
  console.log(JSON.stringify({signedIn,checks}))
  await context.close()
 }
}finally{
 await mkdir(output,{recursive:true})
 await writeFile(resolve(output,live?'approved-ingestion-results.json':'real-tag-results.json'),JSON.stringify({tagSha256:source.sha256,results},null,2))
 await browser.close();await server.close()
}
assert.ok(results.length===2&&results.every(r=>r.checks.every(c=>c.pass)),'Real tag acceptance failed; inspect sanitized durable evidence')

if(live)assert.equal(ledger.stopped,false,'Ingestion stopped; inspect ledger, do not rerun')
