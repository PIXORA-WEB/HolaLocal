import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildCanonicalBusinessUpdate } from '../src/services/businessPayloads.js'
import {
  beginMobileTaxonomyEdit,
  deriveMobileBusinessTaxonomy,
  selectMobilePrimaryService,
  toggleMobileAdditionalService,
} from '../src/services/businessTaxonomyForm.js'

const editableForm = {
  name: 'Local business', tagline: '', description: 'Description',
  serviceAreas: ['marbella'], serviceRadiusKm: 20,
  location: { locality: 'Marbella', region: 'Málaga', countryCode: 'ES' },
  languages: ['en'], primaryLanguage: 'en',
}

test('canonical and safe legacy taxonomy load for display without creating a write', () => {
  const canonical = deriveMobileBusinessTaxonomy({
    primaryCategoryId: 'plumber', categoryIds: ['plumber', 'handyman'],
  })
  assert.equal(canonical.primaryServiceId, 'plumber')
  assert.deepEqual(canonical.additionalServiceIds, ['handyman'])
  assert.equal(canonical.hasLegacyValues, false)

  const legacy = deriveMobileBusinessTaxonomy({
    primaryCategoryId: 'Plumbing', categoryIds: ['Plumbing', 'Air Conditioning'],
  })
  assert.equal(legacy.primaryServiceId, 'plumber')
  assert.deepEqual(legacy.additionalServiceIds, ['air-conditioning'])
  assert.equal(legacy.hasLegacyValues, true)

  const built = buildCanonicalBusinessUpdate(
    { ...editableForm, description: 'Changed description' },
    { taxonomy: legacy, taxonomyDirty: false },
  )
  assert.equal(built.valid, true)
  for (const field of ['primaryCategoryId', 'categoryIds', 'customServiceDescription']) {
    assert.equal(Object.hasOwn(built.payload, field), false, field)
  }
})

test('ambiguous and custom legacy values remain unresolved and unrelated saves remain possible', () => {
  for (const rawValue of ['Pet Services', 'Other', 'Solar panel cleaning']) {
    const taxonomy = deriveMobileBusinessTaxonomy({
      primaryCategoryId: rawValue, categoryIds: [rawValue],
      customServiceDescription: rawValue,
    })
    assert.equal(taxonomy.primaryServiceId, '')
    assert.deepEqual(taxonomy.unresolvedValues, [rawValue])
    assert.equal(taxonomy.customServiceDescription, '')
    assert.equal(taxonomy.editing, false)
    assert.equal(buildCanonicalBusinessUpdate(editableForm, {
      taxonomy, taxonomyDirty: false,
    }).valid, true)
    assert.equal(buildCanonicalBusinessUpdate(editableForm, {
      taxonomy: beginMobileTaxonomyEdit(taxonomy), taxonomyDirty: true,
    }).valid, false)
  }
})

test('explicit canonical edits write IDs only and clear an obsolete custom description', () => {
  const built = buildCanonicalBusinessUpdate(editableForm, {
    taxonomyDirty: true,
    taxonomy: {
      primaryServiceId: 'plumber',
      additionalServiceIds: ['air-conditioning', 'handyman'],
      customServiceDescription: 'Old custom text',
    },
  })
  assert.equal(built.valid, true)
  assert.deepEqual({
    primaryCategoryId: built.payload.primaryCategoryId,
    categoryIds: built.payload.categoryIds,
    customServiceDescription: built.payload.customServiceDescription,
  }, {
    primaryCategoryId: 'plumber',
    categoryIds: ['plumber', 'air-conditioning', 'handyman'],
    customServiceDescription: null,
  })
  assert.equal(built.payload.categoryIds.includes('Home & Property'), false)
  assert.equal(built.payload.categoryIds.includes('Plumber'), false)
})

test('changing primary drops the former primary and additional selection enforces six total', () => {
  const changed = selectMobilePrimaryService({
    groupId: 'home-property', primaryServiceId: 'plumber',
    additionalServiceIds: ['handyman'], customServiceDescription: '',
  }, 'electrician')
  assert.equal(changed.primaryServiceId, 'electrician')
  assert.deepEqual(changed.additionalServiceIds, ['handyman'])
  assert.equal(changed.additionalServiceIds.includes('plumber'), false)
  assert.equal(toggleMobileAdditionalService(changed, 'electrician'), changed)

  const fiveAdditional = {
    ...changed,
    additionalServiceIds: ['plumber', 'cleaner', 'gardener', 'handyman', 'locksmith'],
  }
  assert.equal(toggleMobileAdditionalService(fiveAdditional, 'removals'), fiveAdditional)
})

test('mobile preserves over-limit historical services until the owner reduces them', () => {
  const taxonomy = deriveMobileBusinessTaxonomy({
    primaryCategoryId: 'Plumbing',
    categoryIds: [
      'Plumbing', 'Electrical', 'Cleaning', 'Gardening', 'Handyman',
      'Air Conditioning', 'Locksmith', 'Pest Control',
    ],
  })
  assert.deepEqual(taxonomy.additionalServiceIds, [
    'electrician', 'cleaner', 'gardener', 'handyman',
    'air-conditioning', 'locksmith', 'pest-control',
  ])

  const unrelated = buildCanonicalBusinessUpdate(editableForm, {
    taxonomy, taxonomyDirty: false,
  })
  for (const field of ['primaryCategoryId', 'categoryIds', 'customServiceDescription']) {
    assert.equal(Object.hasOwn(unrelated.payload, field), false, field)
  }
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy, taxonomyDirty: true,
  }).valid, false)

  assert.equal(toggleMobileAdditionalService(taxonomy, 'removals'), taxonomy)
  const sixAdditional = toggleMobileAdditionalService(taxonomy, 'electrician')
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy: sixAdditional, taxonomyDirty: true,
  }).valid, false)
  const fiveAdditional = toggleMobileAdditionalService(sixAdditional, 'cleaner')
  assert.deepEqual(fiveAdditional.additionalServiceIds, [
    'gardener', 'handyman', 'air-conditioning', 'locksmith', 'pest-control',
  ])
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy: fiveAdditional, taxonomyDirty: true,
  }).valid, true)

  const unexpectedCanonical = deriveMobileBusinessTaxonomy({
    primaryCategoryId: 'plumber',
    categoryIds: ['plumber', ...taxonomy.additionalServiceIds],
  })
  assert.equal(unexpectedCanonical.additionalServiceIds.length, 7)
  const canonicalUnrelated = buildCanonicalBusinessUpdate(editableForm, {
    taxonomy: unexpectedCanonical, taxonomyDirty: false,
  })
  assert.equal(Object.hasOwn(canonicalUnrelated.payload, 'categoryIds'), false)
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy: unexpectedCanonical, taxonomyDirty: true,
  }).valid, false)
})

test('Other requires a trimmed description of at most 80 characters', () => {
  const otherPrimary = {
    primaryServiceId: 'other-local-service', additionalServiceIds: [], customServiceDescription: '',
  }
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy: otherPrimary, taxonomyDirty: true,
  }).valid, false)
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy: { ...otherPrimary, customServiceDescription: 'Marine upholstery specialist' },
    taxonomyDirty: true,
  }).valid, true)

  const otherAdditional = {
    primaryServiceId: 'cleaner', additionalServiceIds: ['other-local-service'],
    customServiceDescription: 'Solar panel cleaning',
  }
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy: otherAdditional, taxonomyDirty: true,
  }).valid, true)
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy: { ...otherAdditional, customServiceDescription: 'x'.repeat(81) },
    taxonomyDirty: true,
  }).valid, false)
})

test('empty first-time taxonomy cannot bypass canonical validation', () => {
  const taxonomy = deriveMobileBusinessTaxonomy({})
  assert.equal(taxonomy.hasLegacyValues, false)
  assert.equal(buildCanonicalBusinessUpdate(editableForm, {
    taxonomy, taxonomyDirty: false, requireTaxonomy: true,
  }).valid, false)
})

test('existing canonical Other loads without dirtying or rewriting its description', () => {
  const taxonomy = deriveMobileBusinessTaxonomy({
    primaryCategoryId: 'other-local-service', categoryIds: ['other-local-service'],
    customServiceDescription: 'Marine upholstery specialist',
  })
  assert.equal(taxonomy.customServiceDescription, 'Marine upholstery specialist')
  const built = buildCanonicalBusinessUpdate(editableForm, { taxonomy, taxonomyDirty: false })
  assert.equal(Object.hasOwn(built.payload, 'customServiceDescription'), false)
})

test('mobile editor and write boundary consume central taxonomy without copied catalogues', async () => {
  const [editor, helper, service] = await Promise.all([
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/businessTaxonomyForm.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
  ])
  assert.match(editor, /SERVICE_TAXONOMY_GROUPS/)
  assert.match(editor, /getServiceIdsForGroup/)
  assert.match(editor, /t\(service\.translationKey/)
  assert.doesNotMatch(editor, /CANONICAL_BUSINESS_CATEGORIES|BUSINESS_CATEGORY_KEYS/)
  assert.match(helper, /resolveServiceValue/)
  assert.doesNotMatch(helper, /\[\s*['"]plumber['"]/)
  assert.match(service, /buildCanonicalBusinessUpdate\(form, taxonomyOptions\)/)
  assert.match(service, /customServiceDescription === null.*deleteField\(\)/)
})
