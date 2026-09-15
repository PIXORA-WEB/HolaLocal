// Actual dashboard and production locale composition; synthetic service boundaries.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-status-dashboard-'))
const baseline = process.argv.includes('--baseline')
const replacements = {
 'hooks/useAuthentication.js': `const user={uid:'synthetic-owner',emailVerified:true};const userProfile={businessId:'synthetic-business',roles:['business']};const noop=async()=>{};export default ()=>({user,userProfile,refreshUserProfile:noop,signOutUser:noop});`,
 'services/businessService.js': `export const ensureBusinessProfile=async()=>({businessId:'synthetic-business',ownerId:'synthetic-owner',managerIds:['synthetic-owner'],name:'Synthetic local business',description:'Synthetic local business description',primaryCategoryId:'handyman',categoryIds:['handyman'],serviceAreas:['marbella'],languages:['en'],primaryLanguage:'en',location:{locality:'Marbella',region:'malaga',countryCode:'ES'},status:'draft',verificationStatus:'unverified',contact:{},publicContact:{},galleryUrls:[],galleryImages:[],services:['handyman']});export const getOwnerSubscriptionStatus=async()=>({planId:'early_access',accessStatus:'active'});export const submitBusinessForReview=()=>{throw new Error('Submission prohibited')};`,
 'services/businessInsightsService.js': `export const getOwnerBusinessInsights=async()=>{throw new Error('Synthetic insights unavailable')};`,
}
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' }, plugins: [{ name: 'synthetic-registration-boundary', enforce: 'pre', transform(code, id) { for (const [path, text] of Object.entries(replacements)) if (id === resolve(website, 'src', path)) return text } }], build: { outDir: resolve(out, 'dist') } })
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] }), results = [], blocked = []
async function scenario(width, name, run) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:18471') { blocked.push(url.href); return route.abort() }
    const path = url.pathname.startsWith('/assets/') ? url.pathname : '/index.html'
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html' })
  })
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(5000)
  page.on('pageerror', e => errors.push(e.message))
  try {
    await page.goto('http://127.0.0.1:18471/?locale='+name)
    await page.locator('.business-dashboard__card--next').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}
for (const width of [1440, 390]) for (const locale of ['de', 'uk', 'sk', 'no']) {
 await scenario(width, locale, async page => {
   const expected=await page.evaluate(()=>window.statusFixture)
   const text=page.locator('.business-dashboard__card--next > p').filter({hasText:expected.explanation})
   await text.waitFor()
   assert.equal(await text.count(),1)
   assert.equal(await text.textContent(),expected.explanation)
   const geometry=await text.evaluate(el=>{const r=el.getBoundingClientRect(),card=el.closest('article').getBoundingClientRect();return {width:r.width,height:r.height,scroll:el.scrollWidth,client:el.clientWidth,inside:r.left>=card.left&&r.right<=card.right,clipped:getComputedStyle(el).overflow}})
   assert.ok(geometry.inside);assert.ok(geometry.scroll<=geometry.client+1);assert.ok(geometry.height>0)
   assert.equal(await page.locator('.business-dashboard__card--visibility h2').textContent(),expected.draft)
   results.push({width,locale,geometry,explanation:expected.explanation,draft:expected.draft})
   await page.screenshot({path:resolve(out,`${width}-${locale}.png`),fullPage:true})
 })
}
await browser.close()
await writeFile(resolve(out,'results.json'),JSON.stringify({results,blocked},null,2))
console.log(JSON.stringify({out,results,blocked},null,2))
if(results.some(r=>r.pass===false)||blocked.length)process.exitCode=1
