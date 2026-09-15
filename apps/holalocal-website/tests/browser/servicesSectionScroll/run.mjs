// Run with Node 20+. No server, Firebase credentials, or external application traffic.
// --baseline uses the approved Services stylesheet; layout and route code remain real.
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
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-services-scroll-'))
const baseline = process.argv.includes('--baseline')
const denied = '()=>{throw new Error("Unexpected synthetic service call")}'
const replacements = {
  'firebase/config.js': 'export const getFirebaseApp=()=>({});export const getFirebaseAuth=()=>({});',
  'hooks/useAuthentication.js': 'const refreshUserProfile=async()=>{};const signOutUser=async()=>{};export default ()=>({user:window.h.user,userProfile:window.h.profile,refreshUserProfile,signOutUser,profileLoading:false});',
  'services/profileMediaPresentation.js': 'export const loadProfileMediaPresentation=async()=>null;',
  'utils/customerReviewsFlag.js': 'export const customerReviewsEnabled=true;',
  'services/customerReviewService.js': 'export const customerReviewService={summaries:async({businessIds})=>businessIds.map(businessId=>({businessId,available:true,count:3,average:4.5})),listPublic:async()=>({items:[],nextCursor:null}),getOwn:async()=>null};',
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
    if (name==='getAuthenticationErrorMessage') value='()=>"Synthetic error"'
    if (name==='recordPublicProfileView'||name==='recordPublicContactAction') value='async()=>{}'
    return `export const ${name}=${value};`
  }).join('')
}
const reportSource=await readFile(resolve(src,'services/reportService.js'),'utf8')
replacements['services/reportService.js']='export const businessReportReasons='+reportSource.match(/export const businessReportReasons = (\[[\s\S]*?\n\])/)[1]+';export const createBusinessReport='+denied+';'
if(baseline) replacements['styles/servicesPresentation.css']=execFileSync('git',['show','ebfb3d86077e3f837203af875c06035f3ed2c4aa:apps/holalocal-website/src/styles/servicesPresentation.css'],{cwd:website,encoding:'utf8'})
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': JSON.stringify('production') }, plugins: [{ name: 'synthetic-auth-boundaries', enforce: 'pre', transform(code, id) { for (const [path, replacement] of Object.entries(replacements)) if (id === resolve(src, path)) return replacement } }], esbuild: { jsx: 'automatic' }, build: { outDir: resolve(out, 'dist'), manifest: true } })
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
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : extname(path) === '.webp' ? 'image/webp' : extname(path) === '.svg' ? 'image/svg+xml' : extname(path) === '.png' ? 'image/png' : 'text/html' })
  })
  const p = await context.newPage()
  p.setDefaultTimeout(5000)
  p.on('pageerror', e => errors.push(e.message))
  try {
    await p.goto('http://127.0.0.1:18466' + initialPath)
    await run(p)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true, stylesheets: await p.evaluate(() => [...document.styleSheets].map(s => s.href)) })
  } catch (error) { results.push({ width, name, pass: false, error: error.stack, state: await p.evaluate(() => window.h?.state), events: await p.evaluate(() => window.h?.events) }) }
  console.log("SCENARIO", width, name, results.at(-1)?.pass)
  await context.close()
}
async function settled(p){
 await p.evaluate(async()=>{let last=scrollY,stable=0;for(let i=0;i<180&&stable<12;i++){await new Promise(r=>requestAnimationFrame(r));const current=scrollY;stable=Math.abs(current-last)<.1?stable+1:0;last=current}})
}
async function ready(p){await p.locator('.business-detail__navigation').waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('.site-header img')].every(e=>e.complete&&e.naturalWidth>0));await settled(p)}
async function measurement(p,id){return p.locator('#'+id).evaluate(e=>{const h=e.querySelector('h2'),r=e.getBoundingClientRect(),hr=h.getBoundingClientRect(),header=document.querySelector('.site-header').getBoundingClientRect(),max=document.documentElement.scrollHeight-innerHeight;return {id:e.id,sectionTop:r.top,headingTop:hr.top,headingBottom:hr.bottom,headerBottom:header.bottom,margin:getComputedStyle(e).scrollMarginTop,scrollY,max,atLimit:Math.abs(scrollY-max)<2,hash:location.hash,hit:h.contains(document.elementFromPoint(hr.x+hr.width/2,hr.y+hr.height/2)),headerVariable:getComputedStyle(e).getPropertyValue('--site-header-height')}})}
function visible(m){assert.ok(m.headingTop>=m.headerBottom-1,JSON.stringify(m));assert.ok(m.headingBottom<=900,JSON.stringify(m));assert.ok(m.hit,JSON.stringify(m));if(!m.atLimit)assert.ok(m.sectionTop-m.headerBottom<=18,JSON.stringify(m))}
const targets=['business-overview','business-services','business-photos','business-about']
for(const width of [1440,390,1023,1024])for(const locale of ['en','de'])for(const size of ['long','short'])await scenario(width,`${locale} ${size} native section links`,async p=>{
 await ready(p);const rows=[]
 for(const [i,id] of targets.entries()){
  const link=p.locator(`.business-detail__navigation a[href="#${id}"]`)
  if(i%2){await link.focus();await settled(p);await p.keyboard.press('Enter')}else await link.click()
  await settled(p);const m=await measurement(p,id);rows.push(m);assert.equal(m.hash,'#'+id)
 }
 results.push({width,locale,size,measurements:rows});await p.screenshot({path:resolve(out,`${width}-${locale}-${size}.png`)})
 for(const m of rows)visible(m)
 // Fragment history stays native; check both traversal directions after link activation.
 await p.goBack();await settled(p);assert.equal(await p.evaluate(()=>location.hash),'#business-photos');visible(await measurement(p,'business-photos'))
 await p.goForward();await settled(p);assert.equal(await p.evaluate(()=>location.hash),'#business-about');visible(await measurement(p,'business-about'))
},`/services/synthetic-business?locale=${locale}&size=${size}`)
for(const width of [1440,390])await scenario(width,'direct fragment and result Back',async p=>{
 await ready(p);await settled(p);const direct=await measurement(p,'business-services');results.push({width,direct});
 // Observe native delayed-route fragment support separately from CSS link positioning.
 const directSupported=direct.headingTop>=direct.headerBottom&&direct.headingBottom<=900
 results.push({width,directSupported})
 await p.locator('.business-detail__back').click();await p.locator('.directory-business-card').first().waitFor()
 assert.equal(new URL(p.url()).pathname,'/services');assert.equal(new URL(p.url()).searchParams.get('category'),'handyman')
 await p.locator('.directory-business-card').first().click();await ready(p)
 await p.locator('.business-detail__back').click();await p.locator('.directory-business-card').first().waitFor();assert.equal(new URL(p.url()).pathname,'/services')
},'/services/synthetic-business?locale=en&size=long&category=handyman#business-services')
await browser.close()
const cases=results.filter(r=>'pass'in r)
await writeFile(resolve(out,'results.json'),JSON.stringify({baseline,results,blocked},null,2))
for(const r of cases)console.log(r.pass?'PASS':'FAIL',r.width,r.name,r.error??'')
console.log('Artifacts:',out);console.log(`${cases.filter(r=>r.pass).length}/${cases.length} passed; external requests: ${blocked.length}`)
if(cases.some(r=>!r.pass)||blocked.length)process.exitCode=1
