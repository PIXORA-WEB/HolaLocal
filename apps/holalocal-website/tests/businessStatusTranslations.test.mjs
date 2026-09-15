// Node 20 adapter for the JSON imports handled by Vite in production.
// No translation composition is reproduced here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'
import { supportedUILanguages } from '../src/utils/languages.js'
register('data:text/javascript,' + encodeURIComponent(`
  import { readFile } from 'node:fs/promises'
  export async function load(url, context, nextLoad) {
    if (url.endsWith('.json')) return {
      format: 'module', shortCircuit: true,
      source: 'export default ' + await readFile(new URL(url), 'utf8'),
    }
    return nextLoad(url, context)
  }
`))
const { default: i18n, loadLocale } = await import('../src/i18n/index.js')
const key = 'business.control.statusExplanation'
const english = JSON.parse(await readFile(new URL('../src/i18n/locales/en.json', import.meta.url))).business.control.statusExplanation
const placeholders = value => [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map(m => m[1]).sort()
for (const { code } of supportedUILanguages) {
  test(`${code}: business-status guidance survives production locale composition`, async () => {
    await loadLocale(code)
    await i18n.changeLanguage(code)
    const value = i18n.t(key)
    assert.equal(typeof value, 'string')
    assert.ok(value.trim())
    assert.deepEqual(placeholders(value), placeholders(english))
    if (code === 'en') assert.equal(value, english)
    else {
      assert.equal(value, authenticatedTranslations[code].business.control.statusExplanation)
      // This specific explanatory paragraph requires localization; this is not
      // a general ban on shared brand names or identical translated strings.
      assert.notEqual(value, english)
    }
    await loadLocale('en'); await i18n.changeLanguage('en')
    await loadLocale(code); await i18n.changeLanguage(code)
    assert.equal(i18n.t(key), value, 'switching back must not change ownership')
  })
}
