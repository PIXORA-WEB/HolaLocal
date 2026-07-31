import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  adminEnglishTranslations,
  ownerEnglishRejectionTranslations,
} from '../src/i18n/defaultTranslations.js'
import {
  adminEnglishTranslations as legacyAdminEnglishTranslations,
  ownerRejectionTranslations,
} from '../src/i18n/adminTranslations.js'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'

const i18nSourceUrl = new URL('../src/i18n/index.js', import.meta.url)

test('the initial i18n module eagerly includes only default-locale resources', async () => {
  const source = await readFile(i18nSourceUrl, 'utf8')

  for (const aggregateModule of [
    'adminTranslations.js',
    'authenticatedTranslations.js',
    'fallbackLocaleCompletionTranslations.js',
    'legalContent.js',
    'universalOperationalTranslations.js',
  ]) {
    assert.match(source, new RegExp(`import\\(['"].*${aggregateModule.replace('.', '\\.')}['"]\\)`))
    assert.doesNotMatch(source, new RegExp(`^import .*${aggregateModule.replace('.', '\\.')}`, 'm'))
  }
})

test('locale loading is cached and language changes use last-selection-wins sequencing', async () => {
  const source = await readFile(i18nSourceUrl, 'utf8')

  assert.match(source, /const localeLoadPromises = new Map\(\)/)
  assert.match(source, /if \(localeLoadPromises\.has\(code\)\) return localeLoadPromises\.get\(code\)/)
  assert.match(source, /localeLoadPromises\.delete\(code\)/)
  assert.match(source, /const requestSequence = \+\+languageChangeSequence/)
  assert.match(source, /requestSequence !== languageChangeSequence/)
})

test('the synchronous English fallback matches the complete translation source', () => {
  assert.deepEqual(adminEnglishTranslations, legacyAdminEnglishTranslations)
  assert.deepEqual(ownerEnglishRejectionTranslations, ownerRejectionTranslations.en)
})

test('authenticated lifecycle statuses map independently in every locale', () => {
  const expectedLocales = [
    'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs',
    'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no',
  ]
  const expectedRejectedStatuses = {
    en: 'Rejected',
    es: 'Rechazado',
    fr: 'Rejeté',
    de: 'Abgelehnt',
    nl: 'Afgewezen',
    pt: 'Rejeitado',
    pl: 'Odrzucony',
    ro: 'Respins',
    cs: 'Zamítnuto',
    sk: 'Zamietnutý',
    hu: 'Elutasítva',
    uk: 'Відхилено',
    it: 'Rifiutato',
    sv: 'Avvisad',
    da: 'Afvist',
    fi: 'Hylätty',
    no: 'Avvist',
  }
  const expectedEnglishStatuses = {
    draft: 'Draft',
    pending_review: 'Pending review',
    rejected: 'Rejected',
    active: 'Active',
    suspended: 'Suspended',
    archived: 'Archived',
    deleted: 'Deleted',
  }

  assert.deepEqual(
    Object.keys(authenticatedTranslations).sort(),
    [...expectedLocales].sort(),
  )
  assert.deepEqual(
    authenticatedTranslations.en.business.control.status,
    expectedEnglishStatuses,
  )

  for (const locale of expectedLocales) {
    const statuses = authenticatedTranslations[locale].business.control.status
    assert.deepEqual(Object.keys(statuses), Object.keys(expectedEnglishStatuses))
    for (const [status, label] of Object.entries(statuses)) {
      assert.equal(typeof label, 'string', `${locale}.${status} must be a string`)
      assert.notEqual(label.trim(), '', `${locale}.${status} must not be empty`)
    }
    assert.equal(statuses.rejected, expectedRejectedStatuses[locale])
  }

  assert.equal(authenticatedTranslations.es.business.control.status.rejected, 'Rechazado')
  assert.notEqual(
    authenticatedTranslations.es.business.control.status.rejected,
    authenticatedTranslations.es.business.control.status.active,
  )
  assert.notEqual(
    authenticatedTranslations.es.business.control.status.rejected,
    authenticatedTranslations.en.business.control.status.rejected,
  )
  assert.equal(authenticatedTranslations.fr.business.control.status.rejected, 'Rejeté')
})

test('legacy lifecycle indexes remain aligned around the independent rejected key', async () => {
  const source = await readFile(
    new URL('../src/i18n/locales/authenticatedTranslations.js', import.meta.url),
    'utf8',
  )

  assert.match(source, /draft: d\.statuses\[0\]/)
  assert.match(source, /pending_review: d\.statuses\[1\]/)
  assert.match(source, /rejected: d\.rejectedStatus/)
  assert.match(source, /active: d\.statuses\[2\]/)
  assert.match(source, /suspended: d\.statuses\[3\]/)
  assert.match(source, /archived: d\.statuses\[4\]/)
  assert.match(source, /deleted: d\.statuses\[5\]/)
})

test('owner-facing rejection translations remain unchanged', () => {
  assert.deepEqual(ownerEnglishRejectionTranslations, ownerRejectionTranslations.en)
  assert.equal(
    ownerRejectionTranslations.es.rejection.owner.title,
    'Tu negocio necesita cambios',
  )
  assert.equal(
    ownerRejectionTranslations.es.rejection.reason.unclear_service_information,
    'Información de servicios poco clara',
  )
})
