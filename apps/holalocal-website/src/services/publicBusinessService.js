// Public callable reads; managed Firestore operations belong to businessService.js.
import { getPublicBusinessCallable, listPublicBusinessesCallable } from '../firebase/functionsClient.js'
import { prepareBusinessMediaPresentation, resolveBusinessMediaPresentation } from './businessMediaPresentation.js'
import { loadPublicBusinessDirectory } from './publicBusinessDirectoryLoader.js'

async function presentBusiness(business, mediaOptions) {
  return business?.businessId
    ? resolveBusinessMediaPresentation(business.businessId, business, mediaOptions)
    : business
}

async function presentBusinessWithoutCanonicalMedia(business, mediaOptions) {
  return resolveBusinessMediaPresentation(business.businessId, business, {
    ...mediaOptions,
    resolveCanonicalUrl: async () => { throw new Error('Canonical media is unavailable.') },
  })
}

export async function getActivePublicBusinesses(maxResults = 60, dependencies = {}) {
  const resultLimit = Math.min(Math.max(Number(maxResults) || 1, 1), 100)
  return loadPublicBusinessDirectory({
    callPublicBusinesses: dependencies.callPublicBusinesses ?? listPublicBusinessesCallable,
    fallbackBusiness: dependencies.fallbackBusiness ?? ((business) => presentBusinessWithoutCanonicalMedia(business, dependencies.mediaOptions)),
    maxResults: resultLimit,
    presentBusiness: dependencies.presentBusiness ?? ((business) => presentBusiness(business, dependencies.mediaOptions)),
    selectBusinesses: dependencies.selectBusinesses,
    timeoutMs: dependencies.timeoutMs,
  })
}

export async function getFeaturedActiveBusinesses(maxResults = 60, dependencies = {}) {
  // Keep the server's eligibility/order and request window. Select the Home cards
  // before presentation; their directory variant uses only the logo, not galleries.
  return getActivePublicBusinesses(maxResults, {
    ...dependencies,
    selectBusinesses: (businesses) => businesses.filter((business) => business.profileComplete).slice(0, 3),
    mediaOptions: { ...dependencies.mediaOptions, includeGallery: false },
  })
}

export async function getPublicBusinessById(businessId) {
  try {
    const result = await getPublicBusinessCallable({ businessId })
    const business = result.data?.business ?? null
    return business?.businessId
      ? prepareBusinessMediaPresentation(business.businessId, business)
      : business
  } catch (error) {
    if (error?.code?.includes('not-found')) return null
    throw error
  }
}

