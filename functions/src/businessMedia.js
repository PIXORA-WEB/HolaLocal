import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  isCanonicalBusinessGalleryPath,
  isCanonicalBusinessLogoPath,
  MAX_CANONICAL_BUSINESS_GALLERY_SLOTS,
  parseLegacyFirebaseBusinessMediaUrl,
  PLAN_DEFINITIONS,
  PLAN_IDS,
  resolveAuthoritativeBusinessEntitlements,
} from '@holalocal/firebase-contract'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_STORAGE_METADATA_KEYS = new Set(['firebaseStorageDownloadTokens'])
const EDITABLE_BUSINESS_STATUSES = new Set(['draft', 'rejected'])

export const BUSINESS_MEDIA_ACTIONS = Object.freeze({
  SET_LOGO: 'set-logo',
  ADD_GALLERY: 'add-gallery',
  REMOVE_GALLERY: 'remove-gallery',
  CLEAR_LOGO: 'clear-logo',
})

const ACTION_VALUES = new Set(Object.values(BUSINESS_MEDIA_ACTIONS))

function requireId(value, message) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value !== value.trim()
    || value.includes('/')
    || value.length > 128
  ) throw new HttpsError('invalid-argument', message)
  return value
}

function requireUid(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.includes('/')) {
    throw new HttpsError('unauthenticated', 'auth-required')
  }
  return value
}

function requireAction(value) {
  if (!ACTION_VALUES.has(value)) throw new HttpsError('invalid-argument', 'invalid-business-media-action')
  return value
}

function requireCanonicalPath(action, businessId, storagePath) {
  const valid = action === BUSINESS_MEDIA_ACTIONS.SET_LOGO || action === BUSINESS_MEDIA_ACTIONS.CLEAR_LOGO
    ? isCanonicalBusinessLogoPath(storagePath, businessId)
    : isCanonicalBusinessGalleryPath(storagePath, businessId)
  if (!valid) throw new HttpsError('invalid-argument', 'invalid-canonical-business-media-path')
  return storagePath
}

function assertActiveAccount(snapshot) {
  if (
    !snapshot.exists
    || snapshot.data()?.accountStatus !== 'active'
    || snapshot.data()?.deletionRequestedAt != null
  ) throw new HttpsError('failed-precondition', 'account-not-active')
}

function assertBusinessAuthority(business, uid) {
  const managers = Array.isArray(business?.managerIds) ? business.managerIds : []
  if (business?.ownerId !== uid && !managers.includes(uid)) {
    throw new HttpsError('permission-denied', 'business-management-required')
  }
  if (
    !EDITABLE_BUSINESS_STATUSES.has(business.status)
    || business.deletionRequestedAt != null
    || business.deletedAt != null
  ) throw new HttpsError('failed-precondition', 'business-media-not-editable')
}

function assertCanonicalManifest(businessId, business) {
  const logo = business.logoStoragePath ?? null
  const gallery = business.galleryStoragePaths ?? []
  if (logo !== null && !isCanonicalBusinessLogoPath(logo, businessId)) {
    throw new HttpsError('failed-precondition', 'business-media-manifest-invalid')
  }
  if (
    !Array.isArray(gallery)
    || gallery.length > MAX_CANONICAL_BUSINESS_GALLERY_SLOTS
    || new Set(gallery).size !== gallery.length
    || gallery.some((path) => !isCanonicalBusinessGalleryPath(path, businessId))
  ) throw new HttpsError('failed-precondition', 'business-media-manifest-invalid')
  return { logo, gallery }
}

function validatedLegacyGalleryPaths(businessId, business) {
  const urls = []
  if (Array.isArray(business.galleryImages) && business.galleryImages.length > 0) {
    for (const descriptor of business.galleryImages) {
      if (descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor)) {
        urls.push(descriptor.downloadUrl)
      }
    }
  } else if (Array.isArray(business.galleryImageURLs)) urls.push(...business.galleryImageURLs)

  const paths = new Set()
  for (const url of urls) {
    const parsed = parseLegacyFirebaseBusinessMediaUrl(url, businessId)
    if (parsed?.kind === 'gallery') paths.add(parsed.storagePath)
  }
  return paths
}

function authoritativeGalleryLimit(privateSubscriptionSnapshot, business) {
  const entitlements = resolveAuthoritativeBusinessEntitlements(
    privateSubscriptionSnapshot.exists ? privateSubscriptionSnapshot.data() : null,
    business.subscription,
    { privateRecordExists: privateSubscriptionSnapshot.exists },
  )
  const plan = PLAN_DEFINITIONS[entitlements.effectivePlanId ?? PLAN_IDS.EARLY_ACCESS]
    ?? PLAN_DEFINITIONS[PLAN_IDS.EARLY_ACCESS]
  const limit = plan.limits.galleryImages
  if (!Number.isInteger(limit) || limit < 0) {
    throw new HttpsError('failed-precondition', 'business-gallery-entitlement-invalid')
  }
  return Math.min(limit, MAX_CANONICAL_BUSINESS_GALLERY_SLOTS)
}

function assertGalleryAdditionAllowed({ businessId, business, gallery, storagePath, subscription }) {
  if (gallery.includes(storagePath)) return
  const legacyCount = validatedLegacyGalleryPaths(businessId, business).size
  const referencedCount = legacyCount + gallery.length
  const limit = authoritativeGalleryLimit(subscription, business)
  if (referencedCount >= limit) {
    throw new HttpsError('resource-exhausted', 'business-gallery-limit-reached')
  }
}

function customMetadataKeys(metadata) {
  const custom = metadata?.metadata
  if (custom == null) return []
  if (typeof custom !== 'object' || Array.isArray(custom)) return null
  return Object.keys(custom)
}

export function validateCanonicalStorageObjectMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new HttpsError('failed-precondition', 'business-media-object-missing')
  }
  if (!ALLOWED_IMAGE_TYPES.has(metadata.contentType)) {
    throw new HttpsError('failed-precondition', 'business-media-invalid-content-type')
  }
  const validSizeShape = Number.isInteger(metadata.size)
    || (typeof metadata.size === 'string' && /^[0-9]+$/.test(metadata.size))
  const size = validSizeShape ? Number(metadata.size) : Number.NaN
  if (!Number.isInteger(size) || size < 0 || size >= MAX_IMAGE_BYTES) {
    throw new HttpsError('failed-precondition', 'business-media-invalid-size')
  }
  const metadataKeys = customMetadataKeys(metadata)
  if (!metadataKeys || metadataKeys.some((key) => !ALLOWED_STORAGE_METADATA_KEYS.has(key))) {
    throw new HttpsError('failed-precondition', 'business-media-forbidden-metadata')
  }
}

function storageNotFound(error) {
  return error?.code === 404
    || error?.code === '404'
    || error?.code === 'storage/object-not-found'
    || error?.code === 'not-found'
}

async function defaultReadObjectMetadata(storagePath) {
  try {
    const [metadata] = await getStorage().bucket().file(storagePath).getMetadata()
    return metadata
  } catch (error) {
    if (storageNotFound(error)) {
      throw new HttpsError('failed-precondition', 'business-media-object-missing')
    }
    throw error
  }
}

async function defaultDeleteObject(storagePath) {
  try {
    await getStorage().bucket().file(storagePath).delete()
    return 'deleted'
  } catch (error) {
    if (storageNotFound(error)) return 'not-found'
    return 'failed'
  }
}

function publicResult({ action, storagePath, idempotent, objectDeletion = 'not-requested' }) {
  return { ok: true, action, storagePath, idempotent, objectDeletion }
}

export async function manageBusinessMedia({
  uid,
  action,
  businessId,
  storagePath,
  db,
  readObjectMetadata = defaultReadObjectMetadata,
  deleteObject = defaultDeleteObject,
}) {
  const safeUid = requireUid(uid)
  const safeAction = requireAction(action)
  const safeBusinessId = requireId(businessId, 'invalid-business-id')
  const safeStoragePath = requireCanonicalPath(safeAction, safeBusinessId, storagePath)
  const adding = safeAction === BUSINESS_MEDIA_ACTIONS.SET_LOGO
    || safeAction === BUSINESS_MEDIA_ACTIONS.ADD_GALLERY

  const userRef = db.doc(`users/${safeUid}`)
  const businessRef = db.doc(`businesses/${safeBusinessId}`)
  const subscriptionRef = db.doc(`businessSubscriptions/${safeBusinessId}`)
  const [initialUser, initialBusiness] = await Promise.all([userRef.get(), businessRef.get()])
  assertActiveAccount(initialUser)
  if (!initialBusiness.exists) throw new HttpsError('not-found', 'business-not-found')
  assertBusinessAuthority(initialBusiness.data(), safeUid)

  if (adding) {
    let metadata
    try {
      metadata = await readObjectMetadata(safeStoragePath)
    } catch (error) {
      if (error instanceof HttpsError) throw error
      if (storageNotFound(error)) {
        throw new HttpsError('failed-precondition', 'business-media-object-missing')
      }
      throw new HttpsError('internal', 'business-media-object-verification-failed')
    }
    validateCanonicalStorageObjectMetadata(metadata)
  }

  let idempotent = false

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, businessSnapshot, subscriptionSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(businessRef),
      transaction.get(subscriptionRef),
    ])
    assertActiveAccount(userSnapshot)
    if (!businessSnapshot.exists) throw new HttpsError('not-found', 'business-not-found')
    const business = businessSnapshot.data()
    assertBusinessAuthority(business, safeUid)
    const { logo, gallery } = assertCanonicalManifest(safeBusinessId, business)

    if (safeAction === BUSINESS_MEDIA_ACTIONS.SET_LOGO) {
      idempotent = logo === safeStoragePath
      if (!idempotent) transaction.update(businessRef, { logoStoragePath: safeStoragePath })
      return
    }
    if (safeAction === BUSINESS_MEDIA_ACTIONS.ADD_GALLERY) {
      idempotent = gallery.includes(safeStoragePath)
      assertGalleryAdditionAllowed({
        businessId: safeBusinessId,
        business,
        gallery,
        storagePath: safeStoragePath,
        subscription: subscriptionSnapshot,
      })
      if (!idempotent) transaction.update(businessRef, {
        galleryStoragePaths: [...gallery, safeStoragePath],
      })
      return
    }
    if (safeAction === BUSINESS_MEDIA_ACTIONS.REMOVE_GALLERY) {
      idempotent = !gallery.includes(safeStoragePath)
      if (!idempotent) transaction.update(businessRef, {
        galleryStoragePaths: gallery.filter((path) => path !== safeStoragePath),
      })
      return
    }

    idempotent = logo !== safeStoragePath
    if (!idempotent) transaction.update(businessRef, { logoStoragePath: null })
  })

  if (adding) return publicResult({ action: safeAction, storagePath: safeStoragePath, idempotent })
  let objectDeletion
  try {
    objectDeletion = await deleteObject(safeStoragePath)
  } catch {
    objectDeletion = 'failed'
  }
  return publicResult({
    action: safeAction,
    storagePath: safeStoragePath,
    idempotent,
    objectDeletion: ['deleted', 'not-found'].includes(objectDeletion) ? objectDeletion : 'failed',
  })
}
