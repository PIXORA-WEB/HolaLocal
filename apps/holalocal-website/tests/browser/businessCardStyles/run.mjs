// Run with Node 20+. No server, Firebase credentials, or external application traffic.
// --baseline uses the unchanged shared card and Services CSS from batch 4.
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
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-card-styles-'))
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
if (baseline) for (const file of ['components/common/PublicBusinessCard.jsx','styles/servicesPresentation.css']) replacements[file]=execFileSync('git',['show','6eceb7d8b88feb47f6616eb22991d4047f1b98e9:apps/holalocal-website/src/'+file],{cwd:website,encoding:'utf8'})
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
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : extname(path) === '.webp' ? 'image/webp' : 'text/html' })
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
async function navigate(p, name) {
  await p.getByRole('link', { name: 'Fixture ' + name, exact: true }).click()
  await p.locator(name==='Home'?'.homepage-business-preview__grid .directory-business-card':name==='Services'?'.services-results__grid .directory-business-card':'.public-business-card--hero').first().waitFor()
}
async function cardStyles(p) {
  await p.locator('.directory-business-card').first().waitFor()
  await p.mouse.move(0, 0)
  return p.locator('.directory-business-card').first().evaluate(el => {
    const c=getComputedStyle(el), avatar=el.querySelector('.image-avatar'), a=getComputedStyle(avatar)
    return { display:c.display,padding:c.paddingTop,border:c.borderTopWidth,borderColor:c.borderTopColor,radius:c.borderTopLeftRadius,avatarWidth:a.width,avatarHeight:a.height,headingClamp:getComputedStyle(el.querySelector('h3')).webkitLineClamp,excerptClamp:getComputedStyle(el.querySelector('.directory-business-card__excerpt')).webkitLineClamp,overflows:el.scrollWidth>el.clientWidth+1 }
  })
}
function intended(styles,width) {
  assert.equal(styles.display,'grid')
  assert.equal(styles.padding,width===390?'17.6px':'20px')
  assert.equal(styles.border,'1px'); assert.equal(styles.borderColor,'rgb(220, 227, 236)'); assert.equal(styles.radius,'20px')
  assert.equal(styles.avatarWidth,width===390?'64px':'72px'); assert.equal(styles.avatarHeight,styles.avatarWidth)
  assert.equal(styles.headingClamp,'2'); assert.equal(styles.excerptClamp,'2'); assert.equal(styles.overflows,false)
}
for (const width of [1440,390]) {
  for (const path of ['cold-home','services-home','cold-services','home-services']) await scenario(width,path,async p=>{
    if(path==='services-home'){await p.locator('.directory-business-card').first().waitFor();await navigate(p,'Home')}
    if(path==='home-services'){await p.locator('.directory-business-card').first().waitFor();await navigate(p,'Services')}
    const styles=await cardStyles(p); const cssBeforeActions=await p.evaluate(()=>[...document.styleSheets].map(s=>s.href)); results.push({width,path,measurement:styles,cssBeforeActions})
    await p.locator('.directory-business-card').first().screenshot({path:resolve(out,`${path}-${width}.png`)})
    intended(styles,width)
    if(path==='cold-home') assert.equal(cssBeforeActions.some(href=>href?.includes('ServicesPage')),false)
    const cards=p.locator('.directory-business-card'); assert.equal(await cards.count(),3)
    await p.waitForFunction(()=>[...document.querySelectorAll('.directory-business-card img')].every(img=>img.complete))
    assert.equal(await cards.nth(0).locator('.image-avatar img').count(),0)
    assert.equal(await cards.nth(1).locator('.image-avatar img').evaluate(img=>img.naturalWidth>0),true)
    await p.waitForFunction(()=>!document.querySelectorAll('.directory-business-card')[2].querySelector('img'))
    assert.ok((await cards.nth(2).locator('.image-avatar').textContent()).includes('BI'))
    if(path.endsWith('services')) {
      assert.equal(await cards.first().locator('.customer-reviews__summary').count(),1)
      results.push({width,path,review:await cards.first().locator('.customer-reviews__summary').evaluate(el=>({color:getComputedStyle(el).color,fontSize:getComputedStyle(el).fontSize,margin:getComputedStyle(el).margin}))})
    }
    await cards.first().click(); await p.locator('.business-detail').waitFor()
    assert.ok(p.url().includes('/services/synthetic-business'))
    await p.locator('.business-detail__back').click(); await p.locator('.directory-business-card').first().waitFor()
  },path.startsWith('services')||path==='cold-services'?'/services':'/')
  await scenario(width,'services detail preserves layout and return action',async p=>{
    await p.locator('.business-detail__columns').waitFor()
    const detail=await p.locator('.business-detail__columns').evaluate(el=>({display:getComputedStyle(el).display,columns:getComputedStyle(el).gridTemplateColumns}))
    assert.equal(detail.display,'grid'); results.push({width,detail})
    assert.equal(await p.locator('.business-detail__actions button').count()>0,true)
    await p.locator('.business-detail').screenshot({path:resolve(out,`detail-${width}.png`)})
    await p.locator('.business-detail__back').click(); intended(await cardStyles(p),width)
  },'/services/synthetic-business')
  await scenario(width,'editor avatar and retained hero variant',async p=>{
    const avatar=p.locator('.editable-image-avatar .image-avatar').first(); await avatar.waitFor()
    const styles=await avatar.evaluate(el=>({display:getComputedStyle(el).display,width:getComputedStyle(el).width,height:getComputedStyle(el).height,radius:getComputedStyle(el).borderRadius}))
    assert.equal(styles.display,'grid'); assert.ok(parseFloat(styles.width)>0); results.push({width,editorAvatar:styles})
    assert.equal(await p.locator('.editable-image-avatar input[type="file"]').first().isEnabled(),true)
    await navigate(p,'Variants'); await p.locator('.public-business-card--hero').waitFor()
    const hero=await p.locator('.public-business-card--hero').evaluate(el=>({display:getComputedStyle(el).display,radius:getComputedStyle(el).borderRadius}));results.push({width,hero})
    assert.equal(hero.display,'grid'); assert.equal(await p.locator('input[type="file"]').isDisabled(),true)
    await p.locator('.public-business-card--hero').click();await p.locator('.business-detail').waitFor()
  },'/editor')
}
await browser.close()
const cases=results.filter(r=>'pass' in r)
await writeFile(resolve(out,'results.json'),JSON.stringify({baseline,productionMode:true,results,blocked},null,2))
for(const r of cases)console.log(r.pass?'PASS':'FAIL',r.width,r.name,r.pass?'':r.error)
console.log('Artifacts:',out)
console.log(`${cases.filter(r=>r.pass).length}/${cases.length} passed; external requests: ${blocked.length}`)
if(cases.some(r=>!r.pass)||blocked.length)process.exitCode=1
