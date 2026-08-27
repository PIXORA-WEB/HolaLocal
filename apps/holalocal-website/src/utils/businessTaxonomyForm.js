import {
  getServiceGroupId,
  isCanonicalServiceId,
  MAX_BUSINESS_SERVICE_SELECTIONS,
  resolveServiceValue,
  SERVICE_VALUE_RESOLUTIONS,
  validateCanonicalBusinessTaxonomy,
} from '@holalocal/firebase-contract'

function resolvedCanonicalId(value) {
  const resolution = resolveServiceValue(value)
  return {
    resolution,
    serviceId: resolution.resolution === SERVICE_VALUE_RESOLUTIONS.CANONICAL
      || resolution.resolution === SERVICE_VALUE_RESOLUTIONS.RECOGNIZED_LEGACY
      ? resolution.serviceId
      : null,
  }
}

export function deriveBusinessTaxonomyForm(business = {}) {
  const primary = resolvedCanonicalId(business.primaryCategoryId)
  const hasStoredPrimary = typeof business.primaryCategoryId === 'string'
    && Boolean(business.primaryCategoryId.trim())
  const additionalServiceIds = []
  const unresolvedValues = []
  let hasLegacyValues = hasStoredPrimary
    && primary.resolution.resolution !== SERVICE_VALUE_RESOLUTIONS.CANONICAL

  for (const rawValue of Array.isArray(business.categoryIds) ? business.categoryIds : []) {
    const resolved = resolvedCanonicalId(rawValue)
    if (resolved.resolution.resolution !== SERVICE_VALUE_RESOLUTIONS.CANONICAL) hasLegacyValues = true
    if (resolved.serviceId) {
      if (resolved.serviceId !== primary.serviceId && !additionalServiceIds.includes(resolved.serviceId)) {
        additionalServiceIds.push(resolved.serviceId)
      }
    } else if (typeof rawValue === 'string' && rawValue.trim() && !unresolvedValues.includes(rawValue)) {
      unresolvedValues.push(rawValue)
    }
  }

  if (!primary.serviceId && typeof business.primaryCategoryId === 'string' && business.primaryCategoryId.trim()) {
    if (!unresolvedValues.includes(business.primaryCategoryId)) unresolvedValues.unshift(business.primaryCategoryId)
  }

  return {
    primaryServiceId: primary.serviceId ?? '',
    groupId: primary.serviceId ? getServiceGroupId(primary.serviceId) : '',
    additionalServiceIds,
    customServiceDescription: isCanonicalServiceId(business.primaryCategoryId)
      && Array.isArray(business.categoryIds) && business.categoryIds.every(isCanonicalServiceId)
      ? String(business.customServiceDescription ?? '')
      : '',
    hasLegacyValues,
    unresolvedValues,
    editing: unresolvedValues.length === 0,
  }
}

export function beginCanonicalTaxonomyEdit(taxonomy) {
  return { ...taxonomy, editing: true }
}

export function selectTaxonomyGroup(taxonomy, groupId) {
  return {
    ...taxonomy,
    groupId,
    primaryServiceId: '',
    additionalServiceIds: taxonomy.additionalServiceIds.filter(
      (serviceId) => serviceId !== taxonomy.primaryServiceId,
    ),
    editing: true,
  }
}

export function selectPrimaryService(taxonomy, primaryServiceId) {
  return {
    ...taxonomy,
    primaryServiceId,
    groupId: getServiceGroupId(primaryServiceId) ?? taxonomy.groupId,
    additionalServiceIds: taxonomy.additionalServiceIds.filter(
      (serviceId) => serviceId !== primaryServiceId && serviceId !== taxonomy.primaryServiceId,
    ),
    editing: true,
  }
}

export function toggleAdditionalService(taxonomy, serviceId) {
  if (serviceId === taxonomy.primaryServiceId) return taxonomy
  if (taxonomy.additionalServiceIds.includes(serviceId)) {
    return {
      ...taxonomy,
      additionalServiceIds: taxonomy.additionalServiceIds.filter((id) => id !== serviceId),
      editing: true,
    }
  }
  if (taxonomy.additionalServiceIds.length >= MAX_BUSINESS_SERVICE_SELECTIONS - 1) return taxonomy
  return {
    ...taxonomy,
    additionalServiceIds: [...taxonomy.additionalServiceIds, serviceId],
    editing: true,
  }
}

export function prepareBusinessTaxonomyUpdate(taxonomy, taxonomyDirty) {
  if (!taxonomyDirty) return { valid: true, issues: [], updates: {} }

  const customServiceDescription = taxonomy.customServiceDescription.trim()
  const categoryIds = [taxonomy.primaryServiceId, ...taxonomy.additionalServiceIds]
  const selection = {
    primaryCategoryId: taxonomy.primaryServiceId,
    categoryIds,
    ...(categoryIds.includes('other-local-service') ? { customServiceDescription } : {}),
  }
  const validation = validateCanonicalBusinessTaxonomy(selection)
  if (!validation.valid) return { ...validation, updates: null }

  return {
    ...validation,
    updates: {
      primaryCategoryId: selection.primaryCategoryId,
      categoryIds: selection.categoryIds,
      customServiceDescription: categoryIds.includes('other-local-service')
        ? customServiceDescription
        : null,
    },
  }
}
