// Run with Node 20+. No server, Firebase credentials, or external application traffic.
// --baseline uses the approved batch 6 admin stylesheet.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const website = resolve(here, '../../..')
const src = resolve(website, 'src')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-admin-review-styles-'))
const baseline = process.argv.includes('--baseline')
const denied = '()=>{throw new Error("Unexpected synthetic service call")}'
const replacements = {
  'firebase/config.js': 'export const getFirebaseApp=()=>({});export const getFirebaseAuth=()=>({currentUser:window.h.user});',
  'hooks/useAuthentication.js': 'const refreshUserProfile=async()=>{};const signOutUser=async()=>{};export default ()=>({user:window.h.user,userProfile:window.h.profile,refreshUserProfile,signOutUser,profileLoading:false});',
  'services/profileMediaPresentation.js': 'export const loadProfileMediaPresentation=async()=>null;',
  'utils/customerReviewsFlag.js': 'export const customerReviewsEnabled=true;',
  'services/customerReviewService.js': 'export const customerReviewService={summaries:async({businessIds})=>businessIds.map(businessId=>({businessId,available:true,count:3,average:4.5})),listPublic:async()=>({items:[],nextCursor:null}),getOwn:async()=>null,listOwn:async()=>({items:[window.h.own],nextCursor:null})};',
  'services/adminCustomerReviewService.js': 'export const adminCustomerReviewService=()=>window.h.adminApi;',
}
for (const file of ['services/businessService.js','services/publicBusinessService.js','services/businessInsightsService.js','services/savedBusinessService.js','services/conversationService.js','services/reportService.js','firebase/auth.js','firebase/storageClient.js']) {
  const source=await readFile(resolve(src,file),'utf8')
  const names=[...source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)].map(m=>m[1])
  replacements[file]=names.map(name=>{
    let value=denied
    if (['getFeaturedActiveBusinesses','getActivePublicBusinesses'].includes(name)) value='async()=>window.h.businesses'
    if (name==='getPublicBusinessById') value='async id=>window.h.businesses.find(b=>b.businessId===id)'
    if (name==='ensureBusinessProfile'||name==='getBusinessById') value='async()=>({...window.h.business,status:"draft"})'
    if (name==='getSavedBusinessState') value='async()=>({saved:false})'
    if (name==='getFirebaseAuth') value='()=>({currentUser:window.h.user})'
    if (name==='getAuthenticationErrorMessage') value='()=>"Synthetic error"'
    if (name==='recordPublicProfileView'||name==='recordPublicContactAction') value='async()=>{}'
    return `export const ${name}=${value};`
  }).join('')
}
const reportSource=await readFile(resolve(src,'services/reportService.js'),'utf8')
replacements['services/reportService.js']='export const businessReportReasons='+reportSource.match(/export const businessReportReasons = (\[[\s\S]*?\n\])/)[1]+';export const createBusinessReport='+denied+';'
if(baseline) replacements['styles/adminCustomerReviews.css']=execFileSync('git',['show','5f1d18e8ba773b54186619ffce68201d85fdc45d:apps/holalocal-website/src/styles/adminCustomerReviews.css'],{cwd:website,encoding:'utf8'})
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': JSON.stringify('production') }, plugins: [{ name: 'synthetic-auth-boundaries', enforce: 'pre', resolveId(id){if(id==='firebase/auth')return '\0synthetic-token'}, load(id){if(id==='\0synthetic-token')return 'export const onIdTokenChanged=(auth,fn)=>{queueMicrotask(()=>fn(window.h.user));return()=>{}}'}, transform(code, id) { for (const [path, replacement] of Object.entries(replacements)) if (id === resolve(src, path)) return replacement } }], esbuild: { jsx: 'automatic' }, build: { outDir: resolve(out, 'dist'), manifest: true } })
// Service substitution changes the JS chunk graph. Pin cold CSS preload order to
// the full website build's admin lazy dependency order: admin CSS, then shared CSS.
const cssAssets=await Promise.all((await readdir(resolve(out,'dist/assets'))).filter(f=>f.endsWith('.css')).map(async file=>({file,source:await readFile(resolve(out,'dist/assets',file),'utf8')})))
const adminCss=cssAssets.find(a=>a.source.includes('.admin-review-workspace'))
const sharedCss=cssAssets.find(a=>a.source.includes('.customer-reviews__summary'))
assert.ok(adminCss && sharedCss && adminCss.file!==sharedCss.file)
const results = [], blocked = []
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
const flush = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function scenario(width, name, run, initialPath = '/') {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 900 }, hasTouch: width === 390 })
  const errors = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:18466') { blocked.push(url.href); return route.abort() }
    if (url.pathname === '/broken-logo.png') return route.fulfill({ status: 404, body: '' })
    const path = url.pathname.startsWith('/assets/') ? url.pathname : '/index.html'
    if (path.includes('..')) return route.abort()
    let body=await readFile(resolve(out, 'dist') + path)
    if(path==='/index.html' && url.pathname==='/admin/reviews') body=Buffer.from(body.toString().replace('<div id="root">',`<link rel="stylesheet" href="/assets/${adminCss.file}"><link rel="stylesheet" href="/assets/${sharedCss.file}"><div id="root">`))
    await route.fulfill({ body, contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : extname(path) === '.webp' ? 'image/webp' : 'text/html' })
  })
  const p = await context.newPage()
  p.setDefaultTimeout(5000)
  p.on('pageerror', e => errors.push(e.message))
  try {
    await p.goto('http://127.0.0.1:18466' + initialPath)
    await run(p)
    assert.deepEqual(errors, [])
    assert.equal(await p.evaluate(()=>window.h.writes),0)
    results.push({ width, name, pass: true, stylesheets: await p.evaluate(() => [...document.styleSheets].map(s => s.href)) })
  } catch (error) { results.push({ width, name, pass: false, error: error.stack, state: await p.evaluate(() => window.h?.state), events: await p.evaluate(() => window.h?.events) }) }
  console.log("SCENARIO", width, name, results.at(-1)?.pass)
  await context.close()
}
async function ready(p,route){await p.locator(route==='Admin'?'.admin-customer-reviews':route==='Services'?'.directory-business-card':'.customer-reviews__own').first().waitFor()}
async function navigate(p,route){await p.getByRole('link',{name:'Fixture '+route,exact:true}).click();await ready(p,route);await flush(p)}
async function styles(p,selector){return p.locator(selector).first().evaluate(e=>{const c=getComputedStyle(e);return {padding:c.padding,margin:c.margin,border:c.borderTopWidth,background:c.backgroundColor,font:c.fontSize,lineHeight:c.lineHeight,gap:c.gap,display:c.display}})}
async function queueMeasurement(p){return{container:await styles(p,'.admin-customer-reviews'),paragraph:await styles(p,'.admin-customer-reviews__queue p'),heading:await styles(p,'.admin-customer-reviews__queue h2'),button:await styles(p,'.admin-customer-reviews__queue>.button')}}
function intendedQueue(m){assert.equal(m.container.padding,'0px');assert.equal(m.container.border,'0px');assert.equal(m.container.background,'rgba(0, 0, 0, 0)');assert.equal(m.container.margin.split(' ')[0],'0px');assert.equal(m.paragraph.margin,'0px');assert.equal(m.heading.margin,'0px');assert.equal(m.button.margin,'0px')}
async function reverseOrder(p,adminLast){return p.evaluate(last=>{const sheets=[...document.styleSheets];const has=(s,text)=>[...s.cssRules].some(r=>r.cssText.includes(text));const admin=sheets.find(s=>has(s,'.admin-review-workspace')),shared=sheets.find(s=>has(s,'.customer-reviews__summary'));if(!admin||!shared||admin===shared)throw new Error('Expected separate production CSS assets');document.head.append((last?shared:admin).ownerNode,(last?admin:shared).ownerNode);return [...document.styleSheets].map(s=>s.href)},adminLast)}
async function customerMeasurement(p,route){await ready(p,route);return route==='Services'?{summary:await styles(p,'.customer-reviews__summary')}:{container:await styles(p,'.customer-reviews'),text:await styles(p,'.customer-reviews__own p')}}
function intendedCustomer(m,route,width){if(route==='Services'){assert.equal(m.summary.font,'14.4px');assert.equal(m.summary.lineHeight,'normal')}else{assert.equal(m.container.border,'1px');assert.equal(m.container.padding,width===390?'16px':'24px');assert.equal(m.text.margin,'6.4px 0px')}}
for(const width of [1440,390]){
 for(const from of ['Admin','Services','My Reviews'])await scenario(width,`${from} to admin queue/case/dialog and both CSS orders`,async p=>{
  await ready(p,from);if(from!=='Admin')await navigate(p,'Admin');await p.locator('.admin-customer-reviews__queue').waitFor();await flush(p)
  const initial=await queueMeasurement(p),sheets=await p.evaluate(()=>[...document.styleSheets].map(s=>s.href));results.push({width,from,initial,sheets})
  const queues=[];for(const adminLast of [false,true]){await reverseOrder(p,adminLast);await flush(p);queues.push({adminLast,styles:await queueMeasurement(p)})}results.push({width,from,queues})
  await p.locator('.admin-customer-reviews__queue>.button').click();await p.locator('.admin-customer-reviews__identity').waitFor()
  const caseStyles={identity:await styles(p,'.admin-customer-reviews__identity h2'),actionButton:await styles(p,'.admin-customer-reviews__action>.button'),rejection:await styles(p,'.admin-customer-reviews__rejection'),label:await styles(p,'.admin-customer-reviews__rejection>label')};results.push({width,from,caseStyles})
  const combo=p.getByRole('combobox');await combo.click();assert.equal(await combo.getAttribute('aria-expanded'),'true');await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');assert.equal(await combo.getAttribute('aria-expanded'),'false');assert.equal(await p.getByRole('listbox').isVisible(),false)
  await p.locator('.admin-customer-reviews__action>.button').first().click();await p.locator('dialog[open]').waitFor();const dialog=await styles(p,'dialog[open] .customer-reviews__dialog p');assert.equal(dialog.lineHeight,'24px');await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),0)
  await p.screenshot({path:resolve(out,`case-${width}-${from.replaceAll(' ','-')}.png`)})
  for(const adminLast of [false,true]){const order=await reverseOrder(p,adminLast);await flush(p);const m={identity:await styles(p,'.admin-customer-reviews__identity h2'),button:await styles(p,'.admin-customer-reviews__action>.button'),label:await styles(p,'.admin-customer-reviews__rejection>label')};results.push({width,from,adminLast,order,caseOrder:m});assert.equal(m.identity.margin,'12px 0px');assert.equal(m.button.margin.split(' ')[0],'16px');assert.equal(m.label.gap,'8px')}
  // Record/inspect the natural cold route before imposing either insertion order.
  for(const q of queues)intendedQueue(q.styles);intendedQueue(initial);assert.equal(caseStyles.rejection.margin,'20px 0px 0px');assert.equal(caseStyles.identity.margin,'12px 0px');assert.equal(caseStyles.actionButton.margin.split(' ')[0],'16px')
 },from==='Admin'?'/admin/reviews':from==='Services'?'/services':'/my-reviews')
 for(const state of ['empty','error'])await scenario(width,`admin ${state}`,async p=>{await ready(p,'Admin');await p.locator(state==='empty'?'.admin-empty':'.admin-customer-reviews [role=alert]').waitFor();const m=await styles(p,'.admin-customer-reviews');results.push({width,state,container:m});assert.equal(m.padding,'0px');assert.equal(m.border,'0px');assert.equal((await styles(p,'.admin-customer-reviews p')).margin,'6.4px 0px')},'/admin/reviews?state='+state)
 for(const route of ['Services','My Reviews'])await scenario(width,`customer ${route} unchanged after admin`,async p=>{await ready(p,route);const before=await customerMeasurement(p,route);await navigate(p,'Admin');await p.locator('.admin-customer-reviews__queue').waitFor();await navigate(p,route);const after=await customerMeasurement(p,route);assert.deepEqual(after,before);intendedCustomer(after,route,width);for(const adminLast of [false,true]){await reverseOrder(p,adminLast);assert.deepEqual(await customerMeasurement(p,route),before)}results.push({width,route,before,after});assert.equal(await p.evaluate(()=>window.h.writes),0)},route==='Services'?'/services':'/my-reviews')
}
await browser.close()
const cases=results.filter(r=>'pass'in r)
await writeFile(resolve(out,'results.json'),JSON.stringify({baseline,results,blocked},null,2))
for(const r of cases)console.log(r.pass?'PASS':'FAIL',r.width,r.name,r.error??'')
console.log('Artifacts:',out);console.log(`${cases.filter(r=>r.pass).length}/${cases.length} passed; external requests: ${blocked.length}`)
if(cases.some(r=>!r.pass)||blocked.length)process.exitCode=1
