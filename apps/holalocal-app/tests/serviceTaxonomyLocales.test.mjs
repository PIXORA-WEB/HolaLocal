import test from 'node:test'
import assert from 'node:assert/strict'
import i18next from 'i18next'
import {
  SERVICE_TAXONOMY_GROUPS, SERVICE_TAXONOMY_SERVICES,
} from '../../../shared/firebase-contract/index.js'
import { serviceTaxonomyTranslations } from '../src/i18n/serviceTaxonomyTranslations.js'
import { businessTaxonomyEditorTranslations } from '../src/i18n/businessTaxonomyEditorTranslations.js'
import { supportedUILanguages } from '../src/utils/languages.js'

function getPath(resource, path) {
  return path.split('.').reduce((current, part) => current?.[part], resource)
}

test('all mobile locales contain every centrally defined service taxonomy translation', async () => {
  assert.equal(SERVICE_TAXONOMY_GROUPS.length, 6)
  assert.equal(SERVICE_TAXONOMY_SERVICES.length, 35)
  assert.deepEqual(supportedUILanguages.map(({ code }) => code), ['en', 'es', 'fr', 'de', 'nl', 'pt'])

  const definitions = [...SERVICE_TAXONOMY_GROUPS, ...SERVICE_TAXONOMY_SERVICES]
  const runtime = i18next.createInstance()
  await runtime.init({
    resources: Object.fromEntries(Object.entries(serviceTaxonomyTranslations)
      .map(([code, translation]) => [code, { translation }])),
    lng: 'en', fallbackLng: 'en', initImmediate: false, returnNull: false,
  })
  for (const { code } of supportedUILanguages) {
    const resource = serviceTaxonomyTranslations[code]
    assert.ok(resource, `${code} taxonomy resource is missing`)
    assert.equal(Object.keys(resource.services.taxonomy.groups).length, 6)
    assert.equal(Object.keys(resource.services.taxonomy.services).length, 35)
    for (const { translationKey } of definitions) {
      const value = getPath(resource, translationKey)
      assert.equal(typeof value, 'string', `${code}: ${translationKey} is missing`)
      assert.ok(value.trim(), `${code}: ${translationKey} is empty`)
      assert.equal(runtime.t(translationKey, { lng: code }), value)
    }
    const editor = businessTaxonomyEditorTranslations[code]?.business?.taxonomyEditor
    assert.ok(editor, `${code} taxonomy editor resource is missing`)
    assert.deepEqual(Object.keys(editor).sort(), Object.keys(
      businessTaxonomyEditorTranslations.en.business.taxonomyEditor,
    ).sort())
    for (const [key, value] of Object.entries(editor)) {
      assert.equal(typeof value, 'string', `${code}: business.taxonomyEditor.${key} is missing`)
      assert.ok(value.trim(), `${code}: business.taxonomyEditor.${key} is empty`)
    }
  }
})
