import {
  normalizeLanguages, normalizeServiceAreas, validateCanonicalBusinessTaxonomy,
  validatePrimaryLanguage,
} from '@holalocal/firebase-contract'

function text(value) { return typeof value === 'string' ? value.trim() : '' }
function strings(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))]
    : []
}

export function computeBusinessProfileCompleted(business = {}) {
  const normalizedLanguages = normalizeLanguages(business.languages)
  const normalizedAreas = normalizeServiceAreas(business.serviceAreas)
  const primary = validatePrimaryLanguage(business.primaryLanguage, normalizedLanguages.identifiers)
  const categoryIds = strings(business.categoryIds)
  const location = business.location && typeof business.location === 'object' ? business.location : {}

  return Boolean(
    text(business.name)
    && text(business.description)
    && text(business.primaryCategoryId)
    && categoryIds.length > 0
    && normalizedAreas.identifiers.length > 0
    && normalizedLanguages.identifiers.length > 0
    && primary.valid
    && text(location.locality)
    && text(location.region)
    && text(location.countryCode),
  )
}

export function buildCanonicalBusinessUpdate(form = {}, {
  taxonomy = null, taxonomyDirty = false, requireTaxonomy = false,
} = {}) {
  if (form?.compatibility?.writeSafe === false) {
    return { valid: false, payload: null, issues: ['COMPATIBILITY_VIEW_NOT_WRITE_SAFE'] }
  }
  const issues = []
  let taxonomyPayload = {}
  if (taxonomyDirty || requireTaxonomy) {
    const categoryIds = [taxonomy?.primaryServiceId, ...(taxonomy?.additionalServiceIds ?? [])]
    const usesCustomDescription = categoryIds.includes('other-local-service')
    const selection = {
      primaryCategoryId: taxonomy?.primaryServiceId,
      categoryIds,
      ...(usesCustomDescription
        ? { customServiceDescription: text(taxonomy?.customServiceDescription) }
        : {}),
    }
    const taxonomyValidation = validateCanonicalBusinessTaxonomy(selection)
    if (!taxonomyValidation.valid) issues.push('BUSINESS_TAXONOMY_INVALID')
    else {
      taxonomyPayload = {
        primaryCategoryId: selection.primaryCategoryId,
        categoryIds: selection.categoryIds,
        customServiceDescription: usesCustomDescription
          ? selection.customServiceDescription
          : null,
      }
    }
  }

  const normalizedLanguages = normalizeLanguages(form.languages)
  const normalizedAreas = normalizeServiceAreas(form.serviceAreas)
  const unsupportedLanguage = normalizedLanguages.values.some(
    ({ id, isCustom, source }) => isCustom && source !== id,
  )
  const unsupportedArea = normalizedAreas.values.some(
    ({ id, isCustom, source }) => isCustom && source !== id,
  )
  if (unsupportedLanguage) issues.push('BUSINESS_CUSTOM_LANGUAGE_REQUIRES_CANONICAL_ID')
  if (unsupportedArea) issues.push('BUSINESS_CUSTOM_SERVICE_AREA_REQUIRES_CANONICAL_ID')
  const primary = validatePrimaryLanguage(form.primaryLanguage, normalizedLanguages.identifiers)
  if (!primary.valid) issues.push('LANGUAGE_PRIMARY_INVALID')

  if (issues.length) return { valid: false, payload: null, issues: [...new Set(issues)] }
  return {
    valid: true,
    issues: [],
    payload: {
      name: text(form.name),
      tagline: text(form.tagline),
      description: text(form.description),
      ...taxonomyPayload,
      serviceAreas: normalizedAreas.identifiers,
      serviceRadiusKm: Math.min(Math.max(Number(form.serviceRadiusKm) || 0, 0), 500),
      location: {
        locality: text(form.location?.locality),
        region: text(form.location?.region),
        countryCode: text(form.location?.countryCode).toUpperCase(),
      },
      languages: normalizedLanguages.identifiers,
      primaryLanguage: form.primaryLanguage,
    },
  }
}
