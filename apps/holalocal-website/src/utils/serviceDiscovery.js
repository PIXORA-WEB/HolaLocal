import {
  getServiceIdsForGroup,
  getServiceTaxonomyService,
  isCanonicalServiceId,
  LEGACY_SERVICE_VALUES,
  resolveServiceValue,
} from '@holalocal/firebase-contract'

export const SERVICE_DISCOVERY_QUERY_TYPES = Object.freeze({
  NONE: 'none',
  SERVICE: 'service',
  GROUP_COMPATIBILITY: 'group-compatibility',
  RAW_LEGACY: 'raw-legacy',
  INVALID_SERVICE: 'invalid-service',
})

export function normalizeDiscoveryText(value) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function queryParams(value) {
  if (value instanceof URLSearchParams) return value
  return new URLSearchParams(typeof value === 'string' ? value : '')
}

export function parseServiceDiscoveryQuery(value) {
  const params = queryParams(value)
  if (params.has('service')) {
    const serviceId = params.get('service') ?? ''
    return isCanonicalServiceId(serviceId)
      ? Object.freeze({ type: SERVICE_DISCOVERY_QUERY_TYPES.SERVICE, serviceId })
      : Object.freeze({ type: SERVICE_DISCOVERY_QUERY_TYPES.INVALID_SERVICE, rawValue: serviceId })
  }

  if (!params.has('category')) return Object.freeze({ type: SERVICE_DISCOVERY_QUERY_TYPES.NONE })
  const rawValue = params.get('category') ?? ''
  if (!rawValue) return Object.freeze({ type: SERVICE_DISCOVERY_QUERY_TYPES.NONE })
  const resolution = resolveServiceValue(rawValue)
  if (resolution.serviceId) {
    return Object.freeze({
      type: SERVICE_DISCOVERY_QUERY_TYPES.SERVICE,
      serviceId: resolution.serviceId,
      legacyRawValue: rawValue,
    })
  }
  if (resolution.compatibleGroupId) {
    return Object.freeze({
      type: SERVICE_DISCOVERY_QUERY_TYPES.GROUP_COMPATIBILITY,
      groupId: resolution.compatibleGroupId,
      rawValue,
    })
  }
  return Object.freeze({ type: SERVICE_DISCOVERY_QUERY_TYPES.RAW_LEGACY, rawValue })
}

function publicRawTaxonomyValues(business = {}) {
  return [business.category, ...(Array.isArray(business.services) ? business.services : [])]
    .filter((value) => typeof value === 'string' && value.trim())
}

export function resolvePublicBusinessServices(business = {}) {
  const serviceIds = []
  const seen = new Set()
  const addServiceId = (serviceId) => {
    if (!isCanonicalServiceId(serviceId) || seen.has(serviceId)) return
    seen.add(serviceId)
    serviceIds.push(serviceId)
  }
  const resolveAndAdd = (rawValue) => addServiceId(resolveServiceValue(rawValue).serviceId)

  addServiceId(business.primaryServiceId)
  if (Array.isArray(business.serviceIds)) business.serviceIds.forEach(addServiceId)
  publicRawTaxonomyValues(business).forEach(resolveAndAdd)

  const rawValues = publicRawTaxonomyValues(business)
  const compatibleGroupIds = [...new Set(rawValues
    .map((rawValue) => resolveServiceValue(rawValue).compatibleGroupId)
    .filter(Boolean))]

  return Object.freeze({
    serviceIds: Object.freeze(serviceIds),
    rawValues: Object.freeze(rawValues),
    compatibleGroupIds: Object.freeze(compatibleGroupIds),
  })
}

export function matchesService(business, serviceId) {
  return isCanonicalServiceId(serviceId)
    && resolvePublicBusinessServices(business).serviceIds.includes(serviceId)
}

export function matchesServiceGroup(business, groupId) {
  const groupServiceIds = getServiceIdsForGroup(groupId)
  if (groupServiceIds.length === 0) return false
  const resolved = resolvePublicBusinessServices(business)
  return resolved.compatibleGroupIds.includes(groupId)
    || resolved.serviceIds.some((serviceId) => groupServiceIds.includes(serviceId))
}

function matchesRawTaxonomy(business, rawValue) {
  const expected = normalizeDiscoveryText(rawValue)
  return Boolean(expected) && resolvePublicBusinessServices(business).rawValues.some(
    (value) => normalizeDiscoveryText(value) === expected,
  )
}

export function matchesServiceDiscoveryQuery(business, query) {
  switch (query?.type) {
    case SERVICE_DISCOVERY_QUERY_TYPES.SERVICE:
      return matchesService(business, query.serviceId)
    case SERVICE_DISCOVERY_QUERY_TYPES.GROUP_COMPATIBILITY:
      return matchesServiceGroup(business, query.groupId) || matchesRawTaxonomy(business, query.rawValue)
    case SERVICE_DISCOVERY_QUERY_TYPES.RAW_LEGACY:
      return matchesRawTaxonomy(business, query.rawValue)
    case SERVICE_DISCOVERY_QUERY_TYPES.INVALID_SERVICE:
      return false
    default:
      return true
  }
}

function serviceSearchTokens(serviceId, labelResolver) {
  const definition = getServiceTaxonomyService(serviceId)
  if (!definition) return []
  return [
    serviceId,
    definition.defaultLabel,
    labelResolver?.(definition),
    ...LEGACY_SERVICE_VALUES
      .filter((legacyValue) => legacyValue.serviceId === serviceId)
      .map(({ value }) => value),
  ]
}

export function matchesServiceSearch(business, searchTerm, { labelResolver } = {}) {
  const expected = normalizeDiscoveryText(searchTerm)
  if (!expected) return true
  const resolved = resolvePublicBusinessServices(business)
  const tokens = [
    business?.name,
    business?.customServiceDescription,
    ...resolved.rawValues,
    ...resolved.serviceIds.flatMap((serviceId) => serviceSearchTokens(serviceId, labelResolver)),
  ]
  return tokens.some((value) => normalizeDiscoveryText(value).includes(expected))
}

export function filterPublicBusinesses(businesses, {
  area = '',
  language = '',
  labelResolver,
  query = Object.freeze({ type: SERVICE_DISCOVERY_QUERY_TYPES.NONE }),
  searchTerm = '',
} = {}) {
  const normalizedArea = normalizeDiscoveryText(area)
  const normalizedLanguage = normalizeDiscoveryText(language)
  return (Array.isArray(businesses) ? businesses : []).filter((business) => (
    matchesServiceSearch(business, searchTerm, { labelResolver })
    && (!normalizedArea || normalizeDiscoveryText(business?.serviceArea).includes(normalizedArea))
    && matchesServiceDiscoveryQuery(business, query)
    && (!normalizedLanguage || (Array.isArray(business?.languages) && business.languages.some(
      (businessLanguage) => normalizeDiscoveryText(businessLanguage) === normalizedLanguage,
    )))
  ))
}

export function getPublicBusinessPrimaryServiceLabel(business, labelResolver) {
  const primaryCandidates = [business?.primaryServiceId, business?.category]
  for (const candidate of primaryCandidates) {
    const serviceId = isCanonicalServiceId(candidate) ? candidate : resolveServiceValue(candidate).serviceId
    const definition = getServiceTaxonomyService(serviceId)
    if (definition) return labelResolver?.(definition) || definition.defaultLabel
  }
  return typeof business?.category === 'string' ? business.category : ''
}
