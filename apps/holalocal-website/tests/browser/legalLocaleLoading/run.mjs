// Actual language control and production locale composition; synthetic authentication boundary.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-legal-switch-'))
const replacements = { 'hooks/useAuthentication.js': 'export default ()=>({user:null,userProfile:null})' };
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' }, plugins: [{ name: 'synthetic-registration-boundary', enforce: 'pre', transform(code, id) { for (const [path, text] of Object.entries(replacements)) if (id === resolve(website, 'src', path)) return text } }], build: { outDir: resolve(out, 'dist') } })
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] }), results = [], blocked = []
async function scenario(width, name, run) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
  await context.addInitScript(code=>localStorage.setItem('holalocal.uiLanguage',code),name)
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
    await page.goto('http://127.0.0.1:18471/privacy?locale='+name)
    await page.locator('h1').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}


const expected=JSON.parse(await readFile(process.env.HOLALOCAL_LEGAL_BASE_SNAPSHOT,'utf8')).loaded
const policy=await import('../../../src/utils/policies.js')
const visibleText=s=>s.replace(/<\/?(?:email|authority)>/g,'')
for(const width of [1440,390])for(const initial of ['en','de','pl'])await scenario(width,initial,async p=>{
 for(const kind of ['privacy','terms']) {
  await p.getByRole('link',{name:kind==='privacy'?'Privacy fixture':'Terms fixture',exact:true}).click()
  for(const [code,label] of [[initial,null],['uk','Українська'],['de','Deutsch'],['pl','Polski']]){
   if(label){await p.locator('.select-field__button').click();await p.getByRole('option',{name:label,exact:false}).click()}
   else if(kind==='terms')continue
   const resource=expected[code].legalPages,content=resource[kind]
   await p.waitForFunction(title=>document.querySelector('h1')?.textContent===title,content.title)
   const version=kind==='privacy'?policy.CURRENT_PRIVACY_VERSION:policy.CURRENT_TERMS_VERSION
   const date=kind==='privacy'?policy.CURRENT_PRIVACY_EFFECTIVE_DATE:policy.CURRENT_TERMS_EFFECTIVE_DATE
   assert.equal(await p.locator('.placeholder__label').textContent(),`${resource.revisionNotice} · ${version} · ${date}`)
   assert.deepEqual(await p.locator('.legal-content__sections h2').allTextContents(),content.sections.map(s=>s.title))
   assert.deepEqual(await p.locator('.legal-content__sections p').allTextContents(),content.sections.flatMap(s=>(s.paragraphs??[]).map(visibleText)))
   assert.deepEqual(await p.locator('.legal-content__sections li').allTextContents(),content.sections.flatMap(s=>s.items??[]))
   const links=await p.locator('.legal-content__contents a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')))
   assert.deepEqual(links,content.sections.map(s=>'#'+s.key))
   for(const section of content.sections)assert.equal(await p.locator(`[id="${section.key}"]`).count(),1)
   const target=content.sections[1].key
   await p.locator(`.legal-content__contents a[href="#${target}"]`).click()
   await p.waitForFunction(hash=>location.hash===hash,'#'+target)
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
  }
 }
});
await browser.close();console.log(JSON.stringify({out,results,blocked},null,2));await writeFile(resolve(out,'results.json'),JSON.stringify({results,blocked},null,2));if(results.some(r=>!r.pass)||blocked.length)process.exitCode=1;
