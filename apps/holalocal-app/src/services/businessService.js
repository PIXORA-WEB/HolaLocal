// Owns Firestore operations for the single business profile associated with a user.
// The owner UID is also used as the document ID to prevent duplicate profiles.
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { createBusinessSlug } from '../utils/business.js'

const editableBusinessFields = new Set([
  'businessName',
  'tagline',
  'description',
  'mainCategory',
  'subcategories',
  'phone',
  'whatsapp',
  'email',
  'website',
  'city',
  'province',
  'country',
  'serviceAreas',
  'serviceRadiusKm',
  'languages',
  'primaryLanguage',
  'isActive',
  'isVerified',
  'isPremium',
  'subscriptionTier',
  'profileCompleted',
])

function businessDocument(businessId) {
  if (!businessId) throw new Error('A business ID is required.')
  return doc(db, 'businesses', businessId)
}

function sanitizeBusinessData(businessData) {
  return Object.fromEntries(
    Object.entries(businessData).filter(
      ([field, value]) => editableBusinessFields.has(field) && value !== undefined,
    ),
  )
}

function buildNewBusiness(ownerId, businessData = {}) {
  const safeData = sanitizeBusinessData(businessData)
  const businessName = safeData.businessName ?? ''
  const languages = safeData.languages?.length > 0 ? safeData.languages : ['English']
  const primaryLanguage =
    languages.find(
      (language) => language.toLowerCase() === safeData.primaryLanguage?.toLowerCase(),
    ) ?? languages[0]

  return {
    businessId: ownerId,
    ownerId,
    businessName,
    slug: createBusinessSlug(businessName),
    tagline: '',
    description: '',
    mainCategory: '',
    subcategories: [],
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    city: '',
    province: '',
    country: 'Spain',
    serviceAreas: [],
    serviceRadiusKm: 20,
    logoURL: null,
    coverImageURL: null,
    galleryImageURLs: [],
    isActive: true,
    isVerified: false,
    isPremium: false,
    subscriptionTier: 'free',
    profileCompleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...safeData,
    languages,
    primaryLanguage,
  }
}

export async function getBusinessById(businessId) {
  const snapshot = await getDoc(businessDocument(businessId))
  return snapshot.exists() ? snapshot.data() : null
}

export function getBusinessByOwnerId(ownerId) {
  return getBusinessById(ownerId)
}

export async function createBusinessProfile(ownerId, businessData = {}) {
  const reference = businessDocument(ownerId)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)

    if (!snapshot.exists()) {
      transaction.set(reference, buildNewBusiness(ownerId, businessData))
    }
  })

  return getBusinessById(ownerId)
}

export async function updateBusinessProfile(businessId, updates) {
  const safeUpdates = sanitizeBusinessData(updates)

  if (safeUpdates.businessName !== undefined) {
    safeUpdates.slug = createBusinessSlug(safeUpdates.businessName)
  }

  if (safeUpdates.languages?.length > 0) {
    safeUpdates.primaryLanguage =
      safeUpdates.languages.find(
        (language) => language.toLowerCase() === safeUpdates.primaryLanguage?.toLowerCase(),
      ) ?? safeUpdates.languages[0]
  }

  await updateDoc(businessDocument(businessId), {
    ...safeUpdates,
    updatedAt: serverTimestamp(),
  })

  return getBusinessById(businessId)
}

export async function ensureBusinessProfile(ownerId, userProfile) {
  if (!userProfile?.roles?.includes('business')) {
    throw new Error('A business role is required to create a business profile.')
  }

  const existingBusiness = await getBusinessByOwnerId(ownerId)

  if (!existingBusiness) {
    return createBusinessProfile(ownerId, {
      email: userProfile.email ?? '',
      city: userProfile.city ?? '',
      country: userProfile.country ?? 'Spain',
      languages: [userProfile.preferredLanguage ?? 'English'],
    })
  }

  const defaults = buildNewBusiness(ownerId, {
    businessName: existingBusiness.businessName ?? '',
    languages: existingBusiness.languages?.length > 0 ? existingBusiness.languages : ['English'],
  })
  const missingFields = Object.fromEntries(
    Object.entries(defaults).filter(([field]) => !Object.hasOwn(existingBusiness, field)),
  )

  if (Object.keys(missingFields).length > 0) {
    await updateDoc(businessDocument(existingBusiness.businessId), {
      ...missingFields,
      updatedAt: serverTimestamp(),
    })
    return getBusinessById(existingBusiness.businessId)
  }

  return existingBusiness
}
