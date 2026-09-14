// Run with Node 20+. No server, Firebase credentials, or external application traffic.
// --baseline uses the unchanged selector from the approved batch-3 commit.
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
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-select-disabled-'))
const baseline = process.argv.includes('--baseline')
const replacements = {
  'hooks/useAuthentication.js': 'export default ()=>({user:window.h.user,userProfile:window.h.profile,updateUserProfile:window.h.save});',
  'i18n/index.js': 'export const LANGUAGE_STORAGE_KEY="synthetic-language";export const changeAppLanguage=code=>window.h.changeLanguage(code);',
}
if (baseline) replacements['components/common/SelectField.jsx'] = execFileSync('git', ['show', '5dd021497df36e847632a0be1f48ee9b24d34954:apps/holalocal-website/src/components/common/SelectField.jsx'], { cwd: website, encoding: 'utf8' })
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': JSON.stringify('development') }, plugins: [{ name: 'synthetic-auth-boundaries', enforce: 'pre', transform(code, id) { for (const [path, replacement] of Object.entries(replacements)) if (id === resolve(src, path)) return replacement } }], esbuild: { jsx: 'automatic' }, build: { outDir: resolve(out, 'dist'), minify: false } })
const results = [], blocked = []
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
const flush = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function scenario(width, name, run, query = '') {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 900 }, hasTouch: width === 390 })
  const errors = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:18466') { blocked.push(url.href); return route.abort() }
    const path = url.pathname.startsWith('/assets/') ? url.pathname : '/index.html'
    if (path.includes('..')) return route.abort()
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html' })
  })
  const p = await context.newPage()
  p.setDefaultTimeout(5000)
  p.on('pageerror', e => errors.push(e.message))
  try {
    await p.goto('http://127.0.0.1:18466/' + query)
    await p.locator('.select-field__button').waitFor()
    await run(p)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true, value: await p.locator('#value').textContent(), changes: await p.evaluate(() => window.h.changes) })
  } catch (error) { results.push({ width, name, pass: false, error: error.stack, state: await p.evaluate(() => window.h?.state), events: await p.evaluate(() => window.h?.events) }) }
  console.log("SCENARIO", width, name, results.at(-1)?.pass)
  await context.close()
}
const trigger = p => p.locator('.select-field__button')
const option = (p, label) => p.getByRole('option', { name: label, exact: true })
async function unchanged(p, value = 'a') {
  assert.equal(await p.locator('#value').textContent(), value)
  assert.deepEqual(await p.evaluate(() => window.h.changes), [])
}
async function disabledPopup(p) {
  assert.equal(await trigger(p).isDisabled(), true)
  assert.equal(await trigger(p).getAttribute('aria-expanded'), 'false')
  assert.equal(await p.getByRole('listbox').count(), 0)
}
for (const width of [1440, 390]) {
  await scenario(width, 'initially disabled cannot open from pointer or keyboard', async p => {
    await trigger(p).evaluate(el => { el.click(); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    await flush(p); await disabledPopup(p); await unchanged(p)
    await p.locator('#before').focus(); await p.keyboard.press('Tab')
    assert.equal(await p.locator('#after').evaluate(el => el === document.activeElement), true)
  }, '?disabled=1')
  for (const focused of ['trigger', 'option']) await scenario(width, 'disable open with focus on ' + focused, async p => {
    await trigger(p).click(); await option(p, 'Beta').focus()
    if (focused === 'trigger') await trigger(p).focus()
    await p.evaluate(() => window.h.disable(true)); await disabledPopup(p)
    await p.keyboard.press('Enter'); await unchanged(p)
    await p.locator('#after').focus(); await p.keyboard.press('Tab'); await flush(p)
    assert.equal(await p.locator('#outside').evaluate(el => el === document.activeElement), true)
  })
  for (const method of ['pointer', 'keyboard']) await scenario(width, 'disabled stale ' + method + ' activation cannot commit', async p => {
    await trigger(p).click(); await option(p, 'Beta').focus()
    await p.evaluate(() => { window.h.oldOption = document.querySelectorAll('[role="option"]')[1]; window.h.disable(true) })
    if (method === 'pointer') await p.evaluate(() => window.h.oldOption.click())
    else await p.keyboard.press('Enter')
    await flush(p); await unchanged(p); await disabledPopup(p)
  })
  await scenario(width, 'disabled commit is inert before passive-effect cleanup', async p => {
    await trigger(p).click()
    await p.evaluate(() => {
      window.h.atCommit = () => {
        const menu = document.querySelector('[role="listbox"]'), target = menu.querySelectorAll('[role="option"]')[1]
        window.h.commitState = { hidden: menu.hidden, disabled: target.disabled, expanded: document.querySelector('.select-field__button').getAttribute('aria-expanded') }
        target.click(); menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      }
      window.h.disable(true)
    })
    assert.deepEqual(await p.evaluate(() => window.h.commitState), { hidden: true, disabled: true, expanded: 'false' })
    await unchanged(p)
  })
  await scenario(width, 'controlled update while disabled and re-enable discard stale popup', async p => {
    await trigger(p).click(); await p.evaluate(() => { window.h.disable(true); window.h.setValue('c') }); await flush(p)
    await unchanged(p, 'c'); assert.equal(await trigger(p).innerText(), 'Gamma')
    await p.evaluate(() => window.h.disable(false)); await flush(p)
    assert.equal(await p.getByRole('listbox').count(), 0); await unchanged(p, 'c')
    await trigger(p).click(); await option(p, 'Beta').click()
    assert.deepEqual(await p.evaluate(() => window.h.changes), ['b'])
    assert.equal(await p.locator('#value').textContent(), 'b')
    assert.equal(await trigger(p).evaluate(el => el === document.activeElement), true)
  })
  await scenario(width, 'normal enabled keyboard selection and dismissal', async p => {
    await trigger(p).focus(); await p.keyboard.press('ArrowDown'); await flush(p)
    await p.keyboard.press('End'); await p.keyboard.press('Enter'); assert.equal(await p.locator('#value').textContent(), 'c')
    await trigger(p).click(); await p.keyboard.press('Escape'); assert.equal(await p.getByRole('listbox').count(), 0)
    assert.equal(await trigger(p).evaluate(el => el === document.activeElement), true)
    await trigger(p).click(); await p.locator('#before').click(); assert.equal(await p.getByRole('listbox').count(), 0)
    await trigger(p).click(); await p.keyboard.press('End'); await p.keyboard.press('Tab'); await flush(p)
    assert.equal(await p.getByRole('listbox').count(), 0)
    assert.equal(await p.locator('#after').evaluate(el => el === document.activeElement), true)
  })
  await scenario(width, 'disabling and moving focus does not steal it back', async p => {
    await trigger(p).click()
    await p.evaluate(() => { window.h.disable(true); document.getElementById('after').focus() }); await flush(p)
    assert.equal(await p.locator('#after').evaluate(el => el === document.activeElement), true)
    await p.evaluate(() => window.h.disable(false)); await flush(p)
    assert.equal(await p.locator('#after').evaluate(el => el === document.activeElement), true)
    await unchanged(p)
  })
}
await scenario(390, 'touch cannot choose a disabled option; enabled touch selection works', async p => {
  await trigger(p).tap(); const bounds = await option(p, 'Beta').boundingBox()
  await p.evaluate(() => window.h.disable(true))
  await p.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await unchanged(p)
  await p.evaluate(() => window.h.disable(false)); await trigger(p).tap(); await option(p, 'Beta').tap()
  assert.equal(await p.locator('#value').textContent(), 'b')
})
await scenario(390, 'real LanguageSwitcher disables during deferred save and recovers', async p => {
  await trigger(p).click(); await p.getByRole('option').filter({ hasText: 'Español' }).click()
  await disabledPopup(p)
  assert.equal(await p.evaluate(() => window.h.saves.length), 1)
  await trigger(p).evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
  await disabledPopup(p)
  await p.evaluate(() => window.h.resolveSave()); await flush(p)
  assert.equal(await trigger(p).isDisabled(), false)
  assert.ok((await trigger(p).innerText()).includes('Español'))
  await trigger(p).click(); assert.equal(await p.getByRole('listbox').count(), 1)
}, '?consumer=1')
await browser.close()
await writeFile(resolve(out, 'results.json'), JSON.stringify({ baseline, results, blocked }, null, 2))
for (const r of results) console.log(r.pass ? 'PASS' : 'FAIL', r.width, r.name, r.pass ? '' : r.error)
console.log('Artifacts:', out)
console.log(`${results.filter(r => r.pass).length}/${results.length} passed; external requests: ${blocked.length}`)
if (results.some(r => !r.pass) || blocked.length) process.exitCode = 1
