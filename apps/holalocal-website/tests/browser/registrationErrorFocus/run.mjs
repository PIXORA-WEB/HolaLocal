// Production-mode real RegisterPage; only authentication service boundaries substituted.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-registration-focus-'))
const baseline = process.argv.includes('--baseline')
const replacements = {
  'hooks/useAuthentication.js': `export default ()=>({signUp:async(...args)=>{window.registrationFixture.calls.push(args);return {verificationEmailSent:true}}});`,
  'firebase/auth.js': 'export const getAuthenticationErrorMessage=()=>"Synthetic authentication failure";',
}
if (baseline) replacements['pages/auth/RegisterPage.jsx'] = execFileSync('git', ['show', 'aa279a3e10b093bc8a21c9a2b56753ec947a9d7e:apps/holalocal-website/src/pages/auth/RegisterPage.jsx'], { cwd: website, encoding: 'utf8' })
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' }, plugins: [{ name: 'synthetic-registration-boundary', enforce: 'pre', transform(code, id) { for (const [path, text] of Object.entries(replacements)) if (id === resolve(website, 'src', path)) return text } }], build: { outDir: resolve(out, 'dist') } })
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] }), results = [], blocked = []
async function scenario(width, name, run) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:18468') { blocked.push(url.href); return route.abort() }
    const path = url.pathname.startsWith('/assets/') ? url.pathname : '/index.html'
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html' })
  })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  try {
    await page.goto('http://127.0.0.1:18468/register')
    await page.locator('#register-email').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}
async function fill(page, acknowledge = true) {
  await page.locator('#register-email').fill('synthetic@example.invalid')
  await page.locator('#register-password').fill('Synthetic-password-123')
  await page.locator('#register-confirm-password').fill('Synthetic-password-123')
  if (acknowledge) for (const box of await page.locator('input[type=checkbox]').all()) await box.check()
}
async function submit(page) { await page.locator('button[type=submit]').focus(); await page.keyboard.press('Enter'); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))) }
async function noRequest(page) { assert.equal(await page.evaluate(() => window.registrationFixture.calls.length), 0) }
for (const width of [1440, 390]) {
  await scenario(width, 'password mismatch focus and association', async page => {
    await fill(page)
    await page.locator('#register-confirm-password').fill('Different-password-123')
    await submit(page)
    const input = page.locator('#register-confirm-password')
    assert.equal(await input.getAttribute('aria-invalid'), 'true')
    assert.equal(await input.getAttribute('aria-describedby'), 'register-confirm-password-error')
    assert.equal(await page.locator('#register-confirm-password-error').isVisible(), true)
    assert.equal(await page.locator('#register-confirm-password-error').textContent(), await page.evaluate(() => window.registrationFixture.mismatch))
    await noRequest(page)
    assert.equal(await input.inputValue(), 'Different-password-123')
    await page.screenshot({ path: resolve(out, `${width}-mismatch.png`) })
    assert.equal(await page.evaluate(() => document.activeElement.id), 'register-confirm-password')
  })
  await scenario(width, 'correct mismatch then submit existing acknowledgment contract', async page => {
    await fill(page)
    await page.locator('#register-confirm-password').fill('Different-password-123')
    await submit(page); await noRequest(page)
    await page.locator('#register-confirm-password').fill('Synthetic-password-123')
    await page.keyboard.press('Enter')
    await page.getByTestId('verified-destination').waitFor()
    const fixture = await page.evaluate(() => window.registrationFixture)
    assert.deepEqual(fixture.calls, [['synthetic@example.invalid', 'Synthetic-password-123', { ageConfirmed: true, termsAccepted: true, termsVersion: fixture.termsVersion, privacyAccepted: true, privacyVersion: fixture.privacyVersion }]])
  })
  await scenario(width, 'each required acknowledgment blocks submission', async page => {
    await fill(page)
    for (const box of await page.locator('input[type=checkbox]').all()) {
      await box.uncheck()
      assert.equal(await page.locator('button[type=submit]').isDisabled(), true)
      await page.locator('#register-confirm-password').focus(); await page.keyboard.press('Enter')
      await noRequest(page)
      await box.check()
    }
    assert.equal(await page.locator('button[type=submit]').isEnabled(), true)
  })
  await scenario(width, 'native required email focus', async page => {
    await fill(page); await page.locator('#register-email').fill('')
    await submit(page); await noRequest(page)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'register-email')
  })
  await scenario(width, 'custom email then password validation ordering', async page => {
    await fill(page)
    // Explicitly bypass native constraint UI to exercise the existing JS focus map.
    await page.locator('form').evaluate(form => { form.noValidate = true })
    await page.locator('#register-email').fill('bad')
    await page.locator('#register-password').fill('short')
    await submit(page); await noRequest(page)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'register-email')
    await page.locator('#register-email').fill('synthetic@example.invalid')
    await submit(page); await noRequest(page)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'register-password')
  })
}
await browser.close()
await writeFile(resolve(out, 'results.json'), JSON.stringify({ baseline, results, blocked }, null, 2))
console.log(JSON.stringify({ out, results, blocked }, null, 2))
if (results.some(r => !r.pass) || blocked.length) process.exitCode = 1
