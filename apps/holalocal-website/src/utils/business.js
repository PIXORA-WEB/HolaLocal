import { spokenLanguageOptions } from './languages.js'
export { countryOptions, provinceOptions, serviceAreaOptions } from './locations.js'

export const OWNER_EDITABLE_BUSINESS_STATUSES = Object.freeze(['draft', 'rejected'])

export function isOwnerEditableBusinessStatus(status) {
  return OWNER_EDITABLE_BUSINESS_STATUSES.includes(status)
}

export const businessCategoryOptions = [
  { value: 'Cleaning', labelKey: 'business.categories.cleaning' },
  { value: 'Plumbing', labelKey: 'business.categories.plumbing' },
  { value: 'Electrical', labelKey: 'business.categories.electrical' },
  { value: 'Gardening', labelKey: 'business.categories.gardening' },
  { value: 'Painting & Decorating', labelKey: 'business.categories.paintingDecorating' },
  { value: 'Building & Renovation', labelKey: 'business.categories.buildingRenovation' },
  { value: 'Handyman', labelKey: 'business.categories.handyman' },
  { value: 'Air Conditioning', labelKey: 'business.categories.airConditioning' },
  { value: 'Locksmith', labelKey: 'business.categories.locksmith' },
  { value: 'Pest Control', labelKey: 'business.categories.pestControl' },
  { value: 'Pool Maintenance', labelKey: 'business.categories.poolMaintenance' },
  { value: 'Pet Services', labelKey: 'business.categories.petServices' },
  { value: 'Other', labelKey: 'common.other' },
]

export const businessLanguageOptions = spokenLanguageOptions

export function getBusinessCategoryLabel(value, translate) {
  const option = businessCategoryOptions.find((category) => category.value === value)
  return option ? translate(option.labelKey, { defaultValue: option.value }) : value
}

export function createBusinessSlug(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeCustomValues(values, customValue = '') {
  const normalizedValues = []

  for (const value of values) {
    const normalizedValue = (value === 'Other' || value === 'other' ? customValue : value).trim()
    const alreadyIncluded = normalizedValues.some(
      (existingValue) => existingValue.toLowerCase() === normalizedValue.toLowerCase(),
    )

    if (normalizedValue && !alreadyIncluded) {
      normalizedValues.push(normalizedValue)
    }
  }

  return normalizedValues
}
