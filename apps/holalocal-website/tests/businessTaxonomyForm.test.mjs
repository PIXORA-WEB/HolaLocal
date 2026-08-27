import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  beginCanonicalTaxonomyEdit,
  deriveBusinessTaxonomyForm,
  prepareBusinessTaxonomyUpdate,
  selectPrimaryService,
  toggleAdditionalService,
} from '../src/utils/businessTaxonomyForm.js'

test('canonical taxonomy loads for display without becoming dirty', () => {
  const taxonomy = deriveBusinessTaxonomyForm({
    primaryCategoryId: 'plumber', categoryIds: ['plumber', 'handyman'],
  })
  assert.equal(taxonomy.primaryServiceId, 'plumber')
  assert.deepEqual(taxonomy.additionalServiceIds, ['handyman'])
  assert.equal(taxonomy.hasLegacyValues, false)
  assert.deepEqual(prepareBusinessTaxonomyUpdate(taxonomy, false).updates, {})
})

test('an empty new-business taxonomy is editable without being labelled legacy', () => {
  const taxonomy = deriveBusinessTaxonomyForm({})
  assert.equal(taxonomy.hasLegacyValues, false)
  assert.equal(taxonomy.editing, true)
})

test('safe legacy aliases resolve for display but an unrelated save omits taxonomy', () => {
  const taxonomy = deriveBusinessTaxonomyForm({
    primaryCategoryId: 'Plumbing', categoryIds: ['Plumbing', 'Air Conditioning'],
  })
  assert.equal(taxonomy.primaryServiceId, 'plumber')
  assert.deepEqual(taxonomy.additionalServiceIds, ['air-conditioning'])
  assert.equal(taxonomy.hasLegacyValues, true)
  assert.deepEqual(prepareBusinessTaxonomyUpdate(taxonomy, false), {
    valid: true, issues: [], updates: {},
  })
})

test('ambiguous and custom legacy values stay unresolved and do not block unrelated saves', () => {
  for (const rawValue of ['Pet Services', 'Other', 'Solar panel cleaning']) {
    const taxonomy = deriveBusinessTaxonomyForm({
      primaryCategoryId: rawValue, categoryIds: [rawValue],
      customServiceDescription: rawValue,
    })
    assert.equal(taxonomy.primaryServiceId, '')
    assert.deepEqual(taxonomy.unresolvedValues, [rawValue])
    assert.equal(taxonomy.customServiceDescription, '')
    assert.equal(taxonomy.editing, false)
    assert.deepEqual(prepareBusinessTaxonomyUpdate(taxonomy, false).updates, {})
    assert.equal(prepareBusinessTaxonomyUpdate(beginCanonicalTaxonomyEdit(taxonomy), true).valid, false)
  }
})

test('mixed legacy data resolves safe aliases while preserving unresolved raw values for display', () => {
  const taxonomy = deriveBusinessTaxonomyForm({
    primaryCategoryId: 'Plumbing',
    categoryIds: ['Plumbing', 'Pet Services', 'Some custom service'],
  })
  assert.equal(taxonomy.primaryServiceId, 'plumber')
  assert.deepEqual(taxonomy.unresolvedValues, ['Pet Services', 'Some custom service'])
  assert.deepEqual(prepareBusinessTaxonomyUpdate(taxonomy, false).updates, {})
})

test('an explicit canonical edit writes IDs with the primary exactly once', () => {
  const result = prepareBusinessTaxonomyUpdate({
    primaryServiceId: 'plumber',
    additionalServiceIds: ['air-conditioning', 'handyman'],
    customServiceDescription: '',
  }, true)
  assert.equal(result.valid, true)
  assert.deepEqual(result.updates, {
    primaryCategoryId: 'plumber',
    categoryIds: ['plumber', 'air-conditioning', 'handyman'],
    customServiceDescription: null,
  })
})

test('changing primary does not retain the former primary automatically', () => {
  const changed = selectPrimaryService({
    primaryServiceId: 'plumber', groupId: 'home-property',
    additionalServiceIds: ['handyman'], customServiceDescription: '',
  }, 'electrician')
  assert.equal(changed.primaryServiceId, 'electrician')
  assert.deepEqual(changed.additionalServiceIds, ['handyman'])
  assert.equal(changed.additionalServiceIds.includes('plumber'), false)
})

test('additional selection prevents primary duplication and a seventh total service', () => {
  const base = {
    primaryServiceId: 'plumber', groupId: 'home-property',
    additionalServiceIds: ['electrician', 'cleaner', 'gardener', 'handyman'],
    customServiceDescription: '',
  }
  assert.equal(toggleAdditionalService(base, 'plumber'), base)
  const sixTotal = toggleAdditionalService(base, 'locksmith')
  assert.equal(sixTotal.additionalServiceIds.length, 5)
  assert.equal(toggleAdditionalService(sixTotal, 'removals'), sixTotal)
})

test('over-limit historical services are preserved until the owner chooses what to remove', () => {
  const taxonomy = deriveBusinessTaxonomyForm({
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
  assert.deepEqual(prepareBusinessTaxonomyUpdate(taxonomy, false).updates, {})
  assert.equal(prepareBusinessTaxonomyUpdate(taxonomy, true).valid, false)

  assert.equal(toggleAdditionalService(taxonomy, 'removals'), taxonomy)
  const sixAdditional = toggleAdditionalService(taxonomy, 'electrician')
  assert.equal(sixAdditional.additionalServiceIds.length, 6)
  assert.equal(prepareBusinessTaxonomyUpdate(sixAdditional, true).valid, false)
  const fiveAdditional = toggleAdditionalService(sixAdditional, 'cleaner')
  assert.deepEqual(fiveAdditional.additionalServiceIds, [
    'gardener', 'handyman', 'air-conditioning', 'locksmith', 'pest-control',
  ])
  assert.equal(prepareBusinessTaxonomyUpdate(fiveAdditional, true).valid, true)

  const unexpectedCanonical = deriveBusinessTaxonomyForm({
    primaryCategoryId: 'plumber',
    categoryIds: ['plumber', ...taxonomy.additionalServiceIds],
  })
  assert.equal(unexpectedCanonical.additionalServiceIds.length, 7)
  assert.deepEqual(prepareBusinessTaxonomyUpdate(unexpectedCanonical, false).updates, {})
  assert.equal(prepareBusinessTaxonomyUpdate(unexpectedCanonical, true).valid, false)
})

test('Other Local Service works as primary or additional only with a valid description', () => {
  const otherPrimary = {
    primaryServiceId: 'other-local-service', additionalServiceIds: [], customServiceDescription: '',
  }
  assert.equal(prepareBusinessTaxonomyUpdate(otherPrimary, true).valid, false)
  assert.equal(prepareBusinessTaxonomyUpdate({
    ...otherPrimary, customServiceDescription: 'Marine upholstery specialist',
  }, true).valid, true)

  const otherAdditional = {
    primaryServiceId: 'cleaner', additionalServiceIds: ['other-local-service'],
    customServiceDescription: 'Solar panel cleaning',
  }
  assert.equal(prepareBusinessTaxonomyUpdate(otherAdditional, true).valid, true)
  assert.equal(prepareBusinessTaxonomyUpdate({
    ...otherAdditional, customServiceDescription: 'x'.repeat(81),
  }, true).valid, false)
})

test('an existing canonical Other description loads unchanged without an update', () => {
  const taxonomy = deriveBusinessTaxonomyForm({
    primaryCategoryId: 'other-local-service',
    categoryIds: ['other-local-service'],
    customServiceDescription: 'Marine upholstery specialist',
  })
  assert.equal(taxonomy.customServiceDescription, 'Marine upholstery specialist')
  assert.equal(taxonomy.hasLegacyValues, false)
  assert.deepEqual(prepareBusinessTaxonomyUpdate(taxonomy, false).updates, {})
})

test('removing Other explicitly clears the stored custom description', () => {
  const result = prepareBusinessTaxonomyUpdate({
    primaryServiceId: 'cleaner', additionalServiceIds: [],
    customServiceDescription: 'Previously entered text',
  }, true)
  assert.equal(result.valid, true)
  assert.equal(result.updates.customServiceDescription, null)
})

test('the website editor consumes central taxonomy keys and supports safe field deletion', async () => {
  const [editorSource, businessServiceSource] = await Promise.all([
    readFile(new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/businessService.js', import.meta.url), 'utf8'),
  ])
  assert.match(editorSource, /SERVICE_TAXONOMY_GROUPS/)
  assert.match(editorSource, /SERVICE_TAXONOMY_SERVICES/)
  assert.match(editorSource, /t\(service\.translationKey/)
  assert.doesNotMatch(editorSource, /businessCategoryOptions/)
  assert.match(businessServiceSource, /'customServiceDescription'/)
  assert.match(businessServiceSource, /customServiceDescription === null.*deleteField\(\)/)
})
