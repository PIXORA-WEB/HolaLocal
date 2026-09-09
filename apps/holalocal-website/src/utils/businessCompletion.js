import { hasCompletePublicBusinessProfile } from '@holalocal/firebase-contract'
import { validateBusinessLocation } from './locations.js'

const completionDefinitions = [
  ['name', (business) => Boolean(business?.name?.trim())],
  ['description', (business) => Boolean(business?.description?.trim())],
  ['category', (business) => Boolean(business?.primaryCategoryId)],
  ['serviceArea', (_business, _options, locationValidation) => locationValidation.valid],
  ['language', (business) => (business?.languages?.length ?? 0) > 0],
  ['logo', (business) => Boolean(business?.logoStoragePath || business?.logoUrl || business?.profilePhoto?.downloadUrl)],
  ['images', (business) => (
    (business?.galleryStoragePaths?.length ?? 0) > 0
    || (business?.galleryEntries?.length ?? business?.galleryImages?.length ?? business?.galleryImageURLs?.length ?? 0) > 0
  )],
  ['contact', (business) => Boolean(business?.contact?.preferredContactMethod)],
]

export function getBusinessProfileCompletion(business, options = {}) {
  const locationValidation = validateBusinessLocation(business, options)
  const items = completionDefinitions.map(([key, check]) => ({
    key,
    complete: check(business, options, locationValidation),
  }))
  const completedItems = items.filter(({ complete }) => complete)
  const remainingItems = items.filter(({ complete }) => !complete)

  return {
    items,
    completedItems,
    remainingItems,
    nextRecommendation: remainingItems[0]?.key ?? null,
    percentage: Math.round((completedItems.length / items.length) * 100),
    ready: hasCompletePublicBusinessProfile(business) && locationValidation.valid,
    locationValidation,
  }
}
