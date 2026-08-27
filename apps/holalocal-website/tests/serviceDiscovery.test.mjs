import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SERVICE_DISCOVERY_QUERY_TYPES,
  filterPublicBusinesses,
  matchesService,
  matchesServiceGroup,
  matchesServiceSearch,
  parseServiceDiscoveryQuery,
  resolvePublicBusinessServices,
} from '../src/utils/serviceDiscovery.js'

const canonicalBusiness = {
  businessId: 'canonical',
  name: 'Costa Plumbing',
  category: 'plumber',
  services: ['plumber', 'handyman'],
  primaryServiceId: 'plumber',
  serviceIds: ['plumber', 'handyman'],
  serviceArea: 'Marbella',
  languages: ['en', 'es'],
}

test('resolves new and old public responses and matches additional services', () => {
  assert.deepEqual(resolvePublicBusinessServices(canonicalBusiness).serviceIds, ['plumber', 'handyman'])
  assert.equal(matchesService(canonicalBusiness, 'plumber'), true)
  assert.equal(matchesService(canonicalBusiness, 'handyman'), true)

  const legacy = { category: 'Plumbing', services: ['Plumbing', 'Air Conditioning'] }
  assert.deepEqual(resolvePublicBusinessServices(legacy).serviceIds, ['plumber', 'air-conditioning'])
  assert.equal(matchesService(legacy, 'air-conditioning'), true)
})

test('mixed legacy values resolve only safe individual services', () => {
  const mixed = {
    category: 'Plumbing',
    services: ['Plumbing', 'Pet Services', 'Solar panel cleaning', 'Air Conditioning'],
  }
  assert.deepEqual(resolvePublicBusinessServices(mixed).serviceIds, ['plumber', 'air-conditioning'])
})

test('historical resolved services are deduplicated without applying the write limit', () => {
  const historical = {
    category: 'Plumbing',
    services: [
      'Plumbing', 'Electrical', 'Cleaning', 'Gardening', 'Handyman',
      'Air Conditioning', 'Locksmith', 'Pest Control', 'plumber', 'Plumbing',
    ],
  }
  assert.deepEqual(resolvePublicBusinessServices(historical).serviceIds, [
    'plumber', 'electrician', 'cleaner', 'gardener', 'handyman',
    'air-conditioning', 'locksmith', 'pest-control',
  ])
})

test('canonical group matching derives membership centrally and keeps Pets compatibility broad', () => {
  assert.equal(matchesServiceGroup({ serviceIds: ['plumber'] }, 'home-property'), true)
  assert.equal(matchesServiceGroup({ serviceIds: ['accountant'] }, 'professional-services'), true)
  assert.equal(matchesServiceGroup({ serviceIds: ['dog-walker'] }, 'pets'), true)
  assert.equal(matchesServiceGroup({ category: 'Pet Services', services: ['Pet Services'] }, 'pets'), true)
  assert.equal(matchesServiceGroup({ serviceIds: ['plumber'] }, 'pets'), false)
})

test('query parsing gives exact canonical service precedence', () => {
  assert.deepEqual(parseServiceDiscoveryQuery(''), { type: SERVICE_DISCOVERY_QUERY_TYPES.NONE })
  assert.deepEqual(parseServiceDiscoveryQuery('?service=plumber'), {
    type: SERVICE_DISCOVERY_QUERY_TYPES.SERVICE, serviceId: 'plumber',
  })
  assert.deepEqual(parseServiceDiscoveryQuery('?category=Plumbing'), {
    type: SERVICE_DISCOVERY_QUERY_TYPES.SERVICE, serviceId: 'plumber', legacyRawValue: 'Plumbing',
  })
  assert.deepEqual(parseServiceDiscoveryQuery('?service=plumber&category=Cleaning'), {
    type: SERVICE_DISCOVERY_QUERY_TYPES.SERVICE, serviceId: 'plumber',
  })
})

test('invalid explicit service parameters never become legacy aliases or unfiltered queries', () => {
  for (const queryString of ['?service=', '?service=Plumbing', '?service=%20plumber%20', '?service=unknown']) {
    const query = parseServiceDiscoveryQuery(queryString)
    assert.equal(query.type, SERVICE_DISCOVERY_QUERY_TYPES.INVALID_SERVICE)
    assert.deepEqual(filterPublicBusinesses([canonicalBusiness], { query }), [])
  }

  assert.deepEqual(parseServiceDiscoveryQuery('?service='), {
    type: SERVICE_DISCOVERY_QUERY_TYPES.INVALID_SERVICE,
    rawValue: '',
  })
})

test('Pet Services URL matches the Pets group and raw legacy records only', () => {
  const query = parseServiceDiscoveryQuery('?category=Pet%20Services')
  assert.deepEqual(query, {
    type: SERVICE_DISCOVERY_QUERY_TYPES.GROUP_COMPATIBILITY,
    groupId: 'pets', rawValue: 'Pet Services',
  })
  const businesses = [
    { businessId: 'walker', serviceIds: ['dog-walker'] },
    { businessId: 'sitter', serviceIds: ['pet-sitter'] },
    { businessId: 'plumber', serviceIds: ['plumber'] },
    { businessId: 'legacy-pets', category: 'Pet Services', services: ['Pet Services'] },
  ]
  assert.deepEqual(filterPublicBusinesses(businesses, { query }).map(({ businessId }) => businessId), [
    'walker', 'sitter', 'legacy-pets',
  ])
})

test('Other and unknown legacy category URLs remain raw compatibility filters', () => {
  const otherQuery = parseServiceDiscoveryQuery('?category=Other')
  assert.equal(otherQuery.type, SERVICE_DISCOVERY_QUERY_TYPES.RAW_LEGACY)
  assert.deepEqual(filterPublicBusinesses([
    { businessId: 'legacy', category: 'Other', services: ['Other'] },
    { businessId: 'canonical', category: 'other-local-service', serviceIds: ['other-local-service'] },
  ], { query: otherQuery }).map(({ businessId }) => businessId), ['legacy'])

  const customQuery = parseServiceDiscoveryQuery('?category=Some%20Historical%20Value')
  assert.equal(customQuery.type, SERVICE_DISCOVERY_QUERY_TYPES.RAW_LEGACY)
  assert.deepEqual(filterPublicBusinesses([
    { businessId: 'custom', category: 'some historical value' },
    canonicalBusiness,
  ], { query: customQuery }).map(({ businessId }) => businessId), ['custom'])
})

test('service-oriented free-text search covers localized and compatibility tokens but not description', () => {
  const business = {
    ...canonicalBusiness,
    services: ['Plumbing', 'Solar panel cleaning'],
    customServiceDescription: 'Marine upholstery specialist',
    description: 'Description-only secret phrase',
  }
  const translatedLabel = (definition) => definition.id === 'plumber' ? 'Fontanero' : definition.defaultLabel
  for (const term of [
    'Costa', 'Plumber', 'Fontanero', 'plumber', 'Plumbing',
    'Solar panel', 'Marine upholstery',
  ]) {
    assert.equal(matchesServiceSearch(business, term, { labelResolver: translatedLabel }), true, term)
  }
  assert.equal(matchesServiceSearch(business, 'secret phrase', { labelResolver: translatedLabel }), false)
})

test('combined filtering preserves existing area and language semantics', () => {
  const query = parseServiceDiscoveryQuery('?service=handyman')
  assert.deepEqual(filterPublicBusinesses([canonicalBusiness], {
    area: 'marb', language: 'ES', query, searchTerm: 'Costa',
  }), [canonicalBusiness])
  assert.deepEqual(filterPublicBusinesses([canonicalBusiness], { area: 'Madrid', query }), [])
})
