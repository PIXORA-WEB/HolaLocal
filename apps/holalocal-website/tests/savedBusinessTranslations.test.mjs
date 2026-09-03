import assert from 'node:assert/strict'
import test from 'node:test'
import { savedBusinessTranslations } from '../src/i18n/locales/savedBusinessTranslations.js'

const locales = ['en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']
const required = ['save', 'saved', 'saving', 'remove', 'removing', 'checking', 'retry', 'loadFailed', 'saveFailed', 'removeFailed']
const pageRequired = ['navigation', 'metadataTitle', 'metadataDescription', 'eyebrow', 'title', 'description', 'loading', 'initialError', 'emptyTitle', 'emptyDescription', 'browseServices', 'openBusiness', 'removeLabel', 'itemsLabel', 'unavailable', 'unavailableDescription', 'loadMore', 'loadingMore', 'loadMoreError']

test('Saved Businesses interaction copy is complete in all 17 locales', () => {
  assert.deepEqual(Object.keys(savedBusinessTranslations).sort(), [...locales].sort())
  for (const locale of locales) {
    const values = savedBusinessTranslations[locale].savedBusinesses
    for (const key of required) assert.equal(typeof values[key] === 'string' && values[key].length > 0, true, `${locale}.${key}`)
    for (const key of ['eyebrow', 'title', 'description']) assert.equal(typeof values.authPrompt[key] === 'string' && values.authPrompt[key].length > 0, true, `${locale}.authPrompt.${key}`)
    for (const key of pageRequired) assert.equal(typeof values.page[key] === 'string' && values.page[key].length > 0, true, `${locale}.page.${key}`)
  }
})
