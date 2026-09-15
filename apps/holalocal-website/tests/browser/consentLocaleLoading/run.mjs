// Actual language control and production locale composition; synthetic authentication boundary.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-consent-switch-'))
const replacements = {
 'hooks/useAuthentication.js': `export default ()=>({user:null,userProfile:null,signUp:async(...args)=>{window.consentFixture.registrations.push(args);return {verificationEmailSent:true}},acceptLegalConsent:async()=>{window.consentFixture.consents++;return {status:'superseded',profile:null}}});`,
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
    await page.goto('http://127.0.0.1:18471/consent?locale='+name)
    await page.locator('h1').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}


const expected=JSON.parse(await readFile(process.env.HOLALOCAL_CONSENT_BASE_SNAPSHOT,'utf8')).loaded
const policy=await import('../../../src/utils/policies.js')
for(const width of [1440,390])for(const initial of ['en','de','pl'])await scenario(width,initial,async p=>{
 for(const [code,label] of [[initial,null],['uk','Українська'],['de','Deutsch'],['pl','Polski']]){
  if(label){await p.locator('.select-field__button').click();await p.getByRole('option',{name:label,exact:false}).click()}
  const copy=expected[code].legalConsent
  await p.waitForFunction(title=>document.querySelector('h1')?.textContent===title,copy.title)
  assert.equal(await p.locator('legend').textContent(),copy.legend)
  assert.equal(await p.locator('a[href="/terms"]').textContent(),copy.termsLink)
  assert.equal(await p.locator('a[href="/privacy"]').textContent(),copy.privacyLink)
  assert.ok((await p.locator('.auth-card').textContent()).includes(copy.currentDocuments))
  await p.locator('button[type="submit"]').click()
  assert.equal(await p.locator('#legal-consent-error').textContent(),copy.bothRequired)
  assert.equal(await p.evaluate(()=>window.consentFixture.consents),0)
 }
 await p.locator('#legal-consent-terms').check()
 await p.locator('button[type="submit"]').click()
 assert.equal(await p.evaluate(()=>window.consentFixture.consents),0)
 await p.locator('#legal-consent-privacy').check()
 await p.locator('button[type="submit"]').click()
 await p.waitForFunction(()=>window.consentFixture.consents===1)
 assert.equal(new URL(p.url()).pathname,'/consent') // supersession is not absence/navigation
 await p.getByRole('link',{name:'Registration fixture',exact:true}).click()
 await p.locator('#register-email').fill('synthetic@example.invalid')
 await p.locator('#register-password').fill('Synthetic-password-123')
 await p.locator('#register-confirm-password').fill('Synthetic-password-123')
 await p.locator('form').evaluate(form=>{form.noValidate=true}) // exercise custom acknowledgment gates
 assert.equal(await p.locator('button[type="submit"]').isDisabled(),true)
 await p.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 assert.equal(await p.evaluate(()=>window.consentFixture.registrations.length),0)
 await p.locator('#register-age').check()
 assert.equal(await p.locator('button[type="submit"]').isDisabled(),true)
 await p.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 assert.equal(await p.evaluate(()=>window.consentFixture.registrations.length),0)
 const boxes=p.locator('#register-consent input[type="checkbox"]:not(#register-age)')
 assert.equal(await boxes.count(),2)
 await boxes.nth(0).check()
 assert.equal(await p.locator('button[type="submit"]').isDisabled(),true)
 await p.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 assert.equal(await p.evaluate(()=>window.consentFixture.registrations.length),0)
 await boxes.nth(1).check()
 // Switch while selected: values/acknowledgments must remain intact.
 await p.locator('.select-field__button').click();await p.getByRole('option',{name:'Deutsch',exact:false}).click()
 await p.waitForFunction(title=>document.querySelector('h1')?.textContent===title,expected.de.auth.registration.title)
 assert.equal(await boxes.nth(0).isChecked(),true);assert.equal(await boxes.nth(1).isChecked(),true)
 await p.locator('button[type="submit"]').click()
 await p.locator('[data-destination]').waitFor()
 const calls=await p.evaluate(()=>window.consentFixture.registrations)
 assert.equal(calls.length,1)
 assert.deepEqual(calls[0][2],{ageConfirmed:true,termsAccepted:true,termsVersion:policy.CURRENT_TERMS_VERSION,privacyAccepted:true,privacyVersion:policy.CURRENT_PRIVACY_VERSION})
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
});
await browser.close();console.log(JSON.stringify({out,results,blocked},null,2));await writeFile(resolve(out,'results.json'),JSON.stringify({results,blocked},null,2));if(results.some(r=>!r.pass)||blocked.length)process.exitCode=1;
