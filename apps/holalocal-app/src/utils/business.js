import { spokenLanguageOptions } from './languages.js'

export const businessCategoryOptions = [
  'Cleaning',
  'Plumbing',
  'Electrical',
  'Gardening',
  'Painting & Decorating',
  'Building & Renovation',
  'Handyman',
  'Air Conditioning',
  'Locksmith',
  'Pest Control',
  'Pool Maintenance',
  'Pet Services',
  'Other',
]

export const businessLanguageOptions = spokenLanguageOptions

export const provinceOptions = ['Málaga', 'Cádiz', 'Gibraltar', 'Other']

export const serviceAreaOptions = [
  'Málaga',
  'Torremolinos',
  'Benalmádena',
  'Fuengirola',
  'Mijas',
  'Marbella',
  'Estepona',
  'Casares',
  'Manilva',
  'Sotogrande',
  'Gibraltar',
  'Other',
]

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
    const normalizedValue = (value === 'Other' ? customValue : value).trim()
    const alreadyIncluded = normalizedValues.some(
      (existingValue) => existingValue.toLowerCase() === normalizedValue.toLowerCase(),
    )

    if (normalizedValue && !alreadyIncluded) {
      normalizedValues.push(normalizedValue)
    }
  }

  return normalizedValues
}
