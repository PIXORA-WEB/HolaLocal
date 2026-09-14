// Run with Node 20+. No server, Firebase credentials, or external application traffic.
// --baseline uses the approved profile markup and global CSS.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const website = resolve(here, '../../..')
const src = resolve(website, 'src')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-profile-actions-'))
const baseline = process.argv.includes('--baseline')
const sourceRoot = process.argv.find(arg => arg.startsWith('--source-root='))?.slice('--source-root='.length)
const denied='()=>{throw new Error("Unexpected synthetic service call")}'
const replacements = {
 'hooks/useAuthentication.js':'const refreshUserProfile=async()=>{};export default ()=>({user:window.h.user,userProfile:window.h.profile,updateUserProfile:window.h.save,refreshUserProfile});',
 'services/analyticsController.js':'export const updateAnalyticsRoute=()=>{};export const watchAnalyticsChoice=()=>()=>{};',
 'services/profileMediaPresentation.js':'export const loadProfileMediaPresentation=async()=>null;',
}
for(const file of ['firebase/auth.js','firebase/storageClient.js','services/userService.js','services/accountDeletionService.js']){
 const source=await readFile(resolve(src,file),'utf8'); const names=[...source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)].map(m=>m[1]);replacements[file]=names.map(name=>`export const ${name}=${name==='getAuthenticationErrorMessage'?'()=>"Synthetic error"':denied};`).join('')
}
const reports=await readFile(resolve(src,'services/reportService.js'),'utf8');replacements['services/reportService.js']='export const businessReportReasons='+reports.match(/export const businessReportReasons = (\[[\s\S]*?\n\])/)[1]+';'
if(baseline)for(const file of ['pages/customer/ProfilePage.jsx','styles/global.css'])replacements[file]=execFileSync('git',['show','330640857853cc2837c8af2f3703b5b4944dc33f:apps/holalocal-website/src/'+file],{cwd:website,encoding:'utf8'})
if(sourceRoot) for(const file of ['pages/customer/ProfilePage.jsx','styles/global.css']) replacements[file]=await readFile(resolve(sourceRoot,'src',file),'utf8')
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': JSON.stringify('development') }, plugins: [{ name: 'synthetic-auth-boundaries', enforce: 'pre', transform(code, id) { for (const [path, replacement] of Object.entries(replacements)) if (id === resolve(src, path)) return replacement } }], esbuild: { jsx: 'automatic' }, build: { outDir: resolve(out, 'dist'), minify: false } })
const results = [], blocked = []
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
const flush = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function scenario(width, name, run, query = '', height = 800) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height }, hasTouch: width === 390 })
  const errors = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:18466') { blocked.push(url.href); return route.abort() }
    const path = url.pathname.startsWith('/assets/') ? url.pathname : '/index.html'
    if (path.includes('..')) return route.abort()
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html' })
  })
  const p = await context.newPage()
  p.setDefaultTimeout(5000)
  p.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message) })
  try {
    await p.goto('http://127.0.0.1:18466/' + query)
    await p.waitForFunction(() => Boolean(window.h?.t), null, { timeout: 5000 })
    await p.getByRole('button', {name:await p.evaluate(()=>window.h.t('profile.edit')),exact:true}).waitFor()
    if(!query.includes('hidden'))await p.waitForFunction(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--analytics-bar-height'))>0)
    await run(p)
    assert.deepEqual(errors, [])
    results.push({ width, height, name, pass: true, calls:await p.evaluate(()=>window.h.calls.length) })
  } catch (error) { results.push({ width, height, name, pass: false, error: error.stack, state: await p.evaluate(() => window.h?.state), events: await p.evaluate(() => window.h?.events) }) }
  console.log("SCENARIO", width, name, results.at(-1)?.pass)
  await context.close()
}
async function open(p){const button=p.getByRole('button',{name:await p.evaluate(()=>window.h.t('profile.edit')),exact:true});await button.evaluate(el=>window.h.opener=el);await button.click();await p.locator('dialog[open] .profile-edit-form').waitFor()}
async function fieldEvidence(p,id){
 await p.locator('#'+id).focus(); await flush(p)
 return p.locator('#'+id).evaluate(el=>{
  const actions=document.querySelector('dialog[open] .profile-edit-form__actions'),dialog=el.closest('dialog'),r=el.getBoundingClientRect(),a=actions.getBoundingClientRect(),d=dialog.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)
  return {id:el.id,field:{top:r.top,bottom:r.bottom},actions:{top:a.top,bottom:a.bottom,height:a.height},dialog:{top:d.top,bottom:d.bottom},hit:hit===el,focused:document.activeElement===el,overlap:r.bottom>a.top&&r.top<a.bottom,analytics:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--analytics-bar-height'))||0,rootPadding:parseFloat(getComputedStyle(document.getElementById('root')).paddingBottom),actionPosition:getComputedStyle(actions).position,actionBottom:getComputedStyle(actions).bottom}
 })
}
function usable(m){assert.equal(m.focused,true);assert.equal(m.hit,true,JSON.stringify(m));assert.equal(m.overlap,false,JSON.stringify(m));assert.ok(m.field.top>=m.dialog.top&&m.field.bottom<=m.dialog.bottom,JSON.stringify(m))}
async function actionsReachable(p){
 const rows=await p.locator('dialog[open] .profile-edit-form__actions button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),d=el.closest('dialog').getBoundingClientRect();return {visible:r.top>=d.top&&r.bottom<=d.bottom,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}))
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.visible&&r.hit),JSON.stringify(rows))
}
async function restored(p){await p.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await p.evaluate(()=>document.activeElement===window.h.opener),true)}
async function scrollToBottom(p) {
 const m = await p.locator('dialog[open]').evaluate(dialog => {
  const body = dialog.querySelector('.profile-edit-form__body')
  const panel = dialog.querySelector('.profile-edit-dialog__panel')
  const scroller = body && getComputedStyle(body).overflowY === 'auto' ? body : panel
  scroller.scrollTop = 0
  const before = scroller.scrollTop
  scroller.scrollTop = scroller.scrollHeight
  return { before, after: scroller.scrollTop, max: scroller.scrollHeight - scroller.clientHeight, overflow: getComputedStyle(scroller).overflowY }
 })
 if (m.max > 1) { assert.ok(m.after > m.before, JSON.stringify(m)); assert.ok(Math.abs(m.after-m.max)<2, JSON.stringify(m)) }
 return m
}
for(const width of [1440,390])for(const hidden of [false,true]){
 const query=hidden?'?hidden=1':''
 for(const id of ['edit-last-name','edit-country'])await scenario(width,`${hidden?'hidden':'visible'} consent focused ${id}`,async p=>{
  await open(p);const m=await fieldEvidence(p,id);results.push({width,hidden,measurement:m});await p.screenshot({path:resolve(out,`${width}-${hidden}-${id}.png`)});usable(m);await actionsReachable(p)
  assert.equal(Math.round(m.rootPadding),Math.round(m.analytics))
  await p.keyboard.press('Escape');await restored(p)
 },query)
 await scenario(width,`${hidden?'hidden':'visible'} consent keyboard/bottom/cancel`,async p=>{
  await open(p);await p.locator('#edit-first-name').focus()
  for(let i=0;i<5;i++){const id=await p.evaluate(()=>document.activeElement.id);if(['edit-first-name','edit-last-name','edit-city','edit-country'].includes(id))usable(await fieldEvidence(p,id));await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>!!document.activeElement.closest('dialog[open]')),true)}
  await scrollToBottom(p)
  await actionsReachable(p);usable(await fieldEvidence(p,'edit-country'))
  await p.locator('dialog[open] .profile-edit-form__actions button[type="button"]').click();await restored(p)
 },query)
 await scenario(width,`${hidden?'hidden':'visible'} consent validation pending failure and retry`,async p=>{
  await open(p);await p.locator('#edit-first-name').fill(' ')
  await p.locator('dialog[open] button[type="submit"]').click();assert.equal(await p.locator('#edit-first-name').getAttribute('aria-invalid'),'true');usable(await fieldEvidence(p,'edit-first-name'));assert.equal(await p.evaluate(()=>window.h.calls.length),0)
  await p.locator('#edit-first-name').fill('Anna');await p.locator('dialog[open] button[type="submit"]').click()
  assert.equal(await p.locator('dialog[open] .profile-edit-form__actions button:disabled').count(),2)
  await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),1)
  await p.evaluate(()=>window.h.rejectSave());await p.locator('dialog[open] [role="alert"]').waitFor();await actionsReachable(p);usable(await fieldEvidence(p,'edit-country'))
  await p.locator('dialog[open] button[type="submit"]').click();await p.evaluate(()=>window.h.resolveSave());await restored(p);assert.equal(await p.evaluate(()=>window.h.calls.length),2)
 },query)
 await scenario(width,`${hidden?'hidden':'visible'} consent shared report actions`,async p=>{
  await p.locator('#report-open').click();await p.locator('.report-dialog[open]').waitFor()
  const m=await p.locator('.report-dialog .profile-edit-form__actions').evaluate(el=>({position:getComputedStyle(el).position,bottom:getComputedStyle(el).bottom,margin:getComputedStyle(el).margin,padding:getComputedStyle(el).padding}));results.push({width,hidden,report:m})
  assert.equal(m.position,'sticky')
  await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await p.locator('#report-open').evaluate(el=>el===document.activeElement),true)
 },query)
}

await scenario(390, 'account deletion retains panel scrolling', async p => {
 const opener = p.getByRole('button', { name: await p.evaluate(() => window.h.t('accountDeletion.request.open')), exact: true })
 await opener.click()
 await p.locator('dialog[open]').waitFor()
 const scroll = await scrollToBottom(p)
 results.push({ deletionScroll: scroll })
 assert.equal(scroll.overflow, 'auto')
 assert.ok(scroll.max > 0)
 const accessible = await p.locator('dialog[open] .auth-actions button').evaluateAll(es => es.every(e => { const r=e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) }))
 assert.ok(accessible)
 await p.keyboard.press('Escape')
 assert.ok(await opener.evaluate(e => document.activeElement === e))
}, '', 480)

for (const locale of ['en','de']) for (const hidden of [false,true]) for (const stress of [false,true]) {
 await scenario(320, `${locale} short viewport ${hidden?'hidden':'visible'} consent ${stress?'artificial wrapped actions':'current labels'}`, async p => {
  await open(p)
  const pageScroll = await p.evaluate(() => scrollY)
  if(stress) await p.locator('dialog[open] .profile-edit-form__actions button').evaluateAll(es => es.forEach(e => { e.textContent += ' – Änderungen am persönlichen Profil bestätigen' }))
  const fields=[]
  for(const id of ['edit-first-name','edit-last-name','edit-language','edit-city','edit-country']) {
   await p.locator('#'+id).focus()
   await p.locator('#'+id).evaluate(e => e.scrollIntoView({block:'center',behavior:'instant'}))
   const m=await fieldEvidence(p,id); fields.push(m); usable(m)
  }
  const scroll = await scrollToBottom(p)
  await actionsReachable(p)
  assert.equal(await p.evaluate(() => scrollY), pageScroll)
  const bodyOverflow=await p.locator('.profile-edit-form__body').evaluate(e=>getComputedStyle(e).overflowY)
  const scrollingRegions=await p.locator('dialog[open]').evaluate(d => [d,...d.querySelectorAll('*')].filter(e => ['auto','scroll'].includes(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1).length)
  assert.equal(scrollingRegions, 1)
  results.push({locale,hidden,stress,fields,scroll,bodyOverflow})
  await p.screenshot({path:resolve(out,`short-${locale}-${hidden}-${stress}.png`)})
  await p.locator('dialog[open] .profile-edit-form__actions button[type="button"]').click()
  await restored(p)
 }, `?locale=${locale}${hidden?'&hidden=1':''}`, 480)
}
await scenario(390, 'Enter ownership pending and post-error Escape', async p => {
 await open(p)
 assert.ok(await p.locator('dialog[open]').evaluate(d => [...d.querySelectorAll('input,button[type="submit"]')].every(e => e.form === d.querySelector('form'))))
 await p.locator('#edit-country').press('Enter')
 await p.waitForFunction(()=>window.h.calls.length===1)
 assert.equal(await p.locator('dialog[open] .profile-edit-form__actions button:disabled').count(),2)
 await p.keyboard.press('Escape'); assert.equal(await p.locator('dialog[open]').count(),1)
 await p.evaluate(()=>window.h.rejectSave())
 await p.locator('dialog[open] [role="alert"]').waitFor()
 usable(await fieldEvidence(p,'edit-country'))
 await p.keyboard.press('Escape'); await restored(p)
})
await browser.close()
const cases=results.filter(r=>'pass'in r)
await writeFile(resolve(out,'results.json'),JSON.stringify({baseline,sourceRoot,results,blocked},null,2))
for(const r of cases)console.log(r.pass?'PASS':'FAIL',r.width,r.name,r.pass?'':r.error)
console.log('Artifacts:',out);console.log(`${cases.filter(r=>r.pass).length}/${cases.length} passed; external requests: ${blocked.length}`)
if(cases.some(r=>!r.pass)||blocked.length)process.exitCode=1
