import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseEmailAction, safeActionContinue, actionLocale, actionError, createEmailActionController } from '../src/utils/emailActionModel.js'
import { emailActionTranslations } from '../src/i18n/emailActionTranslations.js'
const query = (mode='verifyEmail') => `?mode=${mode}&oobCode=synthetic-code&apiKey=fixture-key`
const request = mode => parseEmailAction(query(mode), 'fixture-key')
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b });return {promise,resolve,reject} }
function fixture(mode='verifyEmail', overrides={}) {
 const calls=[];const sdk={currentUser:()=>null,check:async()=>({operation:mode==='recoverEmail'?'RECOVER_EMAIL':'VERIFY_EMAIL'}),apply:async()=>{calls.push('apply')},verifyReset:async()=>{calls.push('verify')},confirm:async()=>{calls.push('confirm')},refresh:async()=>{calls.push('refresh')},...overrides}
 const states=[];const model=createEmailActionController(request(mode),sdk);const stop=model.subscribe(s=>states.push(s));return {model,states,calls,stop}
}
for(const [name,q]of [['missing mode','?oobCode=x&apiKey=fixture-key'],['missing code','?mode=verifyEmail&apiKey=fixture-key'],['unsupported',query('signIn')],['duplicate',query()+'&mode=resetPassword'],['malformed',query()+'&lang=%zz'],['foreign key',query().replace('fixture-key','other')]])test(name,()=>assert.equal(parseEmailAction(q,'fixture-key').error,'invalid'))
test('unsafe continuation rejected',()=>{for(const u of ['https://evil.test/','//www.holalocal.es/','javascript:alert(1)','data:text/plain,x','https://www.holalocal.es@evil.test/','https://www.holalocal.es/\\evil','https://www.holalocal.es/auth/action','https://www.holalocal.es/%2f%2fevil'])assert.equal(safeActionContinue(u),'/login')})
test('canonical continuation preserves safe state only',()=>assert.equal(safeActionContinue('https://www.holalocal.es/verify-email?intent=business&oobCode=secret'),'/verify-email?intent=business'))
test('signed-out verification success',async()=>{const f=fixture();await f.model.start();assert.equal(f.states.at(-1).phase,'success');assert.deepEqual(f.calls,['apply'])})
test('signed-in refresh after apply',async()=>{const user={uid:'a'};const f=fixture('verifyEmail',{currentUser:()=>user});await f.model.start();assert.deepEqual(f.calls,['apply','refresh'])})
test('different account is not refreshed',async()=>{let user={uid:'a'};const d=deferred();const f=fixture('verifyEmail',{currentUser:()=>user,apply:()=>d.promise});const p=f.model.start();await Promise.resolve();user={uid:'b'};d.resolve();await p;assert(!f.calls.includes('refresh'))})
test('refresh failure preserves action success with notice',async()=>{const user={};const f=fixture('verifyEmail',{currentUser:()=>user,refresh:async()=>{throw Error()}});await f.model.start();assert(f.states.at(-1).refreshWarning);assert.equal(f.states.at(-1).phase,'success')})
for(const mode of ['verifyEmail','resetPassword','recoverEmail'])test(`${mode} invalid/expired`,async()=>{const fail=async()=>{throw {code:'auth/expired-action-code'}};const f=fixture(mode,{check:fail,verifyReset:fail});await f.model.start();assert.equal(f.states.at(-1).error,'invalid');assert(!f.calls.includes('apply'))})
test('operation mismatch never applies',async()=>{const f=fixture('recoverEmail',{check:async()=>({operation:'VERIFY_EMAIL'})});await f.model.start();assert.equal(f.states.at(-1).error,'invalid');assert.equal(f.calls.length,0)})
test('reset checks code before form',async()=>{const d=deferred();const f=fixture('resetPassword',{verifyReset:()=>d.promise});const p=f.model.start();assert.equal(f.states.at(-1).phase,'loading');d.resolve();await p;assert.equal(f.states.at(-1).phase,'form')})
test('password rules and confirmation',async()=>{const f=fixture('resetPassword');await f.model.start();await f.model.confirm('x','x');assert.equal(f.states.at(-1).error,'weak');await f.model.confirm('abcdefgh','different');assert.equal(f.states.at(-1).error,'mismatch');assert(!f.calls.includes('confirm'))})
test('reset successful; duplicate submissions suppressed',async()=>{const d=deferred();let n=0;const f=fixture('resetPassword',{confirm:()=>{n++;return d.promise}});await f.model.start();const p=f.model.confirm('abcdefgh','abcdefgh');await f.model.confirm('abcdefgh','abcdefgh');assert.equal(n,1);d.resolve();await p;assert.equal(f.states.at(-1).phase,'success');await f.model.confirm('abcdefgh','abcdefgh');assert.equal(n,1)})
test('SDK weak password leaves form usable',async()=>{const f=fixture('resetPassword',{confirm:async()=>{throw {code:'auth/weak-password'}}});await f.model.start();await f.model.confirm('abcdefgh','abcdefgh');assert.equal(f.states.at(-1).phase,'form');assert.equal(f.states.at(-1).error,'weak')})
test('recover succeeds without other account action',async()=>{const f=fixture('recoverEmail');await f.model.start();assert.equal(f.states.at(-1).phase,'success');assert.deepEqual(f.calls,['apply'])})
test('StrictMode subscription replay does not duplicate apply',async()=>{const d=deferred();const f=fixture('verifyEmail',{check:()=>d.promise});const p=f.model.start();f.stop();f.model.subscribe(s=>f.states.push(s));await f.model.start();d.resolve({operation:'VERIFY_EMAIL'});await p;assert.deepEqual(f.calls,['apply'])})
test('unmount before inspection ends suppresses apply and publication',async()=>{const d=deferred();const f=fixture('verifyEmail',{check:()=>d.promise});const p=f.model.start();f.stop();const n=f.states.length;d.resolve({operation:'VERIFY_EMAIL'});await p;assert.equal(f.states.length,n);assert.equal(f.calls.length,0)})
test('action B cannot receive late A completion',async()=>{const d=deferred();const a=fixture('verifyEmail',{apply:()=>d.promise});const p=a.model.start();await Promise.resolve();a.stop();const b=fixture('recoverEmail');await b.model.start();const n=a.states.length;d.resolve();await p;assert.equal(a.states.length,n);assert.equal(b.states.at(-1).phase,'success')})
test('confirm completion after unmount is ignored',async()=>{const d=deferred();const f=fixture('resetPassword',{confirm:()=>d.promise});await f.model.start();const p=f.model.confirm('abcdefgh','abcdefgh');f.stop();const n=f.states.length;d.resolve();await p;assert.equal(f.states.length,n)})
test('safe error categories',()=>{assert.equal(actionError({code:'auth/network-request-failed'}),'temporary');assert.equal(actionError(new Error('sensitive')),'failure')})
test('supported regional language; unsupported falls back',()=>{assert.equal(actionLocale('UK-UA'),'uk');assert.equal(actionLocale('zz'),undefined)})
test('all 17 locales have complete independent copy',()=>{assert.equal(Object.keys(emailActionTranslations).length,17);for(const [locale,copy]of Object.entries(emailActionTranslations)){assert.deepEqual(Object.keys(copy),Object.keys(emailActionTranslations.en));for(const [k,v]of Object.entries(copy)){assert(v);if(locale!=='en')assert.notEqual(v,emailActionTranslations.en[k])}}})
test('public route is outside redirecting guard; no other routes changed',()=>{const text=fs.readFileSync(new URL('../src/routes/AppRoutes.jsx',import.meta.url),'utf8');assert.match(text,/<Route element={<AuthLayout \/>}>(\s*)<Route path="auth\/action" element={<EmailActionPage \/>} \/>\s*<\/Route>\s*<Route element={<PublicRoute \/>}>/)})
test('explicit rewrite has no redirect/query substitution',()=>{const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url)));assert.deepEqual(config.rewrites.find(r=>r.source==='/auth/action'),{source:'/auth/action',destination:'/index.html'});const url=new URL('https://www.holalocal.es/auth/action'+query());assert.equal(url.searchParams.get('oobCode'),'synthetic-code')})

for (const [component, suffix] of [
  ['pathname', value => `/profile/${value}`],
  ['query', value => `/profile?ok=yes&next=${value}&last=valid`],
  ['fragment', value => `/profile#${value}`],
]) test(`continuation rejects malformed encoding in ${component}`, () => {
  for (const invalid of ['%ZZ', '%', '%A', '%E0%A4', '%FF']) {
    const continuation = `https://www.holalocal.es${suffix(invalid)}`
    assert.equal(safeActionContinue(continuation), '/login')
    // The outer action query is valid; validate its decoded continuation too.
    const outer = new URLSearchParams({ mode: 'verifyEmail', oobCode: 'synthetic-code', apiKey: 'fixture-key', continueUrl: continuation })
    assert.equal(parseEmailAction(`?${outer}`, 'fixture-key').destination, '/login')
  }
})
test('valid continuation encodings preserve existing navigation semantics', () => {
  for (const [input, expected] of [
    ['/profile', '/profile'],
    ['/profile/a%20b', '/profile/a%20b'],
    ['/profile?name=a%20b', '/profile?name=a+b'],
    ['/profile/%D0%A2%D0%B5%D1%81%D1%82', '/profile/%D0%A2%D0%B5%D1%81%D1%82'],
    ['/profile?name=%D0%A2%D0%B5%D1%81%D1%82', '/profile?name=%D0%A2%D0%B5%D1%81%D1%82'],
    ['/profile#hello%20world', '/profile#hello%20world'],
    ['/profile#%D0%A2%D0%B5%D1%81%D1%82', '/profile#%D0%A2%D0%B5%D1%81%D1%82'],
    ['/profile?next=%2Fservices%3Fx%3D1%26y%3D2', '/profile?next=%2Fservices%3Fx%3D1%26y%3D2'],
    ['/profile?literal=%25ZZ', '/profile?literal=%25ZZ'],
    ['/profile#%252F%252Fevil.example', '/profile#%252F%252Fevil.example'],
  ]) {
    const continuation = `https://www.holalocal.es${input}`
    assert.equal(safeActionContinue(continuation), expected)
    const outer = new URLSearchParams({ mode: 'verifyEmail', oobCode: 'synthetic-code', apiKey: 'fixture-key', continueUrl: continuation })
    assert.equal(parseEmailAction(`?${outer}`, 'fixture-key').destination, expected)
  }
})

// Exercise the page parser after production compression, not only source helpers.
test('production compressor preserves nested continuation validation', async () => {
  const { minifySync } = await import('rolldown/utils')
  const vm = await import('node:vm')
  const source = fs.readFileSync(new URL('../src/utils/emailActionModel.js', import.meta.url), 'utf8')
  const script = source.replace(/export /g, '') + ';globalThis.parse = parseEmailAction;'
  const context = { URL, URLSearchParams, decodeURIComponent }
  vm.runInNewContext(minifySync('emailActionModel.js', script, {}).code, context)
  const check = (continuation, expected) => {
    const outer = new URLSearchParams({ mode: 'verifyEmail', oobCode: 'synthetic-code', apiKey: 'fixture-key', continueUrl: continuation })
    assert.equal(context.parse(`?${outer}`, 'fixture-key').destination, expected)
  }
  for (const bad of ['%ZZ', '%', '%A', '%FF', '%E0%A4']) {
    for (const suffix of [`/profile/${bad}`, `/profile?ok=1&next=${bad}&last=2`, `/profile#${bad}`]) check(`https://www.holalocal.es${suffix}`, '/login')
  }
  for (const [suffix, expected] of [
    ['/profile', '/profile'], ['/profile/a%20b', '/profile/a%20b'],
    ['/profile?name=%D0%A2', '/profile?name=%D0%A2'],
    ['/profile?next=%2Fservices%3Fx%3D1', '/profile?next=%2Fservices%3Fx%3D1'],
    ['/profile#hello%20world', '/profile#hello%20world'],
    ['/profile#%D0%A2', '/profile#%D0%A2'],
    ['/profile?literal=%25ZZ', '/profile?literal=%25ZZ'],
  ]) check(`https://www.holalocal.es${suffix}`, expected)
  for (const url of ['http://www.holalocal.es/profile', 'https://holalocal.es/profile', 'https://evil.holalocal.es/profile', 'https://www.holalocal.es.evil.example/profile', 'https://www.holalocal.es@evil.example/profile', 'https://user:pass@www.holalocal.es/profile', 'https://www.holalocal.es:444/profile', '//www.holalocal.es/profile', 'javascript:alert(1)', 'data:text/plain,x', 'http://localhost:19041/profile']) check(url, '/login')
})
