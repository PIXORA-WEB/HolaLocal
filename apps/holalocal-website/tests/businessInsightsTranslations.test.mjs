// Use production initialization/loadLocale; adapt only Vite JSON imports for Node.
import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'
import { supportedUILanguages } from '../src/utils/languages.js'
register('data:text/javascript,' + encodeURIComponent(`
  import { readFile } from 'node:fs/promises'
  export async function load(url, context, nextLoad) {
    if (url.endsWith('.json')) return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')}
    return nextLoad(url, context)
  }
`))
const { default: i18n, loadLocale } = await import('../src/i18n/index.js')
const keys = [
  'title', 'allTimeTitle', 'activityTitle',
  ...['label','from','to','apply'].map(k => `range.${k}`),
  ...['last_7_days','last_30_days','this_month','last_month','last_90_days','custom'].map(k => `range.presets.${k}`),
  ...['required','invalid','order','future','tooLong'].map(k => `range.errors.${k}`),
  ...['loading','loadingRange','error','notStarted','collectingSince','unpublished','inactive'].map(k => `state.${k}`),
]
const placeholders = value => [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map(m => m[1]).sort()
const get = (object, key) => key.split('.').reduce((value, part) => value?.[part], object)
const english = (await import('../src/i18n/locales/en.json')).default.businessInsights
// Sequential cases explicitly reset the shared singleton before exercising each locale.
for (const { code } of supportedUILanguages) {
  test(`${code}: active insights wording survives composition and switching`, async () => {
    const extension = ['en','es','fr','de','nl','pt'].includes(code) ? 'json' : 'js'
    const own = (await import(`../src/i18n/locales/${code}.${extension}`)).default.businessInsights
    await loadLocale('en'); await i18n.changeLanguage('en')
    await loadLocale(code); await i18n.changeLanguage(code)
    const values = {}
    for (const suffix of keys) {
      const key = `businessInsights.${suffix}`
      const value = i18n.getResource(code, 'translation', key)
      assert.equal(typeof value, 'string', key); assert.ok(value.trim(), key)
      assert.equal(value, get(own, suffix), `${key}: base-locale ownership`)
      assert.deepEqual(placeholders(value), placeholders(get(english, suffix)), key)
      // Only these active prose keys require localization, not all translated strings.
      if (code !== 'en') assert.notEqual(value, get(english, suffix), `${code}.${key}: English fallback`)
      else assert.equal(value, get(english, suffix))
      const rendered = i18n.t(key, { date: 'DATE-SENTINEL' })
      assert.ok(!rendered.includes('{{'), key)
      if (suffix === 'state.collectingSince') assert.ok(rendered.includes('DATE-SENTINEL'))
      values[key] = rendered
    }
    await loadLocale('en'); await i18n.changeLanguage('en')
    await loadLocale(code); await i18n.changeLanguage(code)
    for (const [key,value] of Object.entries(values)) assert.equal(i18n.t(key,{date:'DATE-SENTINEL'}),value)
  })
}
