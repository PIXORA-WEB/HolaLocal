import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'
import { readFile } from 'node:fs/promises'
// Fail resolution once, before module evaluation. This models a retryable import
// failure; it is not a claim that every browser caches failed imports identically.
register('data:text/javascript,' + encodeURIComponent(`
 import { readFile } from 'node:fs/promises'
 let fail = true
 export async function resolve(specifier, context, next) {
   if (fail && specifier.endsWith('/authenticated-pl.js')) { fail=false; throw new Error('synthetic locale import failure') }
   return next(specifier, context)
 }
 export async function load(url, context, next) {
   if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')}
   return next(url,context)
 }
`))
const { default:i18n, loadLocale, i18nReady } = await import('../src/i18n/index.js')
test('English startup, concurrent failure settlement, retry and switching retain ownership', async () => {
 await i18nReady
 assert.equal(i18n.resolvedLanguage,'en')
 const outcomes=await Promise.allSettled([loadLocale('pl'),loadLocale('pl')])
 assert.ok(outcomes.every(r=>r.status==='rejected' && /synthetic locale import failure/.test(r.reason.message)))
 assert.equal(i18n.hasResourceBundle('pl','translation'),false)
 await Promise.all([loadLocale('pl'),loadLocale('pl'),loadLocale('de'),loadLocale('uk')])
 const before=structuredClone(i18n.getResourceBundle('pl','translation'))
 await i18n.changeLanguage('pl'); assert.equal(i18n.t('businessInsights.title'),'Statystyki firmy')
 await i18n.changeLanguage('en'); await loadLocale('pl'); await i18n.changeLanguage('pl')
 assert.deepEqual(i18n.getResourceBundle('pl','translation'),before)
 assert.equal(await loadLocale('unsupported-synthetic'),'en')
})
test('runtime does not import the tooling authenticated or detail aggregators',async()=>{
 const source=await readFile(new URL('../src/i18n/index.js',import.meta.url),'utf8')
 assert.doesNotMatch(source,/import\(['"]\.\/locales\/authenticatedTranslations\.js/)
 assert.match(source,/authenticatedLoaders\[code\]\(\)/)
})

test('authenticated slices have independent objects and tooling retains all languages', async () => {
 const { authenticatedTranslations: all } = await import('../src/i18n/locales/authenticatedTranslations.js')
 assert.equal(Object.keys(all).length, 17)
 assert.notEqual(all.pl.business.form, all.uk.business.form)
 assert.notEqual(all.pl.publicBusinessDetail, all.uk.publicBusinessDetail)
 for (const code of Object.keys(all)) {
  const { default: slice } = await import(`../src/i18n/locales/authenticated/authenticated-${code}.js`)
  assert.equal(slice, all[code])
  const source = await readFile(new URL(`../src/i18n/locales/authenticated/authenticated-${code}.js`, import.meta.url), 'utf8')
  assert.doesNotMatch(source, /authenticatedTranslations\.js|publicBusinessDetailTranslations\.js/)
 }
})

test('each selected authenticated slice has only its own language in its static source dependencies', async () => {
 const { supportedUILanguages } = await import('../src/utils/languages.js')
 const runtime = await readFile(new URL('../src/i18n/index.js', import.meta.url), 'utf8')
 for (const { code } of supportedUILanguages) {
  assert.ok(runtime.includes(`import('./locales/authenticated/authenticated-${code}.js')`))
  const visited = new Set()
  async function visit(url) {
   if (visited.has(url.href)) return
   visited.add(url.href)
   const source = await readFile(url, 'utf8')
   for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) await visit(new URL(match[1], url))
  }
  await visit(new URL(`../src/i18n/locales/authenticated/authenticated-${code}.js`, import.meta.url))
  const files = [...visited].map(url => new URL(url).pathname.split('/').pop())
  assert.deepEqual(files.filter(name => /^authenticated-/.test(name)), [`authenticated-${code}.js`])
  assert.deepEqual(files.filter(name => /^detail-/.test(name)), [`detail-${code}.js`])
  assert.ok(!files.includes('authenticatedTranslations.js'))
  assert.ok(!files.includes('publicBusinessDetailTranslations.js'))
 }
})
