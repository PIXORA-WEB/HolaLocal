import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/firestoreClient.js'
import { createBusinessSlug } from '../utils/business.js'

async function uploadImageFile(...args) {
  const storage = await import('../firebase/storageClient.js')
  return storage.uploadImageFile(...args)
}

async function deleteImageFile(...args) {
  const storage = await import('../firebase/storageClient.js')
  return storage.deleteImageFile(...args)
}

export const BUSINESS_STATUSES = [
  'draft',
  'pending_review',
  'active',
  'suspended',
  'archived',
  'deleted',
]

const CONTACT_METHODS = ['holalocal', 'phone', 'email', 'whatsapp']
const editableBusinessFields = new Set([
  'name',
  'tagline',
  'description',
  'primaryCategoryId',
  'categoryIds',
  'contact',
  'location',
  'serviceAreas',
  'serviceRadiusKm',
  'languages',
  'primaryLanguage',
  'profilePhoto',
  'galleryImageURLs',
  'galleryImages',
  'profileCompleted',
])

function businessDocument(businessId) {
  if (!businessId) throw new Error('A business ID is required.')
  return doc(db, 'businesses', businessId)
}

function privateBusinessDocument(businessId) {
  return doc(db, 'businessPrivate', businessId)
}

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function getStringList(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))]
    : []
}

function sanitizeContact(contact = {}) {
  const preferredContactMethod = CONTACT_METHODS.includes(contact.preferredContactMethod)
    ? contact.preferredContactMethod
    : 'holalocal'

  return {
    phone: String(contact.phone ?? '').trim(),
    phoneVisible: contact.phoneVisible === true,
    email: String(contact.email ?? '').trim(),
    emailVisible: contact.emailVisible === true,
    whatsappNumber: String(contact.whatsappNumber ?? '').trim(),
    whatsappVisible: contact.whatsappVisible === true,
    website: String(contact.website ?? '').trim(),
    preferredContactMethod,
    allowCallbackRequests: contact.allowCallbackRequests === true,
  }
}

function sanitizeLocation(location = {}) {
  return {
    locality: String(location.locality ?? '').trim(),
    region: String(location.region ?? '').trim(),
    countryCode: String(location.countryCode ?? 'ES').trim().toUpperCase(),
  }
}

function sanitizeBusinessData(businessData) {
  const safeData = Object.fromEntries(
    Object.entries(businessData).filter(
      ([field, value]) => editableBusinessFields.has(field) && value !== undefined,
    ),
  )

  if (safeData.contact) safeData.contact = sanitizeContact(safeData.contact)
  if (safeData.location) safeData.location = sanitizeLocation(safeData.location)
  if (safeData.name !== undefined) {
    safeData.name = safeData.name.trim()
    safeData.nameNormalized = normalize(safeData.name)
    safeData.slug = createBusinessSlug(safeData.name)
  }
  if (safeData.categoryIds) safeData.categoryIds = getStringList(safeData.categoryIds)
  if (safeData.serviceAreas) safeData.serviceAreas = getStringList(safeData.serviceAreas)
  if (safeData.languages) safeData.languages = getStringList(safeData.languages)
  if (safeData.languages?.length) {
    safeData.primaryLanguage = safeData.languages.find(
      (language) => normalize(language) === normalize(safeData.primaryLanguage),
    ) ?? safeData.languages[0]
  }

  return safeData
}

function withBusinessId(snapshot) {
  return snapshot.exists() ? { businessId: snapshot.id, ...snapshot.data() } : null
}

function publicContact(contact = {}) {
  return {
    phone: contact.phoneVisible === true ? contact.phone ?? '' : '',
    email: contact.emailVisible === true ? contact.email ?? '' : '',
    whatsappNumber: contact.whatsappVisible === true ? contact.whatsappNumber ?? '' : '',
    website: contact.website ?? '',
    preferredContactMethod: contact.preferredContactMethod ?? 'holalocal',
    allowCallbackRequests: contact.allowCallbackRequests === true,
  }
}

function storedPublicContact(contact = {}) {
  const sanitized = sanitizeContact(contact)
  return {
    ...sanitized,
    phone: sanitized.phoneVisible ? sanitized.phone : '',
    email: sanitized.emailVisible ? sanitized.email : '',
    whatsappNumber: sanitized.whatsappVisible ? sanitized.whatsappNumber : '',
  }
}

function toPublicBusiness(snapshot) {
  const business = snapshot.data()
  const languages = getStringList(business.languages)
  const locality = business.location?.locality ?? ''

  return {
    businessId: snapshot.id,
    ownerId: business.ownerId,
    name: business.name ?? '',
    category: business.primaryCategoryId ?? '',
    serviceArea: locality || business.serviceAreas?.[0] || '',
    serviceAreas: getStringList(business.serviceAreas),
    languages,
    primaryLanguage: business.primaryLanguage ?? languages[0] ?? '',
    description: business.description ?? '',
    tagline: business.tagline ?? '',
    services: getStringList(business.categoryIds),
    galleryUrls: getStringList(business.galleryImageURLs),
    contact: publicContact(business.contact),
    status: business.status,
    verificationStatus: business.verificationStatus ?? 'unverified',
    subscriptionTier: business.subscription?.tier ?? 'free',
    subscriptionStatus: business.subscription?.status ?? 'none',
    ratingAverage: typeof business.ratingAverage === 'number' ? business.ratingAverage : null,
    ratingCount: typeof business.ratingCount === 'number' ? business.ratingCount : 0,
    logoUrl: business.profilePhoto?.downloadUrl ?? null,
    profileComplete: business.profileCompleted === true,
  }
}

export async function getActivePublicBusinesses(maxResults = 60) {
  const resultLimit = Math.min(Math.max(Number(maxResults) || 1, 1), 100)
  const snapshot = await getDocs(query(
    collection(db, 'businesses'),
    where('status', '==', 'active'),
    firestoreLimit(resultLimit),
  ))

  return snapshot.docs.map(toPublicBusiness).filter((business) => business.name)
}

export async function getFeaturedActiveBusinesses(maxResults = 60) {
  const businesses = await getActivePublicBusinesses(maxResults)
  return businesses.filter((business) => business.profileComplete)
}

export async function getPublicBusinessById(businessId) {
  const snapshot = await getDoc(businessDocument(businessId))
  if (!snapshot.exists() || snapshot.data().status !== 'active') return null
  return toPublicBusiness(snapshot)
}

function buildNewBusiness(ownerId, businessData = {}) {
  const safeData = sanitizeBusinessData(businessData)
  const languages = safeData.languages?.length ? safeData.languages : ['en']

  return {
    ownerId,
    managerIds: [ownerId],
    name: '',
    nameNormalized: '',
    slug: '',
    tagline: '',
    description: '',
    primaryCategoryId: '',
    categoryIds: [],
    serviceAreas: [],
    serviceRadiusKm: 20,
    location: sanitizeLocation(),
    contact: sanitizeContact(),
    languages,
    primaryLanguage: languages[0],
    profilePhoto: null,
    galleryImageURLs: [],
    galleryImages: [],
    galleryCount: 0,
    ratingAverage: 0,
    ratingCount: 0,
    status: 'draft',
    verificationStatus: 'unverified',
    verifiedAt: null,
    subscription: {
      tier: 'free',
      status: 'none',
      provider: null,
      currentPeriodEnd: null,
    },
    profileCompleted: false,
    publishedAt: null,
    deletionRequestedAt: null,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...safeData,
  }
}

export async function getBusinessById(businessId) {
  return withBusinessId(await getDoc(businessDocument(businessId)))
}

async function getManagedBusinessById(businessId) {
  const [businessSnapshot, privateSnapshot] = await Promise.all([
    getDoc(businessDocument(businessId)),
    getDoc(privateBusinessDocument(businessId)),
  ])
  const business = withBusinessId(businessSnapshot)
  if (!business) return null
  return privateSnapshot.exists()
    ? { ...business, contact: privateSnapshot.data().contact ?? business.contact }
    : business
}

export async function getBusinessByOwnerId(ownerId) {
  if (!ownerId) return null
  const snapshot = await getDocs(query(
    collection(db, 'businesses'),
    where('ownerId', '==', ownerId),
    firestoreLimit(1),
  ))
  return snapshot.empty ? null : getManagedBusinessById(snapshot.docs[0].id)
}

export async function createBusinessProfile(ownerId, businessData = {}) {
  const existingBusiness = await getBusinessByOwnerId(ownerId)
  if (existingBusiness) return existingBusiness

  const reference = doc(collection(db, 'businesses'))
  const business = buildNewBusiness(ownerId, businessData)
  const privateContact = sanitizeContact(businessData.contact)
  business.contact = storedPublicContact(privateContact)
  await runTransaction(db, async (transaction) => {
    transaction.set(reference, business)
    transaction.set(privateBusinessDocument(reference.id), {
      ownerId,
      managerIds: [ownerId],
      contact: privateContact,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
  return getManagedBusinessById(reference.id)
}

export async function updateBusinessProfile(businessId, updates) {
  const safeUpdates = sanitizeBusinessData(updates)
  const privateContact = safeUpdates.contact
  if (privateContact) safeUpdates.contact = storedPublicContact(privateContact)

  await runTransaction(db, async (transaction) => {
    const businessRef = businessDocument(businessId)
    const privateRef = privateBusinessDocument(businessId)
    const [businessSnapshot, privateSnapshot] = await Promise.all([
      transaction.get(businessRef),
      transaction.get(privateRef),
    ])
    if (!businessSnapshot.exists()) throw new Error('Business profile not found.')

    const business = businessSnapshot.data()
    const privateUpdates = {
      ownerId: business.ownerId,
      managerIds: business.managerIds ?? [business.ownerId],
      updatedAt: serverTimestamp(),
    }
    if (privateContact) privateUpdates.contact = privateContact
    if (!privateSnapshot.exists()) {
      privateUpdates.contact ??= sanitizeContact(business.contact)
      privateUpdates.createdAt = serverTimestamp()
    }

    transaction.update(businessRef, {
      ...safeUpdates,
      updatedAt: serverTimestamp(),
    })
    transaction.set(privateRef, privateUpdates, { merge: true })
  })
  return getManagedBusinessById(businessId)
}

export async function uploadBusinessLogo(businessId, file) {
  const existingBusiness = await getBusinessById(businessId)
  const uploadedLogo = await uploadImageFile(`businesses/${businessId}/logos`, file)

  try {
    const updatedBusiness = await updateBusinessProfile(businessId, {
      profilePhoto: { ...uploadedLogo, updatedAt: new Date().toISOString() },
    })
    if (existingBusiness?.profilePhoto?.storagePath) {
      await deleteImageFile(existingBusiness.profilePhoto.storagePath).catch(() => undefined)
    }
    return updatedBusiness
  } catch (error) {
    await deleteImageFile(uploadedLogo.storagePath).catch(() => undefined)
    throw error
  }
}

export async function uploadBusinessGalleryImages(businessId, files) {
  const existingBusiness = await getBusinessById(businessId)
  const uploadedImages = []

  try {
    for (const file of files) {
      const image = await uploadImageFile(`businesses/${businessId}/photos`, file)
      uploadedImages.push({ ...image, updatedAt: new Date().toISOString() })
    }
    const galleryImages = [...(existingBusiness?.galleryImages ?? []), ...uploadedImages].slice(0, 8)
    return updateBusinessProfile(businessId, {
      galleryImages,
      galleryImageURLs: galleryImages.map(({ downloadUrl }) => downloadUrl),
    })
  } catch (error) {
    await Promise.all(uploadedImages.map(({ storagePath }) => deleteImageFile(storagePath).catch(() => undefined)))
    throw error
  }
}

export async function deleteBusinessGalleryImage(businessId, image) {
  const existingBusiness = await getBusinessById(businessId)
  const galleryImages = (existingBusiness?.galleryImages ?? []).filter(
    (candidate) => candidate.storagePath !== image.storagePath && candidate.downloadUrl !== image.downloadUrl,
  )
  const updatedBusiness = await updateBusinessProfile(businessId, {
    galleryImages,
    galleryImageURLs: galleryImages.map(({ downloadUrl }) => downloadUrl),
  })
  if (image.storagePath) await deleteImageFile(image.storagePath).catch(() => undefined)
  return updatedBusiness
}

export async function ensureBusinessProfile(ownerId, userProfile) {
  if (!userProfile?.roles?.includes('business')) {
    throw new Error('A business role is required to create a business profile.')
  }

  return (await getBusinessByOwnerId(ownerId)) ?? createBusinessProfile(ownerId, {
    contact: { email: userProfile.email ?? '' },
    location: {
      locality: userProfile.city ?? '',
      countryCode: userProfile.country === 'Spain' ? 'ES' : '',
    },
    languages: [userProfile.preferredLocale ?? 'en'],
  })
}
