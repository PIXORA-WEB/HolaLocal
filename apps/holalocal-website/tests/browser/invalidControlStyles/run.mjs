// Real controls and production CSS; DatePicker disabled state uses a native fieldset.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-invalid-controls-'))
const baseline = process.argv.includes('--baseline')
const replacements = {}
if (baseline) replacements['styles/global.css'] = execFileSync('git', ['show', 'ceeaf279fa70ed64ef544e1b0923b82f5dfc4415:apps/holalocal-website/src/styles/global.css'], { cwd: website, encoding: 'utf8' })
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' }, plugins: [{ name: 'synthetic-registration-boundary', enforce: 'pre', transform(code, id) { for (const [path, text] of Object.entries(replacements)) if (id === resolve(website, 'src', path)) return text } }], build: { outDir: resolve(out, 'dist') } })
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] }), results = [], blocked = []
async function scenario(width, name, run) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:18469') { blocked.push(url.href); return route.abort() }
    const path = url.pathname.startsWith('/assets/') ? url.pathname : '/index.html'
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html' })
  })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  try {
    await page.goto('http://127.0.0.1:18469/?'+name)
    await page.locator('#before').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}
const red = 'rgb(180, 35, 24)', neutralHover = 'rgb(184, 196, 211)'
const measurements = []
async function style(target) {
  // SelectField transitions its border and transform for 160ms.
  await target.page().waitForTimeout(220)
  return target.evaluate(el => { const s = getComputedStyle(el); return { border: s.borderTopColor, outline: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, opacity: s.opacity, radius: s.borderRadius, invalid: el.getAttribute('aria-invalid'), describedBy: el.getAttribute('aria-describedby'), focus: el === document.activeElement, disabled: el.matches(':disabled') } })
}
for (const width of [1440, 390]) for (const control of ['select', 'date']) for (const variant of (control === 'select' ? ['default', 'form'] : ['default'])) for (const state of ['invalid', 'valid', 'disabled', 'disabled-valid']) {
  const invalid = state === 'invalid' || state === 'disabled'
  const name = new URLSearchParams({ control, variant, state }).toString()
  await scenario(width, name, async page => {
    const target = page.locator(control === 'select' ? '#tested-select' : '.date-picker__field input')
    await page.mouse.move(0, 0)
    const idle = await style(target)
    await target.hover(); const hover = await style(target)
    measurements.push({ width, name, idle, hover })
    assert.equal(idle.invalid, String(invalid))
    if (invalid) {
      assert.ok(idle.describedBy.includes('test-error'))
      assert.equal(await page.locator('#test-error').isVisible(), true)
      assert.equal(idle.border, red)
    }
    if (state.startsWith('disabled')) {
      assert.equal(hover.border, idle.border)
      assert.equal(idle.disabled, true)
      await page.locator('#before').focus(); await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement.id), 'after')
      assert.equal(hover.opacity, idle.opacity)
      const clickTarget = control === 'select' ? target : page.locator('.date-picker__field button')
      const box = await clickTarget.boundingBox()
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      assert.equal(await page.locator('[role=dialog], [role=listbox]:not([hidden])').count(), 0)
      assert.equal(await page.evaluate(() => window.controlFixture.selection), 'one')
      assert.equal(await page.evaluate(() => window.controlFixture.date), '2026-09-14')
      return
    }
    await page.mouse.move(0, 0); await page.locator('#before').focus(); await page.keyboard.press('Tab')
    const focus = await style(target)
    assert.equal(focus.focus, true); assert.equal(focus.outline, 'solid'); assert.equal(focus.outlineWidth, '3px')
    assert.equal(focus.border, state === 'invalid' ? red : 'rgb(8, 125, 242)')
    await target.hover(); const combined = await style(target)
    assert.equal(combined.focus, true); assert.equal(combined.outlineWidth, '3px')
    measurements.push({ width, name, focus, combined })
    assert.equal(hover.border, state === 'invalid' ? red : neutralHover)
    assert.equal(combined.border, state === 'invalid' ? red : neutralHover)
    if (state === 'invalid') {
      await page.evaluate(() => window.controlFixture.setInvalid(false))
      const cleared = await style(target)
      assert.equal(cleared.border, neutralHover); assert.equal(cleared.invalid, 'false')
      assert.ok(!cleared.describedBy?.includes('test-error'))
    }
    if (control === 'select') {
      await target.click(); await page.getByRole('option', { name: 'Second choice' }).click()
      assert.equal(await page.evaluate(() => window.controlFixture.selection), 'two')
      assert.equal(await target.getAttribute('aria-expanded'), 'false')
    } else {
      await page.locator('.date-picker__field button').click()
      await page.locator('[data-date="2026-09-15"]').click()
      assert.equal(await page.evaluate(() => window.controlFixture.date), '2026-09-15')
      assert.equal(await page.getByRole('dialog').count(), 0)
    }
  })
}
await browser.close()
await writeFile(resolve(out, 'results.json'), JSON.stringify({ baseline, results, measurements, blocked }, null, 2))
console.log(JSON.stringify({ out, results, blocked }, null, 2))
if (results.some(r => !r.pass) || blocked.length) process.exitCode = 1
