import {
  LAUNCH_LOCATION_CATALOGUE,
  locationDisplayLabel,
  normalizeLocationText,
  resolveLaunchLocation,
  searchLaunchLocations,
  validateBusinessLocation,
} from '@holalocal/firebase-contract'

export {
  LAUNCH_LOCATION_CATALOGUE,
  locationDisplayLabel,
  normalizeLocationText as normalizeLocationSearchText,
  resolveLaunchLocation,
  searchLaunchLocations,
  validateBusinessLocation,
}

export const provinceOptions = [
  { value: 'malaga', labelKey: 'locations.provinces.malaga', defaultLabel: 'Málaga province' },
  { value: 'cadiz', labelKey: 'locations.provinces.cadiz', defaultLabel: 'Cádiz province' },
  { value: 'gibraltar', labelKey: 'locations.provinces.gibraltar', defaultLabel: 'Gibraltar' },
]

export const countryOptions = [
  { value: 'ES', labelKey: 'locations.countries.ES', defaultLabel: 'Spain' },
  { value: 'GI', labelKey: 'locations.countries.GI', defaultLabel: 'Gibraltar' },
]

export const serviceAreaLabels = Object.fromEntries(
  LAUNCH_LOCATION_CATALOGUE.map(({ id, locality }) => [id, locality]),
)

export const serviceAreaGroupLabels = {
  malaga: 'Málaga province / Costa del Sol',
  cadiz: 'Cádiz province / Campo de Gibraltar',
  gibraltar: 'Gibraltar',
}

export const serviceAreaOptions = LAUNCH_LOCATION_CATALOGUE.map((location) => ({
  value: location.id,
  group: location.regionCode,
  labelKey: `locations.areas.${location.id}`,
  defaultLabel: locationDisplayLabel(location),
  location,
}))

export function normalizeProvinceId(value) {
  const normalized = normalizeLocationText(value).replace(/\s+province$/, '')
  if (['malaga', 'cadiz', 'gibraltar'].includes(normalized)) return normalized
  return value
}

export function normalizeCountryCode(value) {
  const normalized = normalizeLocationText(value)
  if (normalized === 'es' || normalized === 'spain' || normalized === 'espana') return 'ES'
  if (normalized === 'gi' || normalized === 'gibraltar') return 'GI'
  return String(value ?? '').toUpperCase()
}

export function normalizeServiceAreaId(value) {
  return resolveLaunchLocation(value)?.id ?? value
}

export function primaryLocationInputState(value) {
  return {
    city: value,
    primaryLocationId: '',
  }
}

export function primaryLocationSelectionState(location) {
  return {
    city: location.locality,
    country: location.countryCode,
    primaryLocationId: location.id,
    province: location.regionCode,
  }
}

export function toggleServiceAreaSelection(values, value) {
  const canonicalId = resolveLaunchLocation(value)?.id
  if (!canonicalId) return [...values]
  return values.includes(canonicalId)
    ? values.filter((candidate) => candidate !== canonicalId)
    : [...values, canonicalId]
}

export function getServiceAreaLabel(value, translate) {
  const location = resolveLaunchLocation(value)
  if (!location) return typeof value === 'string' ? value : ''
  return translate(`locations.areas.${location.id}`, {
    defaultValue: locationDisplayLabel(location),
  })
}

export function serviceAreaMatchesSearch(option, query) {
  if (!query?.trim()) return true
  const matchingIds = new Set(searchLaunchLocations(query).map(({ id }) => id))
  return matchingIds.has(option?.value)
}

export function getProvinceLabel(value, translate) {
  const normalized = normalizeProvinceId(value)
  const option = provinceOptions.find((candidate) => candidate.value === normalized)
  return option
    ? translate(option.labelKey, { defaultValue: option.defaultLabel })
    : value
}

export function getServiceAreaGroupLabel(value, translate) {
  const defaultLabel = serviceAreaGroupLabels[value] ?? value
  return translate(`locations.groups.${value}`, { defaultValue: defaultLabel })
}
