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
import {
  ensureOwnerBusinessCallable,
  getOwnerSubscriptionStatusCallable,
  getPublicBusinessCallable,
  listPublicBusinessesCallable,
} from '../firebase/functionsClient.js'
import { createApplicationError } from '../utils/frontendErrors.js'
import {
  hasCompletePublicBusinessProfile,
  projectPublicContact,
  validateBusinessLocation,
} from '@holalocal/firebase-contract'
import {
  resolveWebsiteBusinessLookup,
  toManagedBusinessView,
} from './firebaseCompatibility.js'
import { isOwnerEditableBusinessStatus } from '../utils/business.js'

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
  'rejected',
  'active',
  'suspended',
  'archived',
  'deleted',
]

const CONTACT_METHODS = ['holalocal', 'phone', 'email', 'whatsapp']
const MAX_OWNER_CANDIDATES = 21
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
    websiteVisible: contact.websiteVisible === true,
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

function storedPublicContact(contact = {}) {
  return projectPublicContact(sanitizeContact(contact)).contact
}

export async function getActivePublicBusinesses(maxResults = 60) {
  const resultLimit = Math.min(Math.max(Number(maxResults) || 1, 1), 100)
  const result = await listPublicBusinessesCallable({ maxResults: resultLimit })
  return Array.isArray(result.data?.businesses)
    ? result.data.businesses.filter((business) => business?.businessId && business?.name)
    : []
}

export async function getFeaturedActiveBusinesses(maxResults = 60) {
  const businesses = await getActivePublicBusinesses(maxResults)
  return businesses.filter((business) => business.profileComplete)
}

export async function getPublicBusinessById(businessId) {
  try {
    const result = await getPublicBusinessCallable({ businessId })
    return result.data?.business ?? null
  } catch (error) {
    if (error?.code?.includes('not-found')) return null
    throw error
  }
}

export async function getOwnerSubscriptionStatus(businessId) {
  const result = await getOwnerSubscriptionStatusCallable({ businessId })
  return result.data
}

export async function getBusinessById(businessId) {
  const snapshot = await getDoc(businessDocument(businessId))
  return snapshot.exists() ? toManagedBusinessView(snapshot.id, snapshot.data()) : null
}

async function getManagedBusinessById(businessId) {
  const [businessSnapshot, privateSnapshot] = await Promise.all([
    getDoc(businessDocument(businessId)),
    getDoc(privateBusinessDocument(businessId)),
  ])
  if (!businessSnapshot.exists()) return null
  return toManagedBusinessView(
    businessSnapshot.id,
    businessSnapshot.data(),
    privateSnapshot.exists() ? privateSnapshot.data() : null,
  )
}

async function candidateById(businessId, source, { missingIsInvalid = false, permissionDeniedIsInvalid = false } = {}) {
  if (!businessId) return { candidate: null, invalid: false }
  try {
    const snapshot = await getDoc(businessDocument(businessId))
    if (!snapshot.exists()) return { candidate: null, invalid: missingIsInvalid }
    return {
      candidate: {
        businessId: snapshot.id,
        ownerId: snapshot.data().ownerId,
        source,
        document: snapshot.data(),
      },
      invalid: false,
    }
  } catch (error) {
    if (error?.code === 'permission-denied') {
      return { candidate: null, invalid: permissionDeniedIsInvalid }
    }
    throw error
  }
}

export async function getManagedBusinessLookup(ownerId, userBusinessId = null) {
  if (!ownerId) return resolveWebsiteBusinessLookup({ ownerId })
  const pointerResult = userBusinessId
    ? await candidateById(userBusinessId, 'user_business_id', {
      missingIsInvalid: true,
      permissionDeniedIsInvalid: true,
    })
    : { candidate: null, invalid: false }
  const uidResult = userBusinessId === ownerId
    ? pointerResult
    : await candidateById(ownerId, 'owner_uid_document')
  const snapshot = await getDocs(query(
    collection(db, 'businesses'),
    where('ownerId', '==', ownerId),
    firestoreLimit(MAX_OWNER_CANDIDATES),
  ))
  const resolved = resolveWebsiteBusinessLookup({
    ownerId,
    pointerCandidate: pointerResult.candidate,
    uidCandidate: uidResult.candidate,
    ownerCandidates: snapshot.docs.map((businessSnapshot) => ({
      businessId: businessSnapshot.id,
      ownerId: businessSnapshot.data().ownerId,
      source: 'owner_id_query',
      document: businessSnapshot.data(),
    })),
    pointerInvalid: pointerResult.invalid,
    uidInvalid: uidResult.invalid,
  })
  if (resolved.lookup.status !== 'found') return { ...resolved, business: null }
  return {
    ...resolved,
    business: await getManagedBusinessById(resolved.lookup.businessId),
  }
}

export async function getBusinessByOwnerId(ownerId, userBusinessId = null) {
  const result = await getManagedBusinessLookup(ownerId, userBusinessId)
  if (result.lookup.status === 'found') return result.business
  if (result.lookup.status === 'not_found') return null
  const error = new Error('Business ownership could not be resolved safely.')
  error.code = result.lookup.status === 'ambiguous'
    ? 'business/ambiguous-ownership'
    : 'business/invalid-ownership'
  throw error
}

export async function createBusinessProfile() {
  const result = await ensureOwnerBusinessCallable()
  const businessId = result.data?.businessId
  if (!businessId) throw createApplicationError('business-create-failed')
  return getManagedBusinessById(businessId)
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

export async function submitBusinessForReview(businessId) {
  await runTransaction(db, async (transaction) => {
    const businessRef = businessDocument(businessId)
    const privateRef = privateBusinessDocument(businessId)
    const [snapshot, privateSnapshot] = await Promise.all([
      transaction.get(businessRef),
      transaction.get(privateRef),
    ])
    if (!snapshot.exists()) throw createApplicationError('business-submit-not-found')
    const business = snapshot.data()
    if (!isOwnerEditableBusinessStatus(business.status)) {
      throw createApplicationError('business-submit-invalid-state')
    }
    if (
      !hasCompletePublicBusinessProfile(business)
      || !validateBusinessLocation(business).valid
    ) {
      throw createApplicationError('business-submit-incomplete')
    }
    transaction.update(businessRef, {
      status: 'pending_review',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    if (business.status === 'rejected' && privateSnapshot.exists()) {
      transaction.update(privateRef, {
        currentRejection: null,
        updatedAt: serverTimestamp(),
      })
    }
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
  } catch {
    await deleteImageFile(uploadedLogo.storagePath).catch(() => undefined)
    throw createApplicationError('media-save-failed')
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
  } catch (error) {
    await Promise.all(uploadedImages.map(({ storagePath }) => deleteImageFile(storagePath).catch(() => undefined)))
    throw error
  }

  const galleryImages = [...(existingBusiness?.galleryImages ?? []), ...uploadedImages].slice(0, 8)
  try {
    return await updateBusinessProfile(businessId, {
      galleryImages,
      galleryImageURLs: galleryImages.map(({ downloadUrl }) => downloadUrl),
    })
  } catch {
    await Promise.all(uploadedImages.map(({ storagePath }) => deleteImageFile(storagePath).catch(() => undefined)))
    throw createApplicationError('media-save-failed')
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

  if (userProfile.businessId) {
    const existingBusiness = await getManagedBusinessById(userProfile.businessId)
    if (existingBusiness) return existingBusiness
    const error = new Error('Business ownership could not be resolved safely.')
    error.code = 'business/invalid-ownership'
    throw error
  }
  return createBusinessProfile()
}
