import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  ownerRejectionTranslations,
} from '../src/i18n/adminTranslations.js'

const locales = ['en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']
const ownerMessageKeys = ['eyebrow', 'title', 'category', 'nextStep', 'edit']

test('owner-facing rejection messages are complete and localized for all 17 locales', () => {
  for (const locale of locales) {
    const owner = ownerRejectionTranslations[locale]?.rejection?.owner
    assert.deepEqual(Object.keys(owner ?? {}).sort(), [...ownerMessageKeys].sort(), locale)
    for (const key of ownerMessageKeys) assert.ok(owner[key]?.trim(), `${locale}.${key}`)
    if (locale !== 'en') {
      assert.notDeepEqual(owner, ownerRejectionTranslations.en.rejection.owner, locale)
    }
  }
})

test('all admin page modules are route-level lazy imports', async () => {
  const source = await readFile(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8')
  for (const page of ['AdminOverviewPage', 'AdminBusinessesPage', 'AdminBusinessReviewPage']) {
    assert.ok(source.includes(`const ${page} = lazy(() => import('../pages/admin/${page}.jsx'))`), page)
    assert.doesNotMatch(source, new RegExp(`import ${page} from`))
  }
})
