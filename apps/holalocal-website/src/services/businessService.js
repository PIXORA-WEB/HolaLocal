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
  manageBusinessMediaCallable,
} from '../firebase/functionsClient.js'
import { createApplicationError } from '../utils/frontendErrors.js'
import {
  hasCompletePublicBusinessProfile,
  isCanonicalBusinessGalleryPath,
  parseLegacyFirebaseBusinessMediaUrl,
  projectPublicContact,
  validateBusinessLocation,
} from '@holalocal/firebase-contract'
import {
  resolveWebsiteBusinessLookup,
  toManagedBusinessView,
} from './firebaseCompatibility.js'
import { isOwnerEditableBusinessStatus } from '../utils/business.js'
import { clearBusinessMediaPresentationCache, resolveBusinessMediaPresentation } from './businessMediaPresentation.js'
import {
  runBusinessGalleryUploads,
  runBusinessLogoUpload,
  selectAvailableCanonicalGallerySlot,
} from './businessMediaWorkflow.js'

async function deleteImageFile(...args) {
  const storage = await import('../firebase/storageClient.js')
  return storage.deleteImageFile(...args)
}

async function uploadCanonicalImageFile(...args) {
  const storage = await import('../firebase/storageClient.js')
  return storage.uploadCanonicalImageFile(...args)
}

const BUSINESS_MEDIA_ACTIONS = new Set([
  'prepare-logo', 'finalize-logo', 'prepare-gallery', 'finalize-gallery',
  'remove-gallery', 'clear-logo',
])
export { selectAvailableCanonicalGallerySlot }

export async function finalizeBusinessMedia(action, businessId, storagePath, options = {}, callable = manageBusinessMediaCallable) {
  if (!BUSINESS_MEDIA_ACTIONS.has(action)) throw createApplicationError('media-save-failed')
  const payload = { action, businessId, storagePath, ...options }
  const result = await callable(payload)
  return result.data
}

async function presentBusiness(business) {
  return business?.businessId
    ? resolveBusinessMediaPresentation(business.businessId, business)
    : business
}

async function presentManagedBusiness(business) {
  if (!business?.businessId) return business
  const presented = await presentBusiness(business)
  try {
    return { ...presented, entitlements: await getOwnerSubscriptionStatus(business.businessId) }
  } catch {
    return presented
  }
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
  const businesses = Array.isArray(result.data?.businesses)
    ? result.data.businesses.filter((business) => business?.businessId && business?.name) : []
  return Promise.all(businesses.map(presentBusiness))
}

export async function getFeaturedActiveBusinesses(maxResults = 60) {
  const businesses = await getActivePublicBusinesses(maxResults)
  return businesses.filter((business) => business.profileComplete)
}

export async function getPublicBusinessById(businessId) {
  try {
    const result = await getPublicBusinessCallable({ businessId })
    return presentBusiness(result.data?.business ?? null)
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
  return snapshot.exists() ? presentManagedBusiness(toManagedBusinessView(snapshot.id, snapshot.data())) : null
}

async function getManagedBusinessById(businessId) {
  const [businessSnapshot, privateSnapshot] = await Promise.all([
    getDoc(businessDocument(businessId)),
    getDoc(privateBusinessDocument(businessId)),
  ])
  if (!businessSnapshot.exists()) return null
  return presentManagedBusiness(toManagedBusinessView(
    businessSnapshot.id,
    businessSnapshot.data(),
    privateSnapshot.exists() ? privateSnapshot.data() : null,
  ))
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

export async function uploadBusinessLogo(businessId, file, dependencies = {}) {
  const getBusiness = dependencies.getBusiness ?? getBusinessById
  const upload = dependencies.upload ?? uploadCanonicalImageFile
  const prepare = dependencies.prepare ?? finalizeBusinessMedia
  const finalize = dependencies.finalize ?? finalizeBusinessMedia
  const remove = dependencies.remove ?? deleteImageFile
  const result = await runBusinessLogoUpload(businessId, file, { getBusiness, upload, prepare, finalize, remove })
  clearBusinessMediaPresentationCache()
  return result
}

export async function uploadBusinessGalleryImages(businessId, files, dependencies = {}) {
  const getBusiness = dependencies.getBusiness ?? getBusinessById
  const upload = dependencies.upload ?? uploadCanonicalImageFile
  const prepare = dependencies.prepare ?? finalizeBusinessMedia
  const finalize = dependencies.finalize ?? finalizeBusinessMedia
  const result = await runBusinessGalleryUploads(businessId, files, { getBusiness, upload, prepare, finalize })
  clearBusinessMediaPresentationCache()
  return result
}

export async function deleteBusinessGalleryImage(businessId, image, dependencies = {}) {
  const getBusiness = dependencies.getBusiness ?? getBusinessById
  const finalize = dependencies.finalize ?? finalizeBusinessMedia
  const remove = dependencies.remove ?? deleteImageFile
  if (image?.kind === 'canonical' && isCanonicalBusinessGalleryPath(image.storagePath, businessId)) {
    await finalize('remove-gallery', businessId, image.storagePath)
    return getBusiness(businessId)
  }
  const legacy = parseLegacyFirebaseBusinessMediaUrl(image?.downloadUrl, businessId)
  if (legacy?.kind !== 'gallery') throw createApplicationError('media-delete-failed')
  const existingBusiness = await getBusinessById(businessId)
  const remainingLegacy = (existingBusiness?.legacyGalleryEntries ?? []).filter(
    (candidate) => candidate.storagePath !== legacy.storagePath,
  )
  const updatedBusiness = await updateBusinessProfile(businessId, {
    galleryImages: remainingLegacy.map(({ downloadUrl, storagePath }) => ({ downloadUrl, storagePath })),
    galleryImageURLs: remainingLegacy.map(({ downloadUrl }) => downloadUrl),
  })
  await remove(legacy.storagePath).catch(() => undefined)
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
