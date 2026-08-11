import { HttpsError } from 'firebase-functions/v2/https'
import {
  adaptBusinessDocument,
  isCustomIdentifier,
  isPublicBusinessEligible,
  projectPublicContact,
  resolveAuthoritativeBusinessEntitlements,
} from '@holalocal/firebase-contract'
import { projectSafeBusinessMedia } from './businessMediaProjection.js'

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

export function toPublicDirectoryBusiness(documentId, rawDocument, privateSubscription = null, privateRecordExists = false) {
  if (!isPublicBusinessEligible(rawDocument)) return null
  const { business } = adaptBusinessDocument(documentId, rawDocument)
  const languages = displayCompatibilityValues(business.languageValues, 'language')
  const serviceAreas = displayCompatibilityValues(business.serviceAreaValues, 'area')
  const primaryLanguage = business.languageValues.find(({ id }) => id === business.primaryLanguage)
  const entitlements = resolveAuthoritativeBusinessEntitlements(
    privateSubscription,
    rawDocument?.subscription,
    { privateRecordExists },
  )
  const media = projectSafeBusinessMedia(documentId, rawDocument)

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
    galleryUrls: media.galleryUrls,
    galleryStoragePaths: media.galleryStoragePaths,
    contact: projectPublicContact(business.contact).contact,
    status: business.status,
    verificationStatus: business.verificationStatus ?? 'unverified',
    subscriptionTier: entitlements.effectivePlanId ?? 'early_access',
    subscriptionStatus: entitlements.accessStatus ?? 'active',
    ratingAverage: typeof rawDocument?.ratingAverage === 'number' ? rawDocument.ratingAverage : null,
    ratingCount: typeof rawDocument?.ratingCount === 'number' ? rawDocument.ratingCount : 0,
    logoUrl: media.logoUrl,
    logoStoragePath: media.logoStoragePath,
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

  const publicDocuments = snapshot.docs.filter((document) => isPublicBusinessEligible(document.data()))
  if (publicDocuments.length === 0) return { businesses: [] }
  const subscriptionSnapshots = await db.getAll(...publicDocuments.map(
    (document) => db.doc(`businessSubscriptions/${document.id}`),
  ))
  const projected = publicDocuments.map((document, index) => {
    const subscription = subscriptionSnapshots[index]
    return toPublicDirectoryBusiness(
      document.id,
      document.data(),
      subscription.exists ? subscription.data() : null,
      subscription.exists,
    )
  })
  return { businesses: projected.filter(Boolean) }
}

export async function getPublicBusiness({ businessId, db }) {
  if (typeof businessId !== 'string' || !businessId.trim() || businessId.includes('/') || businessId.length > 128) {
    throw new HttpsError('invalid-argument', 'invalid-business-id')
  }
  const safeId = businessId.trim()
  const business = await db.doc(`businesses/${safeId}`).get()
  if (!business.exists) throw new HttpsError('not-found', 'business-not-found')
  if (!isPublicBusinessEligible(business.data())) throw new HttpsError('not-found', 'business-not-found')
  const subscription = await db.doc(`businessSubscriptions/${safeId}`).get()
  const projected = toPublicDirectoryBusiness(
    safeId,
    business.data(),
    subscription.exists ? subscription.data() : null,
    subscription.exists,
  )
  if (!projected) throw new HttpsError('not-found', 'business-not-found')
  return { business: projected }
}
