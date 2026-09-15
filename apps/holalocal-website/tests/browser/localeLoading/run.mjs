// Actual language control and production locale composition; synthetic authentication boundary.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-locale-switch-'))
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
    await page.goto('http://127.0.0.1:18471/?locale='+name)
    await page.locator('h1').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}


for(const width of [1440,390])for(const initial of ['en','de','pl'])await scenario(width,initial,async p=>{
 const profileTitles={"en": "Profile", "de": "Mein Profil", "pl": "Mój profil", "uk": "Мій профіль"};
 const titles={en:'Business insights',de:'Unternehmensstatistiken',pl:'Statystyki firmy',uk:'Статистика компанії'};
 assert.equal(await p.locator('h1').textContent(),titles[initial]);
 assert.equal(await p.locator('[data-authenticated-title]').textContent(),profileTitles[initial]);
 for(const [code,label] of [['uk','Українська'],['de','Deutsch'],['pl','Polski']]){
  await p.locator('.select-field__button').click();await p.getByRole('option',{name:label,exact:false}).click();
  await p.waitForFunction(expected=>document.querySelector('h1').textContent===expected,titles[code]);
  assert.equal(await p.locator('[data-authenticated-title]').textContent(),profileTitles[code]);
  assert.equal(await p.evaluate(()=>localStorage.getItem('holalocal.uiLanguage')),code);
  assert.ok((await p.locator('main').textContent()).includes('DATE-SENTINEL'));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }
});
await browser.close();console.log(JSON.stringify({out,results,blocked},null,2));await writeFile(resolve(out,'results.json'),JSON.stringify({results,blocked},null,2));if(results.some(r=>!r.pass)||blocked.length)process.exitCode=1;
