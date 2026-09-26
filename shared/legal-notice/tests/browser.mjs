// Offline component integration: real website/mobile wrappers, real shared coordinator,
// bounded synthetic future publications, injected auth/Firestore doubles. No application bootstrap.
import { mkdir, writeFile, readFile, symlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const root=fileURLToPath(new URL('../../../',import.meta.url))
const evidence=process.env.NOTICE_EVIDENCE_DIR || '/tmp/holalocal-legal-update-notice-evidence'
await mkdir(evidence,{recursive:true})
const fixture=path.join(evidence,'browser-fixture');await mkdir(fixture,{recursive:true})
try { await symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules')) } catch(e) { if(e.code!=='EEXIST')throw e }
await writeFile(path.join(fixture,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="outside">Outside</button><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>')
await writeFile(path.join(fixture,'entry.jsx'),`
import React from 'react'; import {createRoot} from 'react-dom/client';
import Website from '${root}apps/holalocal-website/src/components/common/LegalUpdateNotice.jsx';
import Mobile from '${root}apps/holalocal-app/src/components/common/LegalUpdateNotice.jsx';
window.state={uid:new URLSearchParams(location.search).has('signedOut')?null:'owner',locale:'en',pathname:'/profile',surface:'website',fail:false,hold:false,loading:false};
window.profile={accountStatus:'active',privacyVersion:'1.0',termsVersion:'1.0',privacyAcceptedAt:10,termsAcceptedAt:20};
window.publication={privacyVersion:'1.2',termsVersion:'1.2',privacyEffectiveDate:'2026-09-13',termsEffectiveDate:'2026-09-13'};
window.writes=[];window.listeners=new Set();
window.client={subscribe(uid,fn){window.listeners.add(fn);fn({profile:{...window.profile},publication:{...window.publication}});return()=>window.listeners.delete(fn)},async acknowledge(uid,shown){
window.writes.push({uid,shown});if(window.state.hold)await new Promise(r=>window.release=r);if(window.state.fail)throw Error('offline');
for(const k of Object.keys(shown))if(shown[k]!==window.publication[k+'Version'])throw Error('stale');
const update=Object.fromEntries(Object.entries(shown).map(([k,v])=>[k+'NoticeVersion',v]));Object.assign(window.profile,update);return update}};
const app=createRoot(document.getElementById('root'));
window.render=()=>app.render(window.state.surface==='website'?<Website/>:<Mobile/>);
window.emit=()=>window.listeners.forEach(fn=>fn({profile:{...window.profile},publication:{...window.publication}}));
window.render();
`)
const mock=(name)=>'\0notice-'+name
const server=await createServer({configFile:false,root:fixture,server:{host:'127.0.0.1',port:18771,strictPort:true,fs:{allow:[root,evidence,'/home/cevans2k11/Projects/HolaLocal/apps/holalocal-website/node_modules']}},
 resolve:{dedupe:['react','react-dom'],alias:{'@holalocal/firebase-contract':path.join(root,'shared/firebase-contract/index.js')}},
 plugins:[{name:'offline-notice-mocks',enforce:'pre',resolveId(source){
 if(source.endsWith('/hooks/useAuthentication.js'))return mock('auth')
 if(source==='react-i18next')return mock('i18n')
 if(source==='react-router-dom')return mock('router')
 if(source.endsWith('/firebase/firestoreClient.js')||source.endsWith('/firebase/config.js'))return mock('db')
 if(source.endsWith('/shared/legal-notice/client.js'))return mock('client')
 },load(id){
 if(id===mock('auth'))return 'export default ()=>({user:window.state.uid?{uid:window.state.uid}:null,userProfile:window.profile,emailVerified:true,loading:window.state.loading,profileLoading:false})'
 if(id===mock('i18n'))return 'export const useTranslation=()=>({i18n:{resolvedLanguage:window.state.locale}})'
 if(id===mock('router'))return 'export const useLocation=()=>({pathname:window.state.pathname})'
 if(id===mock('db'))return 'export const db={}'
 if(id===mock('client'))return 'export const createLegalNoticeClient=()=>({subscribe:(...a)=>window.client.subscribe(...a),acknowledge:(...a)=>window.client.acknowledge(...a)})'
 },transform(code,id){
 if(id.endsWith('/shared/firebase-contract/legalNotice.js'))return code.replace('export const legalNoticeContract = createLegalNoticeContract()',"export const legalNoticeContract = createLegalNoticeContract({privacy:['1.0','1.1','1.2','1.3'],terms:['1.0','1.1','1.2']})")
 }}],esbuild:{jsx:'automatic'},optimizeDeps:{include:['react','react-dom/client','react/jsx-dev-runtime']}})
const records=[];let browser
try {
 await server.listen();browser=await chromium.launch({headless:true})
 const page=await browser.newPage();const external=[];const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort()}return route.continue()})
 const reset=async(surface='website',locale='en',width=390,height=844)=>{await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:18771');await page.waitForFunction(()=>!!window.render);await page.evaluate(({surface,locale})=>{window.state.surface=surface;window.state.locale=locale;window.render()},{surface,locale});await page.locator('dialog[open]').waitFor()}
 async function check(name,fn){if(process.env.NOTICE_BROWSER_FILTER && !name.includes(process.env.NOTICE_BROWSER_FILTER))return;await fn();records.push({name,passed:true})}
 await check('website lazy boundary waits for authentication, loads automatically and restores focus',async()=>{
  const heavy=[];const record=r=>{if(r.url().includes('/LegalUpdateNoticeContent.jsx'))heavy.push(r.url())};page.on('request',record)
  await page.goto('http://127.0.0.1:18771/?signedOut');await page.waitForFunction(()=>!!window.render);await page.waitForTimeout(150)
  assert.equal(heavy.length,0);assert.equal(await page.locator('dialog').count(),0)
  await page.evaluate(()=>{window.state.uid='owner';window.state.loading=true;window.render()});await page.waitForTimeout(100);assert.equal(heavy.length,0)
  await page.locator('#outside').focus()
  await page.evaluate(()=>{window.state.loading=false;window.render()});await page.locator('dialog[open]').waitFor()
  assert.equal(heavy.length,1);assert.equal(await page.locator('dialog').count(),1)
  assert.ok(await page.locator('dialog').evaluate(d=>d.contains(document.activeElement)))
  await page.getByRole('button',{name:'Remind me later'}).click()
  assert.equal(await page.evaluate(()=>document.activeElement.id),'outside');assert.equal(await page.evaluate(()=>window.writes.length),0)
  page.off('request',record)
 })
 await check('website chunk load failure remains nonblocking and never acknowledges',async()=>{
  await page.route('**/LegalUpdateNoticeContent.jsx*',r=>r.abort())
  await page.goto('http://127.0.0.1:18771/?signedOut');await page.waitForFunction(()=>!!window.render)
  await page.evaluate(()=>{window.state.uid='owner';window.render()});await page.waitForTimeout(3500)
  await page.locator('#outside').click();assert.equal(await page.locator('dialog').count(),0);assert.equal(await page.evaluate(()=>window.writes.length),0)
  await page.unroute('**/LegalUpdateNoticeContent.jsx*')
 })
 await check('website lightweight wrapper import structure',async()=>{
  const s=await readFile(path.join(root,'apps/holalocal-website/src/components/common/LegalUpdateNotice.jsx'),'utf8')
  assert.match(s,/import\('\.\/LegalUpdateNoticeContent\.jsx'\)/)
  assert.doesNotMatch(s,/from ['"][^'"]*(?:firestore|legal-notice|LegalUpdateNoticeContent)/)
 })
 for(const surface of ['website','mobile'])for(const [width,height]of [[1280,900],[390,844],[320,700]])for(const locale of ['en','de','es',...(surface==='website'?['uk']:[])])await check(surface+' '+locale+' '+width,async()=>{
  await reset(surface,locale,width,height)
  const dialog=page.getByRole('dialog');assert.ok(await dialog.getAttribute('aria-labelledby'))
  const geometry=await page.evaluate(()=>{const d=document.querySelector('dialog');return {overflow:document.documentElement.scrollWidth>innerWidth||d.scrollWidth>d.clientWidth,heights:[...d.querySelectorAll('button')].map(x=>x.getBoundingClientRect().height),focus:d.contains(document.activeElement)}})
  assert.equal(geometry.overflow,false);assert.ok(geometry.heights.every(n=>n>=44));assert.ok(geometry.focus)
  await dialog.locator('button').first().focus();await page.keyboard.press('Tab');assert.ok(await dialog.locator('button').last().evaluate(e=>e===document.activeElement))
  await page.screenshot({path:path.join(evidence,`${surface}-${locale}-${width}.png`)})
 })
 for(const surface of ['website','mobile']) {
 await check(surface+' acknowledges with keyboard, exact links/date and history preserved',async()=>{
  await reset(surface);assert.equal(await page.getByRole('link').first().getAttribute('href'),'https://www.holalocal.es/privacy');assert.equal(await page.getByRole('link').last().getAttribute('href'),'https://www.holalocal.es/terms')
  assert.match(await page.locator('dialog').textContent(),/September/)
  await page.getByRole('button',{name:'I’ve seen the update'}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('dialog').open)
  assert.deepEqual(await page.evaluate(()=>[window.profile.privacyVersion,window.profile.termsVersion,window.profile.privacyAcceptedAt,window.profile.termsAcceptedAt]),['1.0','1.0',10,20])
 })
 await check(surface+' later/Escape no write, account/logout reset and session loading stable',async()=>{
  await reset(surface);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.writes.length),0)
  await page.evaluate(()=>{window.emit();window.state.loading=true;window.render()});await page.waitForTimeout(40)
  await page.evaluate(()=>{window.state.loading=false;window.render()});assert.equal(await page.locator('dialog').evaluate(d=>d.open),false)
  await page.evaluate(()=>{window.state.uid=null;window.render()});await page.waitForTimeout(40)
  await page.evaluate(()=>{window.state.uid='other';window.render()});await page.locator('dialog[open]').waitFor()
 })
 await check(surface+' failure stays pending and retries; duplicate blocked',async()=>{
  await reset(surface);await page.evaluate(()=>{window.state.fail=true;window.state.hold=true});await page.getByRole('button',{name:'I’ve seen the update'}).click();assert.ok(await page.getByRole('button',{name:'Saving…'}).isDisabled())
  await page.evaluate(()=>window.release());await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.profile.privacyNoticeVersion),undefined)
  await page.evaluate(()=>{window.state.fail=false;window.state.hold=false});await page.getByRole('button',{name:'I’ve seen the update'}).click();await page.waitForFunction(()=>!document.querySelector('dialog').open)
 })
 await check(surface+' global route coverage and recovery exclusion',async()=>{
  await reset(surface)
  for(const route of ['/business/dashboard','/messages','/profile',...(surface==='website'?['/admin']:[])]){await page.evaluate(route=>{window.state.pathname=route;window.render()},route);await page.locator('dialog[open]').waitFor()}
  for(const route of ['/login','/register','/auth/action','/verify-email','/legal-consent','/privacy']){await page.evaluate(route=>{window.state.pathname=route;window.render()},route);await page.waitForFunction(()=>!document.querySelector('dialog').open)}
 })
 }
 await check('explicit later and backdrop defer without acknowledgement',async()=>{
  await reset();await page.getByRole('button',{name:'Remind me later'}).click();assert.equal(await page.evaluate(()=>window.writes.length),0);assert.equal(await page.locator('dialog').evaluate(d=>d.open),false)
  await reset();await page.mouse.click(2,2);assert.equal(await page.evaluate(()=>window.writes.length),0);assert.equal(await page.locator('dialog').evaluate(d=>d.open),false)
 })
 await check('keyboard focus remains inside modal',async()=>{
  await reset();for(let n=0;n<10;n++){await page.keyboard.press('Tab');assert.ok(await page.locator('dialog').evaluate(d=>d.contains(document.activeElement)))}
 })
 await check('stale displayed request cannot acknowledge newer publication',async()=>{
  await reset();await page.evaluate(()=>window.state.hold=true);await page.getByRole('button',{name:'I’ve seen the update'}).click()
  await page.evaluate(()=>{window.publication.privacyVersion='1.3';window.emit();window.release()});await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.profile.privacyNoticeVersion),undefined)
 })
 await check('late acknowledgement from old account does not close new account notice',async()=>{
  await reset();await page.evaluate(()=>window.state.hold=true);await page.getByRole('button',{name:'I’ve seen the update'}).click()
  await page.evaluate(()=>{window.state.uid='other';window.render()});await page.waitForTimeout(40);await page.evaluate(()=>window.release());await page.waitForTimeout(40)
  assert.ok(await page.locator('dialog').evaluate(d=>d.open))
 })
 await check('rollback preserves newer acknowledgement and only remaining document is shown',async()=>{
  await reset();await page.evaluate(()=>{window.profile.privacyNoticeVersion='1.3';window.emit()})
  await page.getByRole('heading',{name:'Terms updated',exact:true}).waitFor()
  await page.getByRole('button',{name:'I’ve seen the update'}).click();await page.waitForFunction(()=>!document.querySelector('dialog').open)
  assert.equal(await page.evaluate(()=>window.profile.privacyNoticeVersion),'1.3')
  assert.deepEqual(await page.evaluate(()=>window.writes[0].shown),{terms:'1.2'})
  await page.evaluate(()=>window.emit());await page.waitForTimeout(50);assert.equal(await page.locator('dialog').evaluate(d=>d.open),false)
 })
 await check('bootstrap and unavailable registry show no fabricated notice',async()=>{await reset();for(const pub of [null,{}, {...await page.evaluate(()=>window.publication),privacyVersion:'1.1',termsVersion:'1.1'}]) {await page.evaluate(pub=>{window.publication=pub;window.emit()},pub);await page.waitForFunction(()=>!document.querySelector('dialog').open)}})
 await check('root ownership static check both applications',async()=>{for(const app of ['holalocal-website','holalocal-app']){const s=await readFile(path.join(root,'apps',app,'src/routes/AppRoutes.jsx'),'utf8');assert.match(s,/<BrowserRouter>\s*<LegalUpdateNotice \/>/)}})
 assert.deepEqual(external,[]);assert.deepEqual(errors,[])
 await writeFile(path.join(evidence,'browser-results.json'),JSON.stringify({passed:records.length,failed:0,records,externalRequests:external,pageErrors:errors},null,2))
 console.log(`${records.length} browser checks passed; no external requests`)
} finally {await browser?.close();await server.close()}
