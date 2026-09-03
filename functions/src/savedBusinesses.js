import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  SAVED_BUSINESSES_SUBCOLLECTION,
  hasSavedBusinessCustomerCapability,
  normalizeSavedBusinessesPageSize,
  validateSavedBusinessRecord,
  validateSavedBusinessesCursor,
} from '@holalocal/firebase-contract'
import { toPublicDirectoryBusiness } from './publicBusinessDirectory.js'

function requireUid(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError('unauthenticated', 'auth-required')
  }
  return value
}

function savedAtMillis(value) {
  const millis = value?.toMillis?.()
  return Number.isSafeInteger(millis) && millis >= 0 ? millis : null
}

export async function listSavedBusinesses({ uid, pageSize, cursor, db }) {
  const safeUid = requireUid(uid)
  const normalizedPageSize = normalizeSavedBusinessesPageSize(pageSize)
  if (normalizedPageSize == null) {
    throw new HttpsError('invalid-argument', 'invalid-saved-business-page-size')
  }
  const parsedCursor = validateSavedBusinessesCursor(cursor)
  if (!parsedCursor.valid) throw new HttpsError('invalid-argument', 'invalid-saved-business-cursor')

  const userSnapshot = await db.doc(`users/${safeUid}`).get()
  if (!userSnapshot.exists) throw new HttpsError('failed-precondition', 'profile-not-found')
  const user = userSnapshot.data()
  if (user?.accountStatus !== 'active' || user?.deletionRequestedAt != null) {
    throw new HttpsError('failed-precondition', 'account-not-active')
  }
  if (!hasSavedBusinessCustomerCapability(user)) {
    throw new HttpsError('permission-denied', 'customer-capability-required')
  }

  let query = db.collection(`users/${safeUid}/${SAVED_BUSINESSES_SUBCOLLECTION}`)
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
  if (parsedCursor.value) {
    query = query.startAfter(
      Timestamp.fromMillis(parsedCursor.value.createdAtMillis),
      parsedCursor.value.businessId,
    )
  }
  const snapshot = await query.limit(normalizedPageSize + 1).get()
  const pageDocuments = snapshot.docs.slice(0, normalizedPageSize)
  const businessIds = [...new Set(pageDocuments.map((document) => document.id))]
  const businessReferences = businessIds.map((businessId) => db.doc(`businesses/${businessId}`))
  const subscriptionReferences = businessIds.map(
    (businessId) => db.doc(`businessSubscriptions/${businessId}`),
  )
  const [businessSnapshots, subscriptionSnapshots] = businessIds.length > 0
    ? await Promise.all([
      db.getAll(...businessReferences),
      db.getAll(...subscriptionReferences),
    ])
    : [[], []]
  const businessById = new Map(businessIds.map((businessId, index) => [businessId, {
    business: businessSnapshots[index],
    subscription: subscriptionSnapshots[index],
  }]))

  const items = pageDocuments.map((savedDocument) => {
    const saved = savedDocument.data()
    const millis = savedAtMillis(saved?.createdAt)
    const validSave = validateSavedBusinessRecord(saved, { businessId: savedDocument.id }).valid
    const referenced = businessById.get(savedDocument.id)
    const projected = validSave && referenced?.business?.exists
      ? toPublicDirectoryBusiness(
        savedDocument.id,
        referenced.business.data(),
        referenced.subscription?.exists ? referenced.subscription.data() : null,
        referenced.subscription?.exists === true,
      )
      : null
    return projected
      ? { businessId: savedDocument.id, savedAtMillis: millis, available: true, business: projected }
      : { businessId: savedDocument.id, savedAtMillis: millis, available: false, business: null }
  })
  const lastDocument = pageDocuments.at(-1)
  const lastCreatedAtMillis = savedAtMillis(lastDocument?.data()?.createdAt)
  const nextCursor = snapshot.docs.length > normalizedPageSize
    && lastDocument
    && lastCreatedAtMillis != null
    ? { createdAtMillis: lastCreatedAtMillis, businessId: lastDocument.id }
    : null

  return { items, nextCursor }
}
