// Actual language control and production locale composition; synthetic authentication boundary.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-admin-wording-'))
const replacements = {
 'hooks/useAuthentication.js': 'export default ()=>({user:null,userProfile:null})',
 'services/adminService.js': `export const getAdminBusinessReview=async()=>window.adminWordingFixture.review;export const moderateBusiness=async()=>{window.adminWordingFixture.operations++;throw Error('No moderation permitted')};export const assignBusinessSubscriptionPlan=moderateBusiness;`,
};
if(process.env.HOLALOCAL_WORDING_BASE_ROOT)for(const name of ['defaultTranslations.js','adminTranslations.js'])replacements['i18n/'+name]=await readFile(resolve(process.env.HOLALOCAL_WORDING_BASE_ROOT,'src/i18n',name),'utf8')
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' }, plugins: [{ name: 'synthetic-registration-boundary', enforce: 'pre', transform(code, id) { for (const [path, text] of Object.entries(replacements)) if (id === resolve(website, 'src', path)) return text } }], build: { outDir: resolve(out, 'dist') } })
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] }), results = [], blocked = []
async function scenario(width, name, run) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
  await context.addInitScript(()=>localStorage.setItem('holalocal.uiLanguage','en'))
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
    await page.goto('http://127.0.0.1:18471/admin/businesses/synthetic?media='+name)
    await page.locator('h1').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}


for(const width of [1440,390])for(const media of ['no','yes'])await scenario(width,media,async p=>{
 const expected=media==='yes'?8:6
 for(const label of [null,'Deutsch']){
  if(label){await p.locator('.select-field__button').click();await p.getByRole('option',{name:label,exact:false}).click();await p.waitForFunction(()=>localStorage.getItem('holalocal.uiLanguage')==='de')}
  await p.locator('.admin-completion-summary strong').waitFor()
  assert.equal(await p.locator('.admin-completion-summary strong').textContent(),`${expected} of 8 profile items complete`)
  assert.equal(await p.locator('.admin-completion-summary span').textContent(),`Profile completeness: ${media==='yes'?100:75}%`)
  assert.equal(await p.locator('.admin-review-checklist li').count(),8)
  assert.equal(await p.locator('.admin-review-checklist .is-incomplete').count(),8-expected)
  assert.equal(await p.locator('section[aria-labelledby="checklist-title"] .admin-eyebrow').textContent(),'Profile completeness')
  const note=await p.locator('section[aria-labelledby="checklist-title"] .admin-panel__note').textContent()
  assert.ok(note.includes('Profile completeness and publication eligibility are separate.'))
  assert.ok(note.includes('Logos and images are optional.'))
  assert.equal(await p.evaluate(()=>window.adminWordingFixture.publicationRequirements),true)
  assert.equal(await p.evaluate(()=>window.adminWordingFixture.completion.ready),true)
  assert.equal(await p.evaluate(()=>window.adminWordingFixture.operations),0)
 }
});
await browser.close();console.log(JSON.stringify({out,results,blocked},null,2));await writeFile(resolve(out,'results.json'),JSON.stringify({results,blocked},null,2));if(results.some(r=>!r.pass)||blocked.length)process.exitCode=1;
