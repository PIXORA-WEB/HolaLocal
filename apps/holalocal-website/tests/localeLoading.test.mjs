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
   if (fail && specifier.endsWith('/completion-pl.js')) { fail=false; throw new Error('synthetic locale import failure') }
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
test('runtime does not import the tooling completion aggregator',async()=>{
 const source=await readFile(new URL('../src/i18n/index.js',import.meta.url),'utf8')
 assert.doesNotMatch(source,/import\(['"]\.\/locales\/fallbackLocaleCompletionTranslations\.js/)
 assert.match(source,/loadLocaleCompletion\(code\)/)
})
