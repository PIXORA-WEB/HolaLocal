import { normalizeLanguages, normalizeServiceAreas, validatePrimaryLanguage } from '@holalocal/firebase-contract'

export const CANONICAL_BUSINESS_CATEGORIES = Object.freeze([
  'Cleaning', 'Plumbing', 'Electrical', 'Gardening', 'Painting & Decorating',
  'Building & Renovation', 'Handyman', 'Air Conditioning', 'Locksmith',
  'Pest Control', 'Pool Maintenance', 'Pet Services',
])
export const BUSINESS_CATEGORY_KEYS = Object.freeze({
  Cleaning: 'cleaning', Plumbing: 'plumbing', Electrical: 'electrical', Gardening: 'gardening',
  'Painting & Decorating': 'paintingDecorating', 'Building & Renovation': 'buildingRenovation',
  Handyman: 'handyman', 'Air Conditioning': 'airConditioning', Locksmith: 'locksmith',
  'Pest Control': 'pestControl', 'Pool Maintenance': 'poolMaintenance', 'Pet Services': 'petServices',
})

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
    && CANONICAL_BUSINESS_CATEGORIES.includes(text(business.primaryCategoryId))
    && categoryIds.length > 0
    && categoryIds.every((category) => CANONICAL_BUSINESS_CATEGORIES.includes(category))
    && normalizedAreas.identifiers.length > 0
    && normalizedLanguages.identifiers.length > 0
    && primary.valid
    && text(location.locality)
    && text(location.region)
    && text(location.countryCode),
  )
}

export function buildCanonicalBusinessUpdate(form = {}) {
  if (form?.compatibility?.writeSafe === false) {
    return { valid: false, payload: null, issues: ['COMPATIBILITY_VIEW_NOT_WRITE_SAFE'] }
  }
  const issues = []
  const primaryCategoryId = text(form.primaryCategoryId)
  const categoryIds = strings(form.categoryIds)
  if (!CANONICAL_BUSINESS_CATEGORIES.includes(primaryCategoryId)) issues.push('BUSINESS_CATEGORY_INVALID')
  if (categoryIds.some((category) => !CANONICAL_BUSINESS_CATEGORIES.includes(category))) {
    issues.push('BUSINESS_CATEGORY_INVALID')
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
      primaryCategoryId,
      categoryIds,
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
