// Run with Node 20+. No server, Firebase credentials, or external application traffic.
// --baseline replaces only the provider with the audited Git blob to prove regressions.
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
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-auth-state-'))
const baseline = process.argv.includes('--baseline')
const comparisonDirectory = process.argv.find(arg => arg.startsWith('--compare='))?.slice('--compare='.length)
const replacements = {
  'firebase/config.js': 'export const getFirebaseApp=()=>({});',
  'firebase/auth.js': `const h=()=>window.h;export const observeAuthentication=(cb,err)=>{h().subscriptions++;h().observers.push(cb);h().observer=cb;h().authError=err;return()=>{h().cleanups++;h().observer=null}};export const logoutUser=()=>h().emit(null);export const reloadAuthenticationUser=()=>h().call('verify');export const loginUser=()=>h().call('login');export const registerUser=()=>h().call('register');export const resendEmailVerification=()=>Promise.resolve();export const sendPasswordReset=()=>Promise.resolve();export const getAuthenticationErrorMessage=e=>e.code;`,
  'services/userService.js': `export const getUserProfile=uid=>window.h.call('read',uid);export const ensureUserProfile=u=>window.h.call('ensure',u.uid).then(v=>v??window.h.profiles[u.uid]);export const updateLastActive=uid=>window.h.call('active',uid);export const updateUserProfile=(uid)=>window.h.call('mutation',uid);export const completeAbsentUserProfile=u=>window.h.call('mutation',u.uid);export const enableBusinessRole=uid=>window.h.call('mutation',uid);export const configureAccountType=uid=>window.h.call('mutation',uid);`,
  'firebase/functionsClient.js': `export const acceptLegalConsentCallable=payload=>{window.h.consentPayload=payload;return window.h.call('consent')};`,
}
if (baseline) replacements['context/AuthenticationProvider.jsx'] = execFileSync('git', ['show', '7496c8cd14afc2b1165a267daa924f5c5886bfd2:apps/holalocal-website/src/context/AuthenticationProvider.jsx'], { cwd: website, encoding: 'utf8' })
if (comparisonDirectory) {
  for (const file of ['context/AuthenticationProvider.jsx', 'pages/auth/LegalConsentPage.jsx']) {
    replacements[file] = await readFile(resolve(comparisonDirectory, 'src', file), 'utf8')
  }
}
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': JSON.stringify('development') }, plugins: [{ name: 'synthetic-auth-boundaries', enforce: 'pre', transform(code, id) { for (const [path, replacement] of Object.entries(replacements)) if (id === resolve(src, path)) return replacement } }], esbuild: { jsx: 'automatic' }, build: { outDir: resolve(out, 'dist'), minify: false } })
const results = [], blocked = []
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
const pending = (p, id) => p.waitForFunction(id => !!window.h.pending[id], id)
const done = (p, method) => p.waitForFunction(method => !!window.h.done[method], method)
const flush = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function state(p, expected) {
  await flush(p)
  const actual = await p.evaluate(() => window.h.state)
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, key)
}
async function emit(p, uid, verified = true) { await p.evaluate(([uid, verified]) => window.h.emit(uid, verified), [uid, verified]); await flush(p) }
async function start(p, method, kind, id) { await p.evaluate(({ method, kind, id }) => { window.h.defer(kind, id); window.h.start(method) }, { method, kind, id }); await pending(p, id) }
async function finish(p, id, value, reject = false) { await p.evaluate(({id, value, reject}) => reject ? window.h.reject(id, value) : window.h.resolve(id, value), {id, value, reject}); await flush(p) }
async function scenario(name, run) {
  if (process.argv.includes('--corrections-only') && !name.startsWith('correction:')) return
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const errors = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:18466') { blocked.push(url.href); return route.abort() }
    const path = url.pathname.startsWith('/assets/') ? url.pathname : '/index.html'
    if (path.includes('..')) return route.abort()
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : 'text/html' })
  })
  const p = await context.newPage()
  p.on('pageerror', e => errors.push(e.message))
  try {
    await p.goto('http://127.0.0.1:18466/')
    await p.waitForFunction(() => !!window.h?.observer)
    await emit(p, 'A')
    await run(p)
    assert.deepEqual(errors, [])
    results.push({ name, pass: true, state: await p.evaluate(() => window.h.state), events: await p.evaluate(() => window.h.events) })
  } catch (error) { results.push({ name, pass: false, error: error.stack, state: await p.evaluate(() => window.h?.state), events: await p.evaluate(() => window.h?.events) }) }
  await context.close()
}
const changed = { uid: 'A', displayName: 'Changed', roles: ['business'], accountStatus: 'active' }
for (const destination of [null, 'B', 'A']) for (const reject of [false, true]) {
  await scenario(`old mutation / ${destination ?? 'logout'} / ${reject ? 'reject' : 'success'}`, async p => {
    await start(p, 'updateUserProfile', 'mutation', 'm')
    if (destination === 'A') await emit(p, null)
    await emit(p, destination)
    await finish(p, 'm', reject ? 'permission-denied' : changed, reject)
    await done(p, 'updateUserProfile')
    await state(p, { uid: destination, profileUid: destination, name: destination ? 'Person ' + destination : null, loading: false, profileLoading: false, error: '' })
    if (destination === 'B') {
      await p.evaluate(() => window.h.nav('/business')); await flush(p)
      assert.equal(await p.locator('#business').count(), 0)
    }
    const result = await p.evaluate(() => window.h.done.updateUserProfile)
    assert.deepEqual(result, reject ? { error: 'permission-denied' } : { value: changed })
  })
}
for (const method of ['refreshEmailVerification', 'acceptLegalConsent']) for (const reject of [false, true]) {
  await scenario(`${method} switched / ${reject ? 'reject' : 'success'}`, async p => {
    await start(p, method, method === 'refreshEmailVerification' ? 'verify' : 'consent', 'op')
    await emit(p, 'B', false)
    const reads = await p.evaluate(() => window.h.events.filter(e => e.kind === 'read' && e.uid === 'A').length)
    await finish(p, 'op', reject ? 'unauthenticated' : method === 'acceptLegalConsent' ? { data: { accepted: true } } : true, reject)
    await done(p, method)
    await state(p, { uid: 'B', profileUid: 'B', verified: false, error: '', profileLoading: false })
    assert.equal(await p.evaluate(() => window.h.events.filter(e => e.kind === 'read' && e.uid === 'A').length), reads)
  })
}
for (const readFirst of [true, false]) for (const mutationFirstCompletion of [true, false]) {
  await scenario(`read/mutation ordering ${readFirst}/${mutationFirstCompletion}`, async p => {
    if (readFirst) { await start(p, 'refreshUserProfile', 'read', 'r'); await start(p, 'updateUserProfile', 'mutation', 'm') }
    else { await start(p, 'updateUserProfile', 'mutation', 'm'); await start(p, 'refreshUserProfile', 'read', 'r') }
    if (mutationFirstCompletion) { await finish(p, 'm', changed); await finish(p, 'r', { ...changed, displayName: 'Old' }) }
    else { await finish(p, 'r', { ...changed, displayName: 'Old' }); await finish(p, 'm', changed) }
    await done(p, 'updateUserProfile'); await done(p, 'refreshUserProfile')
    await state(p, { name: 'Changed', status: 'loaded', loading: false, profileLoading: false })
  })
}
for (const method of ['completeUserProfile', 'enableBusinessAccess', 'completeOnboarding']) {
  await scenario(`current mutation wrapper ${method}`, async p => {
    await start(p, method, 'mutation', 'm'); await finish(p, 'm', changed); await done(p, method)
    await state(p, { name: 'Changed', status: 'loaded', loading: false, profileLoading: false })
  })
}
await scenario('read failure, deduplicated retry, recovery and historical acknowledgment', async p => {
  await start(p, 'refreshUserProfile', 'read', 'r'); await finish(p, 'r', 'permission-denied', true); await done(p, 'refreshUserProfile')
  await state(p, { status: 'unavailable', profileLoading: false, error: 'auth.errors.profileLoad' })
  await p.evaluate(() => { window.h.defer('read', 'retry'); const one = window.h.api.retryUserProfile(); window.h.sameRetry = one === window.h.api.retryUserProfile() })
  await pending(p, 'retry'); assert.equal(await p.evaluate(() => window.h.sameRetry), true)
  await p.evaluate(() => window.h.resolve('retry', { ...window.h.profiles.A, termsVersion: '1.0', privacyVersion: '1.0' }))
  await flush(p)
  await state(p, { status: 'loaded', profileLoading: false, error: '' })
  await p.evaluate(() => window.h.nav('/business')); await flush(p)
  assert.equal(await p.locator('#business').count(), 1)
})
await scenario('mutation failure releases superseded foreground loading and permits retry', async p => {
  await start(p, 'refreshUserProfile', 'read', 'r'); await start(p, 'updateUserProfile', 'mutation', 'm')
  await finish(p, 'm', 'unavailable', true); await done(p, 'updateUserProfile')
  await state(p, { status: 'loaded', profileLoading: false, loading: false, name: 'Person A' })
  await finish(p, 'r', { ...changed, displayName: 'Old' })
  await start(p, 'updateUserProfile', 'mutation', 'retry'); await finish(p, 'retry', changed); await done(p, 'updateUserProfile')
  await state(p, { name: 'Changed', profileLoading: false })
})
await scenario('background failure settles superseded foreground without clearing profile', async p => {
  await start(p, 'refreshUserProfile', 'read', 'foreground')
  await p.evaluate(() => { window.h.defer('read', 'background'); window.h.start('refreshUserProfile', undefined, { background: true }) }); await pending(p, 'background')
  await finish(p, 'background', 'unavailable', true); await done(p, 'refreshUserProfile')
  await finish(p, 'foreground', { ...changed, displayName: 'Old' })
  await state(p, { name: 'Person A', status: 'loaded', profileLoading: false, error: '' })
})
for (const observer of [false, true]) for (const reject of [false, true]) {
  await scenario(`delayed ${observer ? 'observer' : 'refresh'} ${reject}`, async p => {
    if (observer) { await p.evaluate(() => { window.h.defer('read', 'r'); void window.h.emit('A') }); await pending(p, 'r') }
    else await start(p, 'refreshUserProfile', 'read', 'r')
    await emit(p, 'B'); await finish(p, 'r', reject ? 'permission-denied' : changed, reject)
    await state(p, { uid: 'B', profileUid: 'B', status: 'loaded', error: '', loading: false, profileLoading: false })
  })
}
await scenario('unmount/remount rejects previous lifetime writes', async p => {
  await start(p, 'updateUserProfile', 'mutation', 'm')
  await p.evaluate(() => window.h.remount()); await p.waitForFunction(() => !!window.h.observer)
  await emit(p, 'A'); await finish(p, 'm', changed)
  await state(p, { uid: 'A', name: 'Person A', loading: false, profileLoading: false })
})
await scenario('current verification and consent refresh successfully', async p => {
  await emit(p, 'A', false)
  await start(p, 'refreshEmailVerification', 'verify', 'v'); await finish(p, 'v', true); await done(p, 'refreshEmailVerification')
  await state(p, { verified: true, profileUid: 'A', profileLoading: false })
  await start(p, 'acceptLegalConsent', 'consent', 'c'); await finish(p, 'c', { data: { accepted: true } }); await done(p, 'acceptLegalConsent')
  assert.deepEqual(await p.evaluate(() => window.h.consentPayload), { acceptTerms: true, acceptPrivacy: true, termsVersion: '1.1', privacyVersion: '1.1' })
  await state(p, { error: '', status: 'loaded', profileLoading: false })
})
await scenario('retry promises belong to their session; old finally cannot release new retry', async p => {
  await p.evaluate(() => { window.h.defer('read', 'old'); window.h.start('retryUserProfile') }); await pending(p, 'old')
  await emit(p, 'B')
  await p.evaluate(() => { window.h.defer('read', 'new'); window.h.newRetry = window.h.api.retryUserProfile() }); await pending(p, 'new')
  await finish(p, 'old', 'permission-denied', true)
  await state(p, { uid: 'B', profileUid: 'B', profileLoading: true, error: '' })
  assert.equal(await p.evaluate(() => window.h.api.retryUserProfile() === window.h.newRetry), true)
  await p.evaluate(() => window.h.resolve('new', window.h.profiles.B)); await flush(p)
  await state(p, { uid: 'B', status: 'loaded', profileLoading: false })
})
await scenario('old verification and consent cannot follow up in same-UID new session', async p => {
  await start(p, 'refreshEmailVerification', 'verify', 'v')
  await start(p, 'acceptLegalConsent', 'consent', 'c')
  await emit(p, null); await emit(p, 'A', false)
  const count = await p.evaluate(() => window.h.events.filter(e => e.kind === 'read').length)
  await finish(p, 'v', true); await finish(p, 'c', { data: {} })
  await done(p, 'refreshEmailVerification'); await done(p, 'acceptLegalConsent')
  await state(p, { uid: 'A', verified: false, profileLoading: false, error: '' })
  assert.equal(await p.evaluate(() => window.h.events.filter(e => e.kind === 'read').length), count)
})
await scenario('observer error invalidates pending mutation; auth event recovers', async p => {
  await start(p, 'updateUserProfile', 'mutation', 'm')
  await p.evaluate(() => window.h.authError({ code: 'auth/user-disabled' })); await flush(p)
  await finish(p, 'm', changed)
  await state(p, { status: 'unavailable', error: 'auth.errors.sessionRestore', loading: false, profileLoading: false })
  await emit(p, 'B'); await state(p, { uid: 'B', profileUid: 'B', error: '', status: 'loaded' })
})
await scenario('delayed ensure does not apply after switch', async p => {
  await p.evaluate(() => { window.h.defer('ensure', 'e'); void window.h.emit('A') }); await pending(p, 'e')
  await emit(p, 'B'); await finish(p, 'e', changed)
  await state(p, { uid: 'B', profileUid: 'B', loading: false, profileLoading: false, error: '' })
})
await scenario('absent profile completion and foreground success', async p => {
  await start(p, 'refreshUserProfile', 'read', 'r'); await finish(p, 'r', null); await done(p, 'refreshUserProfile')
  await state(p, { status: 'absent', profileLoading: false })
  await start(p, 'completeUserProfile', 'mutation', 'm'); await finish(p, 'm', changed); await done(p, 'completeUserProfile')
  await state(p, { status: 'loaded', name: 'Changed', profileLoading: false })
})
await scenario('latest mutation wins even if older mutation resolves last', async p => {
  await start(p, 'updateUserProfile', 'mutation', 'old')
  await start(p, 'completeOnboarding', 'mutation', 'new')
  await finish(p, 'new', changed); await finish(p, 'old', { ...changed, displayName: 'Old' })
  await state(p, { name: 'Changed', profileLoading: false })
})
await scenario('mutation supersession releases obsolete same-session retry handle', async p => {
  await p.evaluate(() => { window.h.defer('read', 'old'); window.h.oldRetry = window.h.api.retryUserProfile() }); await pending(p, 'old')
  await start(p, 'updateUserProfile', 'mutation', 'm'); await finish(p, 'm', changed)
  await p.evaluate(() => { window.h.defer('read', 'new'); window.h.newRetry = window.h.api.retryUserProfile() }); await pending(p, 'new')
  assert.equal(await p.evaluate(() => window.h.newRetry === window.h.oldRetry), false)
  await finish(p, 'old', 'unavailable', true)
  assert.equal(await p.evaluate(() => window.h.api.retryUserProfile() === window.h.newRetry), true)
  await finish(p, 'new', changed)
  await state(p, { name: 'Changed', profileLoading: false })
})
await scenario('observer failure retains explicit profile retry', async p => {
  await p.evaluate(() => window.h.authError({ code: 'auth/network-request-failed' })); await flush(p)
  await state(p, { status: 'unavailable', loading: false })
  await p.evaluate(() => window.h.start('retryUserProfile')); await done(p, 'retryUserProfile')
  await state(p, { uid: 'A', profileUid: 'A', status: 'loaded', error: '', profileLoading: false })
})
for (const successFirst of [false, true]) await scenario(`correction: failed newer mutation / older succeeds first=${successFirst}`, async p => {
  await start(p, 'updateUserProfile', 'mutation', 'old')
  await start(p, 'completeOnboarding', 'mutation', 'new')
  if (successFirst) { await finish(p, 'old', changed); await finish(p, 'new', 'unavailable', true) }
  else { await finish(p, 'new', 'unavailable', true); await finish(p, 'old', changed) }
  await state(p, { name: 'Changed', status: 'loaded', profileLoading: false, loading: false })
})
for (const initialFails of [false, true]) await scenario(`correction: background error while initial read pending / initialFails=${initialFails}`, async p => {
  await p.evaluate(() => { window.h.defer('read', 'initial'); void window.h.emit('B') }); await pending(p, 'initial'); await flush(p)
  await p.evaluate(() => { window.h.defer('read', 'bg'); window.h.start('refreshUserProfile', undefined, { background: true }) }); await pending(p, 'bg')
  await finish(p, 'bg', 'unavailable', true)
  await state(p, { status: 'unavailable', profileLoading: false, error: 'auth.errors.profileLoad' })
  await p.evaluate(fails => fails ? window.h.reject('initial', 'unavailable') : window.h.resolve('initial', window.h.profiles.B), initialFails); await flush(p)
  await state(p, { status: 'unavailable', profileLoading: false })
  await p.evaluate(() => window.h.start('retryUserProfile')); await done(p, 'retryUserProfile')
  await state(p, { uid: 'B', profileUid: 'B', status: 'loaded', error: '', profileLoading: false })
})
await scenario('correction: repeated identical observer errors and real Retry', async p => {
  await p.evaluate(() => window.h.nav('/secure')); await flush(p)
  for (let i = 0; i < 2; i++) { await p.evaluate(() => window.h.authError({ code: 'auth/network-request-failed' })); await flush(p) }
  const before = await p.evaluate(() => window.h.events.filter(e => e.kind === 'read').length)
  await p.getByRole('button', { name: 'common.retry', exact: true }).click(); await flush(p)
  await state(p, { status: 'loaded', profileUid: 'A', error: '', profileLoading: false })
  assert.equal(await p.evaluate(() => window.h.events.filter(e => e.kind === 'read').length), before + 1)
  assert.equal(await p.locator('#secure').count(), 1)
})
await scenario('correction: actual development StrictMode effect replay', async p => {
  const lifecycle = await p.evaluate(() => ({ subscriptions: window.h.subscriptions, cleanups: window.h.cleanups }))
  assert.ok(lifecycle.subscriptions >= 2, JSON.stringify(lifecycle))
  assert.ok(lifecycle.cleanups >= 1, JSON.stringify(lifecycle))
  const reads = await p.evaluate(() => window.h.events.filter(e => e.kind === 'read').length)
  await p.evaluate(() => window.h.observers[0]({ uid: 'obsolete-effect', emailVerified: true })); await flush(p)
  await state(p, { uid: 'A', profileUid: 'A', loading: false, profileLoading: false })
  assert.equal(await p.evaluate(() => window.h.events.filter(e => e.kind === 'read').length), reads)
  await start(p, 'updateUserProfile', 'mutation', 'm'); await finish(p, 'm', changed)
  await state(p, { name: 'Changed', profileLoading: false })
})
for (const when of ['callable', 'profile-read']) await scenario(`correction: consent supersession during ${when}`, async p => {
  await start(p, 'acceptLegalConsent', 'consent', 'c')
  if (when === 'profile-read') {
    await p.evaluate(() => { window.h.defer('read', 'r'); window.h.resolve('c', { data: { accepted: true } }) }); await pending(p, 'r')
  }
  await emit(p, 'B')
  if (when === 'callable') await finish(p, 'c', { data: { accepted: true } })
  else await p.evaluate(() => window.h.resolve('r', window.h.profiles.A))
  await done(p, 'acceptLegalConsent')
  assert.deepEqual(await p.evaluate(() => window.h.done.acceptLegalConsent.value), { status: 'superseded', consent: { accepted: true } })
  await state(p, { uid: 'B', profileUid: 'B', profileLoading: false })
})
await scenario('correction: real consent caller does not navigate on superseded completion', async p => {
  await p.evaluate(async () => {
    window.h.profiles.A = { ...window.h.profiles.A, termsAccepted: false, privacyAccepted: false }
    window.h.profiles.B = { ...window.h.profiles.B, termsAccepted: false, privacyAccepted: false }
    await window.h.api.refreshUserProfile()
  }); await flush(p)
  await p.evaluate(() => window.h.nav('/legal-consent')); await flush(p)
  await p.locator('#legal-consent-terms').check(); await p.locator('#legal-consent-privacy').check()
  await p.evaluate(() => window.h.defer('consent', 'c'))
  await p.getByRole('button', { name: 'legalConsent.submit', exact: true }).click(); await pending(p, 'c')
  await emit(p, 'B'); await finish(p, 'c', { data: { accepted: true } })
  await state(p, { uid: 'B', path: '/legal-consent', profileUid: 'B', profileLoading: false })
  assert.equal(await p.getByRole('button', { name: 'legalConsent.submit', exact: true }).isEnabled(), true)
})
await scenario('correction: current consent can return confirmed absence', async p => {
  await start(p, 'acceptLegalConsent', 'consent', 'c')
  await p.evaluate(() => { window.h.defer('read', 'r'); window.h.resolve('c', { data: { accepted: true } }) }); await pending(p, 'r')
  await finish(p, 'r', null); await done(p, 'acceptLegalConsent')
  assert.deepEqual(await p.evaluate(() => window.h.done.acceptLegalConsent.value), { status: 'current', consent: { accepted: true }, profile: null })
  await state(p, { status: 'absent', profileLoading: false })
})
await browser.close()
await writeFile(resolve(out, 'results.json'), JSON.stringify({ baseline, comparisonDirectory, developmentStrictMode: true, results, blocked }, null, 2))
for (const result of results) console.log(result.pass ? 'PASS' : 'FAIL', result.name, result.pass ? '' : result.error)
console.log('Artifacts:', out)
console.log(`${results.filter(r => r.pass).length}/${results.length} passed; external requests: ${blocked.length}`)
if (results.some(r => !r.pass) || blocked.length) process.exitCode = 1
