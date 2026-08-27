import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getServiceGroupId,
  getServiceIdsForGroup,
  isCanonicalServiceId,
  LEGACY_SERVICE_ALIAS_CONFIDENCES,
  LEGACY_SERVICE_VALUES,
  MAX_BUSINESS_SERVICE_SELECTIONS,
  MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH,
  projectBusinessTaxonomy,
  resolveServiceValue,
  SERVICE_TAXONOMY_GROUP_IDS,
  SERVICE_TAXONOMY_GROUPS,
  SERVICE_TAXONOMY_SERVICE_IDS,
  SERVICE_TAXONOMY_SERVICES,
  SERVICE_VALUE_RESOLUTIONS,
  serviceSupportsCustomDescription,
  validateCanonicalBusinessTaxonomy,
} from '../index.js'

const expectedLegacyMappings = Object.freeze({
  Cleaning: ['cleaner', 'exact'],
  Plumbing: ['plumber', 'exact'],
  Electrical: ['electrician', 'reasonable'],
  Gardening: ['gardener', 'exact'],
  'Painting & Decorating': ['painter-decorator', 'exact'],
  'Building & Renovation': ['builder-renovation', 'reasonable'],
  Handyman: ['handyman', 'exact'],
  'Air Conditioning': ['air-conditioning', 'exact'],
  Locksmith: ['locksmith', 'exact'],
  'Pest Control': ['pest-control', 'exact'],
  'Pool Maintenance': ['pool-services', 'reasonable'],
})

test('taxonomy contains exactly the agreed unique groups and services', () => {
  assert.deepEqual(SERVICE_TAXONOMY_GROUP_IDS, [
    'home-property',
    'professional-services',
    'health-beauty-lifestyle',
    'learning-family',
    'pets',
    'other-local-services',
  ])
  assert.equal(SERVICE_TAXONOMY_GROUPS.length, 6)
  assert.equal(new Set(SERVICE_TAXONOMY_GROUP_IDS).size, 6)
  assert.equal(SERVICE_TAXONOMY_SERVICES.length, 35)
  assert.equal(SERVICE_TAXONOMY_SERVICE_IDS.length, 35)
  assert.equal(new Set(SERVICE_TAXONOMY_SERVICE_IDS).size, 35)
})

test('every service has complete metadata and belongs to exactly one valid non-empty group', () => {
  const validGroupIds = new Set(SERVICE_TAXONOMY_GROUP_IDS)
  const groupedIds = SERVICE_TAXONOMY_GROUP_IDS.flatMap(getServiceIdsForGroup)

  for (const definition of SERVICE_TAXONOMY_SERVICES) {
    assert.match(definition.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.equal(validGroupIds.has(definition.groupId), true, definition.id)
    assert.match(definition.translationKey, /^services\.taxonomy\.services\.[A-Za-z0-9]+$/)
    assert.equal(typeof definition.defaultLabel, 'string')
    assert.notEqual(definition.defaultLabel.trim(), '')
    assert.equal(groupedIds.filter((id) => id === definition.id).length, 1, definition.id)
  }

  for (const definition of SERVICE_TAXONOMY_GROUPS) {
    assert.match(definition.translationKey, /^services\.taxonomy\.groups\.[A-Za-z0-9]+$/)
    assert.notEqual(definition.defaultLabel.trim(), '')
    assert.ok(getServiceIdsForGroup(definition.id).length > 0, definition.id)
  }
  assert.deepEqual([...groupedIds].sort(), [...SERVICE_TAXONOMY_SERVICE_IDS].sort())
})

test('canonical recognition does not confuse legacy labels with service IDs', () => {
  assert.equal(isCanonicalServiceId('plumber'), true)
  assert.equal(isCanonicalServiceId('Plumbing'), false)
  assert.equal(isCanonicalServiceId(' plumber '), false)
  assert.equal(isCanonicalServiceId(null), false)
  assert.deepEqual(resolveServiceValue('plumber'), {
    rawValue: 'plumber', serviceId: 'plumber', resolution: 'canonical', confidence: null,
    compatibleGroupId: null,
  })
  assert.deepEqual(resolveServiceValue(' plumber '), {
    rawValue: ' plumber ', serviceId: null, resolution: 'custom-legacy', confidence: null,
    compatibleGroupId: null,
  })
})

test('every approved legacy mapping resolves with its declared confidence', () => {
  const mappedDefinitions = LEGACY_SERVICE_VALUES.filter(({ serviceId }) => serviceId)
  assert.equal(mappedDefinitions.length, Object.keys(expectedLegacyMappings).length)

  for (const [rawValue, [serviceId, confidence]] of Object.entries(expectedLegacyMappings)) {
    assert.deepEqual(resolveServiceValue(rawValue), {
      rawValue,
      serviceId,
      resolution: SERVICE_VALUE_RESOLUTIONS.RECOGNIZED_LEGACY,
      confidence,
      compatibleGroupId: null,
    })
  }
  assert.equal(
    resolveServiceValue('Electrical').confidence,
    LEGACY_SERVICE_ALIAS_CONFIDENCES.REASONABLE,
  )
})

test('Pet Services remains ambiguous with broad Pets-group compatibility only', () => {
  assert.deepEqual(resolveServiceValue('Pet Services'), {
    rawValue: 'Pet Services',
    serviceId: null,
    resolution: SERVICE_VALUE_RESOLUTIONS.AMBIGUOUS_LEGACY,
    confidence: null,
    compatibleGroupId: 'pets',
  })
  assert.equal(getServiceIdsForGroup('pets').includes(resolveServiceValue('Pet Services').serviceId), false)
})

test('Other remains ambiguous without group compatibility', () => {
  assert.deepEqual(resolveServiceValue('Other'), {
    rawValue: 'Other',
    serviceId: null,
    resolution: SERVICE_VALUE_RESOLUTIONS.AMBIGUOUS_LEGACY,
    confidence: null,
    compatibleGroupId: null,
  })
})

test('unknown custom legacy text is preserved while invalid structures fail classification', () => {
  assert.deepEqual(resolveServiceValue('Solar panel cleaning'), {
    rawValue: 'Solar panel cleaning',
    serviceId: null,
    resolution: SERVICE_VALUE_RESOLUTIONS.CUSTOM_LEGACY,
    confidence: null,
    compatibleGroupId: null,
  })
  for (const rawValue of ['', '   ', null, 42, {}]) {
    const result = resolveServiceValue(rawValue)
    assert.equal(result.rawValue, rawValue)
    assert.equal(result.serviceId, null)
    assert.equal(result.resolution, SERVICE_VALUE_RESOLUTIONS.INVALID)
    assert.equal(result.compatibleGroupId, null)
  }
})

test('business taxonomy projection resolves only safe canonical services without mutating input', () => {
  const mixed = {
    primaryCategoryId: 'Plumbing',
    categoryIds: ['Plumbing', 'Pet Services', 'Solar panel cleaning', 'Air Conditioning'],
  }
  const original = structuredClone(mixed)

  assert.deepEqual(projectBusinessTaxonomy(mixed), {
    primaryServiceId: 'plumber',
    serviceIds: ['plumber', 'air-conditioning'],
  })
  assert.deepEqual(mixed, original)
})

test('business taxonomy projection rejects ambiguous, custom and malformed values defensively', () => {
  for (const primaryCategoryId of ['Pet Services', 'Other', 'Solar panel cleaning', '', '   ', null, 42]) {
    assert.deepEqual(projectBusinessTaxonomy({ primaryCategoryId, categoryIds: [primaryCategoryId] }), {
      primaryServiceId: null,
      serviceIds: [],
    })
  }
  assert.deepEqual(projectBusinessTaxonomy(), { primaryServiceId: null, serviceIds: [] })
  assert.deepEqual(projectBusinessTaxonomy({ primaryCategoryId: 'Plumbing', categoryIds: 'not-an-array' }), {
    primaryServiceId: 'plumber',
    serviceIds: ['plumber'],
  })
  assert.deepEqual(projectBusinessTaxonomy({
    primaryCategoryId: null,
    categoryIds: [null, 7, '', 'Handyman'],
  }), {
    primaryServiceId: null,
    serviceIds: ['handyman'],
  })
})

test('business taxonomy projection includes the primary once and deduplicates resolved aliases', () => {
  assert.deepEqual(projectBusinessTaxonomy({
    primaryCategoryId: 'Plumbing',
    categoryIds: ['Air Conditioning'],
  }), {
    primaryServiceId: 'plumber',
    serviceIds: ['plumber', 'air-conditioning'],
  })
  assert.deepEqual(projectBusinessTaxonomy({
    primaryCategoryId: 'Plumbing',
    categoryIds: ['Plumbing', 'plumber', 'Plumbing'],
  }), {
    primaryServiceId: 'plumber',
    serviceIds: ['plumber'],
  })
})

test('business taxonomy projection preserves more than six safely resolved historical services', () => {
  const categoryIds = [
    'Plumbing',
    'Electrical',
    'Cleaning',
    'Gardening',
    'Handyman',
    'Air Conditioning',
    'Locksmith',
    'Pest Control',
  ]

  assert.deepEqual(projectBusinessTaxonomy({
    primaryCategoryId: 'Plumbing',
    categoryIds,
  }), {
    primaryServiceId: 'plumber',
    serviceIds: [
      'plumber',
      'electrician',
      'cleaner',
      'gardener',
      'handyman',
      'air-conditioning',
      'locksmith',
      'pest-control',
    ],
  })
  assert.equal(categoryIds.length, 8)
  assert.equal(MAX_BUSINESS_SERVICE_SELECTIONS, 6)
})

test('service and group lookups derive the agreed relationships', () => {
  assert.equal(getServiceGroupId('plumber'), 'home-property')
  assert.equal(getServiceGroupId('accountant'), 'professional-services')
  assert.equal(getServiceGroupId('dog-walker'), 'pets')
  assert.equal(getServiceGroupId('unknown'), null)
  assert.deepEqual(getServiceIdsForGroup('pets'), [
    'dog-walker', 'pet-sitter', 'pet-groomer', 'dog-trainer',
  ])
  assert.deepEqual(getServiceIdsForGroup('unknown'), [])
})

test('only other-local-service supports a custom service description', () => {
  const customServices = SERVICE_TAXONOMY_SERVICES
    .filter(({ id }) => serviceSupportsCustomDescription(id))
    .map(({ id }) => id)
  assert.deepEqual(customServices, ['other-local-service'])
  assert.equal(serviceSupportsCustomDescription('plumber'), false)
  assert.equal(serviceSupportsCustomDescription('unknown'), false)
})

test('business taxonomy limits match the approved V1 product rules', () => {
  assert.equal(MAX_BUSINESS_SERVICE_SELECTIONS, 6)
  assert.equal(MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH, 80)
})

test('canonical business taxonomy validation accepts the agreed canonical shapes', () => {
  for (const selection of [
    { primaryCategoryId: 'plumber', categoryIds: ['plumber'] },
    {
      primaryCategoryId: 'builder-renovation',
      categoryIds: ['builder-renovation', 'painter-decorator', 'handyman'],
    },
    {
      primaryCategoryId: 'other-local-service',
      categoryIds: ['other-local-service'],
      customServiceDescription: 'Solar panel cleaning',
    },
    {
      primaryCategoryId: 'cleaner',
      categoryIds: ['cleaner', 'other-local-service'],
      customServiceDescription: 'Solar panel cleaning',
    },
  ]) assert.deepEqual(validateCanonicalBusinessTaxonomy(selection), { valid: true, issues: [] })
})

test('canonical business taxonomy validation uses every service from the central catalogue', () => {
  for (const serviceId of SERVICE_TAXONOMY_SERVICE_IDS) {
    const selection = {
      primaryCategoryId: serviceId,
      categoryIds: [serviceId],
      ...(serviceId === 'other-local-service'
        ? { customServiceDescription: 'Specialist local service' }
        : {}),
    }
    assert.equal(validateCanonicalBusinessTaxonomy(selection).valid, true, serviceId)
  }
})

test('canonical business taxonomy validation rejects non-canonical primary values', () => {
  for (const primaryCategoryId of ['Plumbing', ' plumber ', 'unknown-service']) {
    const result = validateCanonicalBusinessTaxonomy({
      primaryCategoryId,
      categoryIds: [primaryCategoryId],
    })
    assert.equal(result.valid, false, primaryCategoryId)
    assert.ok(result.issues.some(({ code, field }) => (
      code === 'VALIDATION_INVALID_VALUE' && field === 'primaryCategoryId'
    )))
  }
})

test('canonical business taxonomy validation rejects malformed service lists independently', () => {
  const cases = [
    [{ primaryCategoryId: 'plumber', categoryIds: [] }, 'VALIDATION_INVALID_VALUE'],
    [{
      primaryCategoryId: 'plumber',
      categoryIds: [
        'plumber', 'electrician', 'cleaner', 'gardener', 'builder-renovation',
        'painter-decorator', 'handyman',
      ],
    }, 'VALIDATION_ARRAY_TOO_LARGE'],
    [{ primaryCategoryId: 'plumber', categoryIds: ['plumber', 'plumber'] }, 'VALIDATION_ARRAY_DUPLICATE'],
    [{ primaryCategoryId: 'plumber', categoryIds: ['plumber', 42] }, 'VALIDATION_INVALID_TYPE'],
    [{ primaryCategoryId: 'plumber', categoryIds: ['plumber', 'Plumbing'] }, 'VALIDATION_INVALID_VALUE'],
    [{ primaryCategoryId: 'plumber', categoryIds: ['plumber', 'Solar panel cleaning'] }, 'VALIDATION_INVALID_VALUE'],
    [{ primaryCategoryId: 'plumber', categoryIds: ['electrician'] }, 'VALIDATION_PRIMARY_NOT_IN_CATEGORIES'],
  ]

  for (const [selection, expectedCode] of cases) {
    const result = validateCanonicalBusinessTaxonomy(selection)
    assert.equal(result.valid, false, expectedCode)
    assert.ok(result.issues.some(({ code }) => code === expectedCode), expectedCode)
  }
})

test('canonical business taxonomy validation enforces the Other description relationship', () => {
  for (const selection of [
    { primaryCategoryId: 'other-local-service', categoryIds: ['other-local-service'] },
    {
      primaryCategoryId: 'other-local-service', categoryIds: ['other-local-service'],
      customServiceDescription: '   ',
    },
    {
      primaryCategoryId: 'other-local-service', categoryIds: ['other-local-service'],
      customServiceDescription: ' Solar panel cleaning ',
    },
    {
      primaryCategoryId: 'other-local-service', categoryIds: ['other-local-service'],
      customServiceDescription: 'x'.repeat(MAX_CUSTOM_SERVICE_DESCRIPTION_LENGTH + 1),
    },
    {
      primaryCategoryId: 'plumber', categoryIds: ['plumber'],
      customServiceDescription: 'Solar panel cleaning',
    },
  ]) {
    const result = validateCanonicalBusinessTaxonomy(selection)
    assert.equal(result.valid, false)
    assert.ok(result.issues.some(({ field }) => field === 'customServiceDescription'))
  }

  assert.equal(validateCanonicalBusinessTaxonomy({
    primaryCategoryId: 'plumber', categoryIds: ['plumber'], customServiceDescription: null,
  }).valid, true)
})
