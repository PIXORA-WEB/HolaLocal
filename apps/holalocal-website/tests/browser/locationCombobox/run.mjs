// Run with Node 20+. No server, Firebase credentials, or external application traffic.
// --baseline uses the unchanged control from the approved batch-2 commit.
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
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-location-'))
const baseline = process.argv.includes('--baseline')
// Token comparison keeps the reviewed component and substitutes only approved-base CSS.
const tokenBaseline = process.argv.includes('--token-baseline')
const replacements = {
  'firebase/config.js': 'export const getFirebaseApp=()=>({});export const getFirebaseAuth=()=>({});',
  'hooks/useAuthentication.js': 'const refreshUserProfile=async()=>{};const signOutUser=async()=>{};export default ()=>({user:window.h.user,userProfile:window.h.profile,refreshUserProfile,signOutUser});',
  'services/profileMediaPresentation.js': 'export const loadProfileMediaPresentation=async()=>null;',
}
for (const file of ['services/businessService.js', 'firebase/auth.js', 'firebase/storageClient.js']) {
  const source = await readFile(resolve(src, file), 'utf8')
  const names = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)].map(m => m[1])
  replacements[file] = names.map(name => `export const ${name}=${name === 'ensureBusinessProfile' || name === 'getBusinessById' ? 'async()=>window.h.business' : name === 'getAuthenticationErrorMessage' ? '()=>"Synthetic error"' : '()=>{throw new Error("Unexpected synthetic service call")}'};`).join('')
}
if (baseline) replacements['components/business/LocationCombobox.jsx'] = execFileSync('git', ['show', '17d1aed1cb7b2855917e87e696e39f7a26d3ceb4:apps/holalocal-website/src/components/business/LocationCombobox.jsx'], { cwd: website, encoding: 'utf8' })
if (tokenBaseline) replacements['styles/global.css'] = execFileSync('git', ['show', 'ebffceb5591e508b248158eb6b08441a77c4c4fb:apps/holalocal-website/src/styles/global.css'], { cwd: website, encoding: 'utf8' })
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': JSON.stringify('development') }, plugins: [{ name: 'synthetic-auth-boundaries', enforce: 'pre', transform(code, id) { for (const [path, replacement] of Object.entries(replacements)) if (id === resolve(src, path)) return replacement } }], esbuild: { jsx: 'automatic' }, build: { outDir: resolve(out, 'dist'), minify: false } })
const results = [], blocked = []
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
const flush = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function scenario(width, name, run, editor = false) {
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
    await p.goto('http://127.0.0.1:18466/' + (editor ? '?editor=1' : ''))
    await p.getByRole('combobox').first().waitFor()
    await run(p)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true, form: await p.locator('#canonical').textContent().catch(() => null) })
  } catch (error) { results.push({ width, name, pass: false, error: error.stack, state: await p.evaluate(() => window.h?.state), events: await p.evaluate(() => window.h?.events) }) }
  console.log("SCENARIO", width, name, results.at(-1)?.pass)
  await context.close()
}
const input = p => p.locator('input[role="combobox"]').first()
async function closed(p) { await flush(p); assert.equal(await p.getByRole('listbox').count(), 0) }
async function form(p) { return JSON.parse(await p.locator('#canonical').textContent()) }
async function visibleActive(p) {
  const measurement = await input(p).evaluate(el => {
    const option = document.getElementById(el.getAttribute('aria-activedescendant'))
    const list = option?.parentElement
    if (!option || !list) return null
    const a = option.getBoundingClientRect(), b = list.getBoundingClientRect()
    return { text: option.textContent, top: a.top, bottom: a.bottom, viewTop: b.top + list.clientTop, viewBottom: b.top + list.clientTop + list.clientHeight, scrollTop: list.scrollTop, overflow: list.scrollHeight > list.clientHeight, focused: document.activeElement === el, pageY: window.scrollY }
  })
  assert.ok(measurement)
  assert.ok(measurement.top >= measurement.viewTop - 1 && measurement.bottom <= measurement.viewBottom + 1, JSON.stringify(measurement))
  assert.equal(measurement.focused, true)
  return measurement
}
for (const width of [1440, 390]) {
  await scenario(width, 'editor instruction and Clear use legible muted color', async p => {
    const control = p.locator('.location-combobox input')
    await control.waitFor()
    await p.locator('.location-combobox').scrollIntoViewIfNeeded()
    const metrics = await p.locator('.location-combobox').evaluate(root => {
      function inspect(el, paintedBehind = el) {
        const style = getComputedStyle(el)
        let background = 'rgba(0, 0, 0, 0)'
        for (let parent = paintedBehind; parent; parent = parent.parentElement) {
          background = getComputedStyle(parent).backgroundColor
          if (background !== 'rgba(0, 0, 0, 0)') break
        }
        const lum = color => {
          const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
            v /= 255
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
          })
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
        }
        const a = lum(style.color), b = lum(background)
        return { color: style.color, background, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), fontSize: style.fontSize, rect: el.getBoundingClientRect().toJSON() }
      }
      return { instruction: inspect(root.querySelector(':scope > p')), // Clear is transparent and positioned over its sibling input.
        clear: inspect(root.querySelector('button'), root.querySelector('input')), input: root.querySelector('input').getBoundingClientRect().toJSON() }
    })
    results.push({ width, textMetrics: metrics })
    for (const element of [metrics.instruction, metrics.clear]) {
      assert.equal(element.color, 'rgb(101, 115, 134)')
      assert.ok(element.contrast >= 4.5, JSON.stringify(element))
    }
    await control.click(); await control.press('Tab')
    const focus = await p.locator('.location-combobox button').evaluate(el => ({ focused: document.activeElement === el, outline: getComputedStyle(el).outlineWidth, visible: el.getBoundingClientRect().width > 0 }))
    assert.deepEqual(focus, { focused: true, outline: '3px', visible: true })
    await p.keyboard.press('Enter'); await closed(p)
    assert.equal(await control.inputValue(), '')
  }, true)
  await scenario(width, 'rounded suggestion states preserve geometry and keyboard visibility', async p => {
    await input(p).click()
    const option = p.getByRole('option').nth(1)
    const idle = await option.evaluate(el => ({ radius: getComputedStyle(el).borderRadius, background: getComputedStyle(el).backgroundColor, rect: el.getBoundingClientRect().toJSON() }))
    await option.hover()
    const hover = await option.evaluate(el => ({ radius: getComputedStyle(el).borderRadius, background: getComputedStyle(el).backgroundColor, rect: el.getBoundingClientRect().toJSON() }))
    const y = await p.evaluate(() => window.scrollY)
    for (let i = 0; i < 9; i++) await input(p).press('ArrowDown')
    const active = await visibleActive(p)
    results.push({ width, optionMetrics: { idle, hover, active } })
    assert.equal(idle.radius, '10.4px')
    assert.equal(hover.radius, idle.radius)
    assert.notEqual(hover.background, idle.background)
    assert.equal(hover.background, 'rgb(238, 245, 255)')
    assert.deepEqual(hover.rect, idle.rect)
    assert.equal(active.pageY, y)
    await input(p).press('Enter'); await closed(p)
    assert.ok((await form(p)).primaryLocationId)
  })

  for (const key of ['Tab', 'Shift+Tab']) await scenario(width, key + ' departs and closes', async p => {
    await input(p).click(); await input(p).press(key); await closed(p)
    assert.equal(await p.locator(key === 'Tab' ? '#after' : '#before').evaluate(el => el === document.activeElement), true)
  })
  await scenario(width, 'outside pointer dismisses and following field remains usable', async p => {
    await input(p).click(); await p.locator('#before').click(); await closed(p)
    await p.locator('#after').fill('Following input works'); assert.equal(await p.locator('#after').inputValue(), 'Following input works')
    assert.equal((await form(p)).primaryLocationId, '')
  })
  for (const mode of width === 390 ? ['pointer', 'touch'] : ['pointer']) await scenario(width, mode + ' selects canonical option without blur loss', async p => {
    await input(p).fill('Marbella'); const option = p.getByRole('option').first()
    if (mode === 'touch') await option.tap(); else await option.click()
    await closed(p); const f = await form(p)
    assert.ok(f.primaryLocationId); assert.equal(f.city, 'Marbella'); assert.equal(f.country, 'ES'); assert.equal(f.province, 'malaga')
    await input(p).press('ArrowDown'); assert.equal(await p.getByRole('option', { selected: true }).count(), 1)
    await input(p).press('Escape'); await closed(p); assert.deepEqual(await form(p), f)
  })
  await scenario(width, 'Escape preserves unmatched text; internal clear remains usable', async p => {
    await input(p).fill('unmatched synthetic'); await input(p).press('Escape'); await closed(p)
    assert.equal(await input(p).inputValue(), 'unmatched synthetic')
    await input(p).press('ArrowDown'); await input(p).press('Tab')
    assert.equal(await p.getByRole('button', { name: 'business.form.location.clearPrimary', exact: true }).evaluate(el => el === document.activeElement), true)
    assert.equal(await p.getByRole('listbox').count(), 1)
    await p.keyboard.press('Enter'); await closed(p); assert.deepEqual(await form(p), { city: '', primaryLocationId: '' })
  })
  await scenario(width, 'keyboard traversal scrolls only the list; Enter selects visible active option', async p => {
    await input(p).click(); const pageY = await p.evaluate(() => window.scrollY)
    const count = await p.getByRole('option').count(); assert.equal(count, 12)
    let measured
    for (let i = 0; i < count; i++) { await input(p).press('ArrowDown'); await flush(p); measured = await visibleActive(p); assert.equal(measured.pageY, pageY) }
    for (let i = 0; i < count; i++) { await input(p).press('ArrowUp'); await flush(p); measured = await visibleActive(p); assert.equal(measured.pageY, pageY) }
    assert.equal(measured.overflow, true)
    await input(p).press('ArrowUp'); await flush(p); measured = await visibleActive(p)
    await p.screenshot({ path: resolve(out, `keyboard-${width}.png`) })
    await input(p).press('Enter'); await closed(p)
    const f = await form(p); assert.ok(f.primaryLocationId); assert.ok(measured.text.includes(f.city))
    results.push({ width, measurement: measured })
  })
  await scenario(width, 'filtering and externally changing results never leave dangling active descendant', async p => {
    await input(p).click(); for (let i = 0; i < 10; i++) await input(p).press('ArrowDown')
    await p.evaluate(() => window.h.setText('Marbella')); await flush(p)
    await visibleActive(p)
    await input(p).fill('zzzzzz-synthetic'); assert.equal(await input(p).getAttribute('aria-activedescendant'), null)
    await input(p).press('ArrowUp'); await input(p).press('Enter'); assert.equal((await form(p)).primaryLocationId, '')
    await input(p).fill('Marbella'); await visibleActive(p); await input(p).press('Enter'); await closed(p)
    assert.equal((await form(p)).city, 'Marbella')
  })
  await scenario(width, 'unmount removes active document listeners', async p => {
    await p.evaluate(() => {
      const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document)
      window.h.listeners = new Set()
      document.addEventListener = (type, listener, options) => { if (type === 'pointerdown') window.h.listeners.add(listener); return add(type, listener, options) }
      document.removeEventListener = (type, listener, options) => { if (type === 'pointerdown') window.h.listeners.delete(listener); return remove(type, listener, options) }
    })
    await input(p).click(); await p.evaluate(() => window.h.unmount()); await flush(p)
    assert.equal(await p.evaluate(() => window.h.listeners.size), 0)
    await p.locator('#outside').click()
  })
  await scenario(width, 'real editor retains unresolved text and accepts canonical correction', async p => {
    const control = p.locator('.location-combobox input')
    await control.waitFor(); assert.equal(await control.inputValue(), 'Unresolved synthetic village')
    assert.equal(await p.locator('.business-form__location-unresolved').count(), 1)
    await control.click(); await control.press('Shift+Tab'); await closed(p)
    assert.equal(await control.inputValue(), 'Unresolved synthetic village')
    await control.fill('Marbella'); await p.getByRole('option').filter({ hasText: 'Marbella' }).first().click(); await closed(p)
    assert.equal(await control.inputValue(), 'Marbella')
    assert.equal(await p.locator('.business-form__location-unresolved').count(), 0)
    assert.ok((await p.locator('.business-form__location-context').textContent()).includes('Marbella'))
    await control.click(); await control.press('Tab'); await p.keyboard.press('Tab'); await closed(p)
    assert.equal(await control.inputValue(), 'Marbella')
  }, true)
}
await browser.close()
const scenarios = results.filter(r => 'pass' in r)
await writeFile(resolve(out, 'results.json'), JSON.stringify({ baseline, tokenBaseline, results, blocked }, null, 2))
for (const result of scenarios) console.log(result.pass ? 'PASS' : 'FAIL', result.width, result.name, result.pass ? '' : result.error)
console.log('Artifacts:', out)
console.log(`${scenarios.filter(r => r.pass).length}/${scenarios.length} passed; external requests: ${blocked.length}`)
if (scenarios.some(r => !r.pass) || blocked.length) process.exitCode = 1
