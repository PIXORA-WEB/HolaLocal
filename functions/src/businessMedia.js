import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  isCanonicalBusinessGalleryPath,
  isCanonicalBusinessLogoPath,
  buildCanonicalBusinessGallerySlotPath,
  buildCanonicalBusinessLogoSlotPath,
  inactiveCanonicalMediaSlot,
  parseCanonicalMediaPath,
  MAX_CANONICAL_BUSINESS_GALLERY_SLOTS,
  parseLegacyFirebaseBusinessMediaUrl,
  PLAN_DEFINITIONS,
  PLAN_IDS,
  resolveAuthoritativeBusinessEntitlements,
  buildStagingBusinessGalleryPath,
  buildStagingBusinessLogoPath,
} from '@holalocal/firebase-contract'
import {
  cleanStagingGeneration,
  clearPromotionContext,
  deleteExactGeneration,
  promoteCleanGeneration,
  verifyCanonicalImageMetadata,
  uploadSessionMarker,
} from './canonicalMediaStorage.js'
import {
  assertFinalizableSession, businessSessionId, MEDIA_SESSION_COLLECTION,
  markStagingGenerationClean, prepareBoundedMediaSession, recordFinalizedStagingGeneration,
} from './mediaUploadSessions.js'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_STORAGE_METADATA_KEYS = new Set()
const EDITABLE_BUSINESS_STATUSES = new Set(['draft', 'rejected'])

export const BUSINESS_MEDIA_ACTIONS = Object.freeze({
  SET_LOGO: 'set-logo',
  ADD_GALLERY: 'add-gallery',
  PREPARE_LOGO: 'prepare-logo',
  FINALIZE_LOGO: 'finalize-logo',
  PREPARE_GALLERY: 'prepare-gallery',
  FINALIZE_GALLERY: 'finalize-gallery',
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
  const valid = action === BUSINESS_MEDIA_ACTIONS.SET_LOGO || action === BUSINESS_MEDIA_ACTIONS.PREPARE_LOGO
    || action === BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO || action === BUSINESS_MEDIA_ACTIONS.CLEAR_LOGO
    ? isCanonicalBusinessLogoPath(storagePath, businessId)
    : isCanonicalBusinessGalleryPath(storagePath, businessId)
  if (!valid) throw new HttpsError('invalid-argument', 'invalid-canonical-business-media-path')
  return storagePath
}

async function objectGeneration(storagePath, bucket) {
  try {
    const [metadata] = await bucket.file(storagePath).getMetadata()
    return String(metadata.generation)
  } catch (error) {
    if (Number(error?.code) === 404) return '0'
    throw error
  }
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
  const proposed = parseCanonicalMediaPath(storagePath)
  if (gallery.includes(storagePath)
    || (proposed?.kind === 'gallery'
      && gallery.some((path) => parseCanonicalMediaPath(path)?.slot === proposed.slot))) return
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

function validateLegacyProtocolObjectMetadata(metadata) {
  if (!metadata || !ALLOWED_IMAGE_TYPES.has(metadata.contentType)) {
    throw new HttpsError('failed-precondition', 'business-media-invalid-content-type')
  }
  const size = Number(metadata.size)
  if (!Number.isInteger(size) || size < 0 || size >= MAX_IMAGE_BYTES) {
    throw new HttpsError('failed-precondition', 'business-media-invalid-size')
  }
  const keys = customMetadataKeys(metadata)
  if (!keys || keys.some((key) => key !== 'firebaseStorageDownloadTokens')) {
    throw new HttpsError('failed-precondition', 'business-media-forbidden-metadata')
  }
}

function storageNotFound(error) {
  return error?.code === 404
    || error?.code === '404'
    || error?.code === 'storage/object-not-found'
    || error?.code === 'not-found'
}

async function defaultDeleteObject(storagePath, generation, bucket = getStorage().bucket()) {
  try {
    if (String(generation) === '0') return 'not-found'
    await deleteExactGeneration({ path: storagePath, generation, bucket })
    return 'deleted'
  } catch (error) {
    if (storageNotFound(error)) return 'not-found'
    return 'failed'
  }
}

function publicResult({ action, storagePath, idempotent, objectDeletion = 'not-requested' }) {
  return { ok: true, action, storagePath, idempotent, objectDeletion }
}

async function finishBusinessMediaCleanup({
  db, sessionRef, session, requestId, bucket, removeExact, now,
}) {
  const targets = [
    { path: session.stagingPath, generation: session.stagingGeneration },
    ...(session.cleanupOldPath && session.cleanupOldGeneration
      ? [{ path: session.cleanupOldPath, generation: session.cleanupOldGeneration }]
      : []),
  ]
  let cleanupError = null
  for (const target of targets) {
    try {
      await removeExact({ ...target, bucket })
    } catch (error) {
      cleanupError ??= error
    }
  }
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef)
    if (!snapshot.exists || snapshot.data()?.requestId !== requestId
      || snapshot.data()?.state !== 'completed') return
    transaction.update(sessionRef, cleanupError ? {
      cleanupPending: true,
      cleanupFailure: Number(cleanupError?.code) === 412 ? 'generation-mismatch' : 'transient',
      updatedAt: now,
    } : {
      cleanupPending: false,
      cleanupFailure: null,
      updatedAt: now,
    })
  })
  return cleanupError == null
}

export async function manageBusinessMedia({
  uid,
  action,
  businessId,
  storagePath,
  db,
  deleteObject = defaultDeleteObject,
  requestId,
  stagingGeneration,
  bucket = getStorage().bucket(),
  now = new Date(),
  clean = cleanStagingGeneration,
  clearContext = clearPromotionContext,
  promote = promoteCleanGeneration,
  removeExact = deleteExactGeneration,
  afterAuthorityCommit = async () => undefined,
  readObjectMetadata = async (path) => (await bucket.file(path).getMetadata())[0],
}) {
  const safeUid = requireUid(uid)
  const safeAction = requireAction(action)
  const safeBusinessId = requireId(businessId, 'invalid-business-id')
  const safeStoragePath = requireCanonicalPath(safeAction, safeBusinessId, storagePath)
  const preparing = safeAction === BUSINESS_MEDIA_ACTIONS.PREPARE_LOGO
    || safeAction === BUSINESS_MEDIA_ACTIONS.PREPARE_GALLERY
  const finalizing = safeAction === BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO
    || safeAction === BUSINESS_MEDIA_ACTIONS.FINALIZE_GALLERY
  const adding = preparing || finalizing
  const legacyAdding = safeAction === BUSINESS_MEDIA_ACTIONS.SET_LOGO
    || safeAction === BUSINESS_MEDIA_ACTIONS.ADD_GALLERY
  const legacyProtocol = legacyAdding

  const userRef = db.doc(`users/${safeUid}`)
  const businessRef = db.doc(`businesses/${safeBusinessId}`)
  const subscriptionRef = db.doc(`businessSubscriptions/${safeBusinessId}`)
  const [initialUser, initialBusiness] = await Promise.all([userRef.get(), businessRef.get()])
  assertActiveAccount(initialUser)
  if (!initialBusiness.exists) throw new HttpsError('not-found', 'business-not-found')
  assertBusinessAuthority(initialBusiness.data(), safeUid)

  const parsedInput = parseCanonicalMediaPath(safeStoragePath)
  if ((preparing || finalizing || legacyProtocol) && parsedInput?.mediaSlot != null) {
    throw new HttpsError('invalid-argument', 'canonical-slot-is-backend-only')
  }

  if (legacyAdding) {
    validateLegacyProtocolObjectMetadata(await readObjectMetadata(safeStoragePath))
    let idempotent = false
    await db.runTransaction(async (transaction) => {
      const [userSnapshot, businessSnapshot, subscriptionSnapshot] = await Promise.all([
        transaction.get(userRef), transaction.get(businessRef), transaction.get(subscriptionRef),
      ])
      assertActiveAccount(userSnapshot)
      if (!businessSnapshot.exists) throw new HttpsError('not-found', 'business-not-found')
      const business = businessSnapshot.data()
      assertBusinessAuthority(business, safeUid)
      const { logo, gallery } = assertCanonicalManifest(safeBusinessId, business)
      if (safeAction === BUSINESS_MEDIA_ACTIONS.SET_LOGO) {
        idempotent = logo === safeStoragePath
        if (!idempotent) transaction.update(businessRef, { logoStoragePath: safeStoragePath })
      } else {
        idempotent = gallery.includes(safeStoragePath)
        assertGalleryAdditionAllowed({ businessId: safeBusinessId, business, gallery,
          storagePath: safeStoragePath, subscription: subscriptionSnapshot })
        const logicalSlot = parseCanonicalMediaPath(safeStoragePath)?.slot
        const existing = gallery.find((path) => parseCanonicalMediaPath(path)?.slot === logicalSlot)
        if (!idempotent) transaction.update(businessRef, {
          galleryStoragePaths: existing
            ? gallery.map((path) => path === existing ? safeStoragePath : path)
            : [...gallery, safeStoragePath],
        })
      }
    })
    return publicResult({ action: safeAction, storagePath: safeStoragePath, idempotent })
  }

  const parsedSlot = safeAction.includes('gallery') ? Number(safeStoragePath.split('/').at(-1)) : null
  const stagingPath = parsedSlot == null
    ? buildStagingBusinessLogoPath(safeBusinessId)
    : buildStagingBusinessGalleryPath(safeBusinessId, parsedSlot)
  const sessionId = businessSessionId(safeBusinessId, parsedSlot == null ? 'logo' : 'gallery', parsedSlot)

  if (preparing) {
    const business = initialBusiness.data()
    const { logo, gallery } = assertCanonicalManifest(safeBusinessId, business)
    if (parsedSlot != null) {
      const subscription = await subscriptionRef.get()
      assertGalleryAdditionAllowed({
        businessId: safeBusinessId, business, gallery, storagePath: safeStoragePath, subscription,
      })
    }
    const authorityPath = parsedSlot == null ? logo
      : (gallery.find((path) => parseCanonicalMediaPath(path)?.slot === parsedSlot) ?? null)
    const mediaSlot = inactiveCanonicalMediaSlot(authorityPath, (parsed) => (
      parsed.businessId === safeBusinessId && parsed.kind === (parsedSlot == null ? 'logo' : 'gallery')
      && (parsedSlot == null || parsed.slot === parsedSlot)
    ))
    const canonicalPath = parsedSlot == null
      ? buildCanonicalBusinessLogoSlotPath(safeBusinessId, mediaSlot)
      : buildCanonicalBusinessGallerySlotPath(safeBusinessId, parsedSlot, mediaSlot)
    return prepareBoundedMediaSession({
      db, sessionId, principalUid: safeUid, businessId: safeBusinessId,
      kind: parsedSlot == null ? 'logo' : 'gallery', slot: parsedSlot,
      stagingPath, canonicalPath,
      expectedCanonicalGeneration: await objectGeneration(canonicalPath, bucket),
      expectedAuthorityPath: authorityPath,
      expectedAuthorityGeneration: authorityPath ? await objectGeneration(authorityPath, bucket) : null,
      now,
    })
  }

  let promotedGeneration = null
  let finalizedSession = null
  let finalizingSessionRef = null
  const removalGeneration = adding ? null : await objectGeneration(safeStoragePath, bucket)
  if (finalizing) {
    const sessionRef = db.doc(`${MEDIA_SESSION_COLLECTION}/${sessionId}`)
    finalizingSessionRef = sessionRef
    const sessionSnapshot = await sessionRef.get()
    let session = sessionSnapshot.data()
    if (session && !session.stagingGeneration) {
      const [metadata] = await bucket.file(session.stagingPath, { generation: stagingGeneration }).getMetadata()
      await recordFinalizedStagingGeneration({ db,
        parsedPath: parsedSlot == null
          ? { kind: 'logo', businessId: safeBusinessId }
          : { kind: 'gallery', businessId: safeBusinessId, slot: parsedSlot },
        path: session.stagingPath, generation: stagingGeneration,
        uploadSessionId: uploadSessionMarker(metadata), now })
      session = (await sessionRef.get()).data()
    }
    let cleanedStaging = null
    if (session?.state === 'cleanup_pending'
      && String(session.stagingGeneration) === String(stagingGeneration)) {
      const parsedPath = parsedSlot == null
        ? { kind: 'logo', businessId: safeBusinessId }
        : { kind: 'gallery', businessId: safeBusinessId, slot: parsedSlot }
      cleanedStaging = await clean({ path: session.stagingPath, generation: stagingGeneration, bucket })
      await markStagingGenerationClean({
        db, parsedPath, path: session.stagingPath, generation: stagingGeneration,
        uploadSessionId: requestId, now,
      })
      session = (await sessionRef.get()).data()
    }
    finalizedSession = session
    const state = assertFinalizableSession(session, {
      requestId, principalUid: safeUid, stagingGeneration, now: now.getTime(),
    })
    if (session.stagingPath !== stagingPath
      || !((parsedSlot == null && isCanonicalBusinessLogoPath(session.canonicalPath, safeBusinessId))
        || (parsedSlot != null && isCanonicalBusinessGalleryPath(session.canonicalPath, safeBusinessId)))) {
      throw new HttpsError('failed-precondition', 'media-session-path-mismatch')
    }
    if (state === 'completed') {
      await finishBusinessMediaCleanup({
        db, sessionRef, session, requestId, bucket, removeExact, now,
      })
      return publicResult({
        action: safeAction, storagePath: session.canonicalPath, idempotent: true,
      })
    }
    if (session.promotedGeneration) {
      promotedGeneration = String(session.promotedGeneration)
      const [metadata] = await bucket.file(session.canonicalPath, { generation: promotedGeneration }).getMetadata()
      verifyCanonicalImageMetadata(metadata, {
        path: session.canonicalPath, generation: promotedGeneration, requireTokenFree: true,
      })
    } else {
      const cleaned = cleanedStaging
        ?? await clean({ path: stagingPath, generation: stagingGeneration, bucket })
      await sessionRef.update({ stagingGeneration: String(stagingGeneration), state: 'promoting', updatedAt: now })
      const promoted = await promote({
        stagingPath, stagingGeneration, stagingMetageneration: String(cleaned.metageneration),
        canonicalPath: session.canonicalPath,
        expectedCanonicalGeneration: session.expectedCanonicalGeneration, bucket,
        promotionId: requestId,
      })
      promotedGeneration = promoted.generation
      await sessionRef.update({ promotedGeneration, state: 'promoted', updatedAt: now })
    }
    await clearContext({ path: session.canonicalPath, generation: promotedGeneration, bucket })
  }

  let idempotent = false

  try {
    await db.runTransaction(async (transaction) => {
    const [userSnapshot, businessSnapshot, subscriptionSnapshot, sessionSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(businessRef),
      transaction.get(subscriptionRef),
      finalizing ? transaction.get(finalizingSessionRef) : Promise.resolve(null),
    ])
    assertActiveAccount(userSnapshot)
    if (!businessSnapshot.exists) throw new HttpsError('not-found', 'business-not-found')
    const business = businessSnapshot.data()
    assertBusinessAuthority(business, safeUid)
    const { logo, gallery } = assertCanonicalManifest(safeBusinessId, business)
    if (finalizing) {
      const currentSession = sessionSnapshot.data()
      if (!sessionSnapshot.exists
        || currentSession.requestId !== requestId
        || currentSession.principalUid !== safeUid
        || currentSession.canonicalPath !== finalizedSession.canonicalPath
        || String(currentSession.stagingGeneration) !== String(stagingGeneration)
        || String(currentSession.promotedGeneration) !== String(promotedGeneration)
        || currentSession.state !== 'promoted') {
        throw new HttpsError('aborted', 'media-session-stale')
      }
    }

    if (safeAction === BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO) {
      if (logo !== finalizedSession.expectedAuthorityPath) throw new HttpsError('aborted', 'media-authority-changed')
      idempotent = logo === finalizedSession.canonicalPath
      if (!idempotent) transaction.update(businessRef, { logoStoragePath: finalizedSession.canonicalPath })
      transaction.update(finalizingSessionRef, {
        state: 'completed', promotedGeneration,
        cleanupPending: true,
        cleanupOldPath: finalizedSession.expectedAuthorityPath?.endsWith('/a')
          || finalizedSession.expectedAuthorityPath?.endsWith('/b')
          ? finalizedSession.expectedAuthorityPath : null,
        cleanupOldGeneration: finalizedSession.expectedAuthorityGeneration ?? null,
        updatedAt: now,
      })
      return
    }
    if (safeAction === BUSINESS_MEDIA_ACTIONS.FINALIZE_GALLERY) {
      const existingForSlot = gallery.find((path) => parseCanonicalMediaPath(path)?.slot === parsedSlot) ?? null
      if (existingForSlot !== finalizedSession.expectedAuthorityPath) throw new HttpsError('aborted', 'media-authority-changed')
      idempotent = gallery.includes(finalizedSession.canonicalPath)
      assertGalleryAdditionAllowed({
        businessId: safeBusinessId,
        business,
        gallery,
        storagePath: finalizedSession.canonicalPath,
        subscription: subscriptionSnapshot,
      })
      if (!idempotent) transaction.update(businessRef, {
        galleryStoragePaths: finalizedSession.expectedAuthorityPath
          ? gallery.map((path) => path === finalizedSession.expectedAuthorityPath ? finalizedSession.canonicalPath : path)
          : [...gallery, finalizedSession.canonicalPath],
      })
      transaction.update(finalizingSessionRef, {
        state: 'completed', promotedGeneration,
        cleanupPending: true,
        cleanupOldPath: finalizedSession.expectedAuthorityPath?.endsWith('/a')
          || finalizedSession.expectedAuthorityPath?.endsWith('/b')
          ? finalizedSession.expectedAuthorityPath : null,
        cleanupOldGeneration: finalizedSession.expectedAuthorityGeneration ?? null,
        updatedAt: now,
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
  } catch (error) {
    if (finalizedSession && error instanceof HttpsError
      && ['failed-precondition', 'aborted', 'permission-denied'].includes(error.code)) {
      await db.doc(`${MEDIA_SESSION_COLLECTION}/${sessionId}`)
        .update({ state: 'failed', updatedAt: now }).catch(() => undefined)
    }
    throw error
  }

  if (adding) {
    await afterAuthorityCommit()
    const completedSession = (await finalizingSessionRef.get()).data()
    await finishBusinessMediaCleanup({
      db, sessionRef: finalizingSessionRef, session: completedSession,
      requestId, bucket, removeExact, now,
    })
    return publicResult({ action: safeAction, storagePath: finalizedSession.canonicalPath, idempotent })
  }
  let objectDeletion
  try {
    objectDeletion = await deleteObject(safeStoragePath, removalGeneration, bucket)
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
