// Actual language control and production locale composition; synthetic authentication boundary.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-operational-switch-'))
const replacements = {
 'hooks/useAuthentication.js': `export default ()=>({user:null,userProfile:null,resetPassword:async email=>{window.operationalFixture.resets.push(email)},signUp:async()=>{throw new Error('Unexpected fixture registration')}});`,
 'firebase/auth.js': 'export const getAuthenticationErrorMessage=()=>"Synthetic authentication failure";',
};
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
    await page.goto('http://127.0.0.1:18471/recovery?locale='+name)
    await page.locator('h1').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}


const expected=JSON.parse(await readFile(process.env.HOLALOCAL_OPERATIONAL_BASE_SNAPSHOT,'utf8')).loaded
for(const width of [1440,390])for(const initial of ['en','de','pl'])await scenario(width,initial,async p=>{
 for(const [code,label] of [[initial,null],['uk','Українська'],['de','Deutsch'],['pl','Polski']]){
  if(label){await p.locator('.select-field__button').click();await p.getByRole('option',{name:label,exact:false}).click()}
  const copy=expected[code].auth.recovery
  await p.waitForFunction(text=>document.querySelector('.auth-card__eyebrow')?.textContent===text,copy.eyebrow)
  assert.ok((await p.locator('.auth-card__heading').textContent()).includes(copy.description))
  assert.equal(await p.locator('button[type="submit"]').textContent(),copy.action)
  if(label)assert.equal(await p.locator('[role="status"]').textContent(),copy.sent)
  else{
   await p.locator('#reset-email').fill('synthetic@example.invalid')
   await p.locator('button[type="submit"]').click()
   await p.locator('[role="status"]').waitFor()
   assert.equal(await p.locator('[role="status"]').textContent(),copy.sent)
  }
 }
 assert.deepEqual(await p.evaluate(()=>window.operationalFixture.resets),['synthetic@example.invalid'])
 await p.getByRole('link',{name:'Registration fixture',exact:true}).click()
 const toggle=p.locator('.password-field__toggle').first()
 assert.equal(await toggle.textContent(),expected.pl.auth.passwordUx.show)
 await p.locator('#register-password').fill('Synthetic-password-123')
 await toggle.click()
 assert.equal(await p.locator('#register-password').getAttribute('type'),'text')
 assert.equal(await toggle.textContent(),expected.pl.auth.passwordUx.hide)
 await p.locator('.select-field__button').click();await p.getByRole('option',{name:'Deutsch',exact:false}).click()
 await p.waitForFunction(text=>document.querySelector('.password-field__toggle')?.textContent===text,expected.de.auth.passwordUx.hide)
 assert.equal(await p.locator('#register-password').inputValue(),'Synthetic-password-123')
 await toggle.click();assert.equal(await p.locator('#register-password').getAttribute('type'),'password')
 assert.equal(await toggle.textContent(),expected.de.auth.passwordUx.show)
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
});
await browser.close();console.log(JSON.stringify({out,results,blocked},null,2));await writeFile(resolve(out,'results.json'),JSON.stringify({results,blocked},null,2));if(results.some(r=>!r.pass)||blocked.length)process.exitCode=1;
