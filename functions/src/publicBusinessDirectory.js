import { HttpsError } from 'firebase-functions/v2/https'
import {
  adaptBusinessDocument,
  isCustomIdentifier,
  isPublicBusinessEligible,
  projectPublicContact,
} from '@holalocal/firebase-contract'

const DEFAULT_MAX_RESULTS = 60
const MAX_RESULTS = 100

function displayCompatibilityValues(values, namespace) {
  return values.map((value) => isCustomIdentifier(value.id, namespace) ? value.label : value.id)
}

export function normalizePublicBusinessLimit(value) {
  if (value == null) return DEFAULT_MAX_RESULTS
  if (typeof value === 'string' && !value.trim()) {
    throw new HttpsError('invalid-argument', 'invalid-max-results')
  }
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    throw new HttpsError('invalid-argument', 'invalid-max-results')
  }
  return Math.min(Math.max(Math.trunc(numericValue), 1), MAX_RESULTS)
}

export function toPublicDirectoryBusiness(documentId, rawDocument) {
  if (!isPublicBusinessEligible(rawDocument)) return null
  const { business } = adaptBusinessDocument(documentId, rawDocument)
  const languages = displayCompatibilityValues(business.languageValues, 'language')
  const serviceAreas = displayCompatibilityValues(business.serviceAreaValues, 'area')
  const primaryLanguage = business.languageValues.find(({ id }) => id === business.primaryLanguage)

  return {
    businessId: documentId,
    name: business.name,
    category: business.primaryCategoryId,
    serviceArea: business.location?.locality || serviceAreas[0] || '',
    serviceAreas,
    languages,
    primaryLanguage: primaryLanguage?.isCustom
      ? primaryLanguage.label
      : business.primaryLanguage ?? languages[0] ?? '',
    description: business.description,
    tagline: business.tagline,
    services: [...business.categoryIds],
    galleryUrls: [...business.galleryImageURLs],
    contact: projectPublicContact(business.contact).contact,
    status: business.status,
    verificationStatus: business.verificationStatus ?? 'unverified',
    subscriptionTier: business.subscription?.tier ?? 'free',
    subscriptionStatus: business.subscription?.status ?? 'none',
    ratingAverage: typeof rawDocument?.ratingAverage === 'number' ? rawDocument.ratingAverage : null,
    ratingCount: typeof rawDocument?.ratingCount === 'number' ? rawDocument.ratingCount : 0,
    logoUrl: business.profilePhoto?.downloadUrl ?? null,
    profileComplete: business.profileCompleted === true,
  }
}

export async function listPublicBusinesses({ maxResults, db }) {
  const limit = normalizePublicBusinessLimit(maxResults)
  const snapshot = await db.collection('businesses')
    .where('status', '==', 'active')
    .where('publishedAt', '!=', null)
    .orderBy('publishedAt', 'desc')
    .limit(limit)
    .get()

  return {
    businesses: snapshot.docs
      .map((document) => toPublicDirectoryBusiness(document.id, document.data()))
      .filter(Boolean),
  }
}
