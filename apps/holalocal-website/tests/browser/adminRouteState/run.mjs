// Run with Node 20+. No server, Firebase credentials, or external application traffic.
// --baseline uses the approved S5-02 provider and both unchanged guards.
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
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-admin-state-'))
const baseline = process.argv.includes('--baseline')
const replacements = {
  'firebase/config.js': 'export const getFirebaseApp=()=>({});',
  'firebase/auth.js': `const h=()=>window.h;export const observeAuthentication=(cb,err)=>{h().subscriptions++;h().observers.push(cb);h().observer=cb;h().authError=err;return()=>{h().cleanups++;h().observer=null}};export const logoutUser=()=>h().emit(null);export const reloadAuthenticationUser=()=>h().call('verify');export const loginUser=()=>h().call('login');export const registerUser=()=>h().call('register');export const resendEmailVerification=()=>Promise.resolve();export const sendPasswordReset=()=>Promise.resolve();export const getAuthenticationErrorMessage=e=>e.code;`,
  'services/userService.js': `export const getUserProfile=uid=>window.h.call('read',uid);export const ensureUserProfile=u=>window.h.call('ensure',u.uid).then(v=>v??window.h.profiles[u.uid]);export const updateLastActive=uid=>window.h.call('active',uid);export const updateUserProfile=(uid)=>window.h.call('mutation',uid);export const completeAbsentUserProfile=u=>window.h.call('mutation',u.uid);export const enableBusinessRole=uid=>window.h.call('mutation',uid);export const configureAccountType=uid=>window.h.call('mutation',uid);`,
  'firebase/functionsClient.js': `export const acceptLegalConsentCallable=payload=>{window.h.consentPayload=payload;return window.h.call('consent')};`,
}
if (baseline) for (const file of ['context/AuthenticationProvider.jsx', 'routes/AdminRoute.jsx', 'routes/AdminOnlyRoute.jsx']) {
  replacements[file] = execFileSync('git', ['show', 'de730988ad23e6486018fdc05ff374ae0e15a13c:apps/holalocal-website/src/' + file], { cwd: website, encoding: 'utf8' })
}
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': JSON.stringify('development') }, plugins: [{ name: 'synthetic-auth-boundaries', enforce: 'pre', transform(code, id) { for (const [path, replacement] of Object.entries(replacements)) if (id === resolve(src, path)) return replacement } }], esbuild: { jsx: 'automatic' }, build: { outDir: resolve(out, 'dist'), minify: false } })
const results = [], blocked = []
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
const pending = (p, id) => p.waitForFunction(id => !!window.h.pending[id], id)
const flush = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function emit(p, uid, verified = true) { await p.evaluate(([uid, verified]) => window.h.emit(uid, verified), [uid, verified]); await flush(p) }
async function finish(p, id, value, reject = false) { await p.evaluate(({id, value, reject}) => reject ? window.h.reject(id, value) : window.h.resolve(id, value), {id, value, reject}); await flush(p) }
async function scenario(guard, name, run, nested = false) {
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
    await p.goto('http://127.0.0.1:18466/?guard=' + guard + (nested ? '&nested=1' : ''))
    await p.waitForFunction(() => !!window.h?.observer)
    await run(p)
    assert.deepEqual(errors, [])
    results.push({ guard, name, pass: true, state: await p.evaluate(() => window.h.state), events: await p.evaluate(() => window.h.events) })
  } catch (error) { results.push({ guard, name, pass: false, error: error.stack, state: await p.evaluate(() => window.h?.state), events: await p.evaluate(() => window.h?.events) }) }
  await context.close()
}
async function holdIdentity(p, uid, id) {
  await p.evaluate(({ uid, id }) => { window.h.defer('token', id); void window.h.emit(uid) }, { uid, id })
  await pending(p, id); await flush(p)
}
async function admitted(p, expected) { await flush(p); assert.equal(await p.locator('#admitted').count(), expected ? 1 : 0) }
async function noAdmissionSince(p, index) {
  await admitted(p, false)
  assert.deepEqual(await p.evaluate(i => window.h.events.slice(i).filter(e => 'admitted' in e), index), [])
}
for (const guard of ['general', 'only']) {
  for (const outcome of ['allowed', 'denied', 'failed', 'expired']) await scenario(guard, 'A allowed -> B pending -> ' + outcome, async p => {
    await emit(p, 'A'); await admitted(p, true)
    const index = await p.evaluate(() => window.h.events.length)
    await holdIdentity(p, 'B', 'b'); await noAdmissionSince(p, index)
    assert.equal(await p.getByText('admin.access.checking', { exact: true }).count(), 1)
    await finish(p, 'b', outcome === 'allowed' ? { claims: { admin: true } } : outcome === 'denied' ? { claims: {} } : outcome === 'expired' ? 'auth/id-token-expired' : 'unavailable', ['failed', 'expired'].includes(outcome))
    await admitted(p, outcome === 'allowed')
    if (outcome !== 'allowed') assert.equal(await p.getByRole('heading', { name: guard === 'only' || outcome === 'denied' ? 'admin.access.deniedTitle' : 'admin.access.' + outcome + 'Title', exact: true }).count(), 1)
  })
  for (const oldReject of [false, true]) for (const allowB of [false, true]) await scenario(guard, `late A reject=${oldReject}, B allowed=${allowB}`, async p => {
    await holdIdentity(p, 'A', 'a'); await holdIdentity(p, 'B', 'b')
    await finish(p, 'b', { claims: allowB ? { admin: true } : {} }); await admitted(p, allowB)
    await finish(p, 'a', oldReject ? 'auth/id-token-expired' : { claims: { admin: true } }, oldReject)
    await admitted(p, allowB)
  })
  await scenario(guard, 'logout clears admission and same-object same-UID relogin is pending', async p => {
    await emit(p, 'A'); await admitted(p, true)
    await emit(p, null); await admitted(p, false)
    // Restore route after AdminRoute's intentional login redirect.
    await p.evaluate(() => window.h.nav('/?guard=' + new URLSearchParams(window.location.search).get('guard')))
    await holdIdentity(p, 'A', 'new'); await admitted(p, false)
    await finish(p, 'new', { claims: {} }); await admitted(p, false)
  })
  await scenario(guard, 'batched logout/relogin invalidates an allowed same-object identity', async p => {
    await emit(p, 'A'); await admitted(p, true)
    const index = await p.evaluate(() => window.h.events.length)
    await p.evaluate(() => { window.h.defer('token', 'new'); void window.h.emit(null); void window.h.emit('A') })
    await flush(p); await noAdmissionSince(p, index); await pending(p, 'new')
    await finish(p, 'new', { claims: {} }); await admitted(p, false)
  })
  await scenario(guard, 'same-UID old session pending completion cannot authorize new session', async p => {
    await holdIdentity(p, 'A', 'old')
    await p.evaluate(() => { window.h.defer('token', 'new'); void window.h.emit(null); void window.h.emit('A') })
    await flush(p); await admitted(p, false)
    await finish(p, 'old', { claims: { admin: true } }); await admitted(p, false)
    await pending(p, 'new'); await finish(p, 'new', { claims: {} }); await admitted(p, false)
  })
  await scenario(guard, 'unmount/remount ignores obsolete failure', async p => {
    await holdIdentity(p, 'A', 'old'); await p.evaluate(() => window.h.remount()); await flush(p)
    await emit(p, 'B'); await admitted(p, true)
    await finish(p, 'old', 'unavailable', true); await admitted(p, true)
  })
  for (const reject of [false, true]) await scenario(guard, 'StrictMode guard replay old rejection=' + reject, async p => {
    await emit(p, 'A'); await admitted(p, true)
    await p.evaluate(() => { window.h.defer('token', 'first'); window.h.defer('token', 'second'); window.h.replayGuard() })
    await pending(p, 'first'); await pending(p, 'second'); await admitted(p, false)
    await finish(p, 'second', { claims: {} }); await admitted(p, false)
    await finish(p, 'first', reject ? 'unavailable' : { claims: { admin: true } }, reject); await admitted(p, false)
  })
  for (const claims of [{ admin: true }, { moderator: true }, { admin: 'true', moderator: 'true' }, {}]) await scenario(guard, 'claim policy ' + JSON.stringify(claims), async p => {
    await p.evaluate(claims => { window.h.claims.A = claims }, claims)
    await emit(p, 'A'); await admitted(p, claims.admin === true || guard === 'general' && claims.moderator === true)
  })
}
for (const expired of [false, true]) await scenario('general', 'forced-refresh retry and recovery expired=' + expired, async p => {
  await holdIdentity(p, 'A', 'initial'); await finish(p, 'initial', expired ? 'auth/id-token-expired' : 'unavailable', true)
  await p.evaluate(() => window.h.defer('token', 'retry'))
  await p.getByRole('button', { name: 'common.retry', exact: true }).click(); await pending(p, 'retry'); await admitted(p, false)
  assert.equal(await p.evaluate(() => window.h.events.filter(e => e.kind === 'token').at(-1).force), true)
  await finish(p, 'retry', { claims: { moderator: true } }); await admitted(p, true)
})
for (const reject of [false, true]) await scenario('general', 'retry overlapping identity check old rejection=' + reject, async p => {
  await holdIdentity(p, 'A', 'initial'); await finish(p, 'initial', 'unavailable', true)
  await p.evaluate(() => window.h.defer('token', 'retry'))
  await p.getByRole('button', { name: 'common.retry', exact: true }).click(); await pending(p, 'retry')
  await holdIdentity(p, 'B', 'b'); await finish(p, 'b', { claims: {} }); await admitted(p, false)
  await finish(p, 'retry', reject ? 'unavailable' : { claims: { admin: true } }, reject); await admitted(p, false)
})
await scenario('only', 'denial preserves no-retry UI; new session recovers', async p => {
  await holdIdentity(p, 'A', 'failed'); await finish(p, 'failed', 'unavailable', true); await admitted(p, false)
  assert.equal(await p.getByRole('button', { name: 'common.retry', exact: true }).count(), 0)
  await emit(p, 'B'); await admitted(p, true)
})
await scenario('only', 'production guard nesting denies moderator and admits admin', async p => {
  await p.evaluate(() => { window.h.claims.A = { moderator: true } }); await emit(p, 'A'); await admitted(p, false)
  await emit(p, 'B'); await admitted(p, true)
}, true)
await browser.close()
await writeFile(resolve(out, 'results.json'), JSON.stringify({ baseline, developmentStrictMode: true, results, blocked }, null, 2))
for (const result of results) console.log(result.pass ? 'PASS' : 'FAIL', result.guard, result.name, result.pass ? '' : result.error)
console.log('Artifacts:', out)
console.log(`${results.filter(r => r.pass).length}/${results.length} passed; external requests: ${blocked.length}`)
if (results.some(r => !r.pass) || blocked.length) process.exitCode = 1
