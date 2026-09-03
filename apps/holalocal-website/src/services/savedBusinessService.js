import {
  SAVED_BUSINESSES_SUBCOLLECTION,
  SAVED_BUSINESSES_DEFAULT_PAGE_SIZE,
  SAVED_BUSINESS_FIELDS,
  normalizeSavedBusinessesPageSize,
  validateSavedBusinessesCursor,
  validateSavedBusinessRecord,
} from '@holalocal/firebase-contract'
import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/firestoreClient.js'
import { createApplicationError } from '../utils/frontendErrors.js'
import { listSavedBusinessesCallable } from '../firebase/functionsClient.js'

const documentIdPattern = /^[A-Za-z0-9_-]{1,128}$/

const defaultOperations = Object.freeze({
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
})

function requireDocumentId(value, reason) {
  if (typeof value !== 'string' || !documentIdPattern.test(value)) {
    throw createApplicationError(reason)
  }
  return value
}

function savedBusinessReference(database, uid, businessId, operations) {
  return operations.doc(
    database,
    'users',
    requireDocumentId(uid, 'invalid-saved-business-owner'),
    SAVED_BUSINESSES_SUBCOLLECTION,
    requireDocumentId(businessId, 'invalid-saved-business-id'),
  )
}

function normalizedFailure(error, operation) {
  const rawCode = String(error?.code ?? '').toLowerCase()
  const code = rawCode.includes('/') ? rawCode.split('/').pop() : rawCode
  const category = code === 'permission-denied' || code === 'unauthenticated'
    ? 'permission'
    : code === 'unavailable' || code === 'network-request-failed'
      ? 'network'
      : 'failed'
  return createApplicationError(`${operation}-saved-business-${category}`)
}

function optionalString(value) {
  return typeof value === 'string' ? value : ''
}

function normalizePublicBusiness(value, businessId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.businessId !== businessId || !optionalString(value.name)) return null
  return Object.freeze({
    businessId,
    name: value.name,
    category: optionalString(value.category),
    description: optionalString(value.description),
    logoUrl: optionalString(value.logoUrl),
    serviceArea: optionalString(value.serviceArea),
    tagline: optionalString(value.tagline),
  })
}

function normalizeSavedListResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.items)) {
    throw createApplicationError('invalid-saved-business-list-response')
  }
  const cursor = validateSavedBusinessesCursor(value.nextCursor)
  if (!cursor.valid) throw createApplicationError('invalid-saved-business-list-response')
  const seen = new Set()
  const items = value.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || !documentIdPattern.test(item.businessId)
      || !Number.isSafeInteger(item.savedAtMillis) || item.savedAtMillis < 0
      || typeof item.available !== 'boolean' || seen.has(item.businessId)) {
      throw createApplicationError('invalid-saved-business-list-response')
    }
    seen.add(item.businessId)
    const business = item.available ? normalizePublicBusiness(item.business, item.businessId) : null
    if ((item.available && !business) || (!item.available && item.business !== null)) {
      throw createApplicationError('invalid-saved-business-list-response')
    }
    return Object.freeze({
      available: item.available,
      business,
      businessId: item.businessId,
      savedAtMillis: item.savedAtMillis,
    })
  })
  return Object.freeze({ items: Object.freeze(items), nextCursor: cursor.value })
}

export async function listSavedBusinessesPage({
  cursor = null,
  pageSize = SAVED_BUSINESSES_DEFAULT_PAGE_SIZE,
} = {}, callable = listSavedBusinessesCallable) {
  const normalizedPageSize = normalizeSavedBusinessesPageSize(pageSize)
  const normalizedCursor = validateSavedBusinessesCursor(cursor)
  if (normalizedPageSize == null || !normalizedCursor.valid) {
    throw createApplicationError('invalid-saved-business-list-request')
  }
  try {
    const result = await callable({
      pageSize: normalizedPageSize,
      ...(normalizedCursor.value ? { cursor: normalizedCursor.value } : {}),
    })
    return normalizeSavedListResponse(result?.data)
  } catch (error) {
    if (error?.reason?.startsWith('invalid-saved-business-list-')) throw error
    throw normalizedFailure(error, 'list')
  }
}

function dependencies(overrides = {}) {
  return {
    database: overrides.database ?? db,
    operations: { ...defaultOperations, ...overrides.operations },
  }
}

export async function getSavedBusinessState(uid, businessId, overrides) {
  const { database, operations } = dependencies(overrides)
  const reference = savedBusinessReference(database, uid, businessId, operations)
  try {
    const snapshot = await operations.getDoc(reference)
    if (!snapshot.exists()) return Object.freeze({ saved: false })
    if (!validateSavedBusinessRecord(snapshot.data(), { businessId }).valid) {
      throw createApplicationError('invalid-saved-business-record')
    }
    return Object.freeze({ saved: true })
  } catch (error) {
    if (error?.reason === 'invalid-saved-business-record') throw error
    throw normalizedFailure(error, 'load')
  }
}

export async function saveBusiness(uid, businessId, overrides) {
  const { database, operations } = dependencies(overrides)
  const reference = savedBusinessReference(database, uid, businessId, operations)
  try {
    return await operations.runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(reference)
      if (snapshot.exists()) return Object.freeze({ saved: true, created: false })
      const values = {
        [SAVED_BUSINESS_FIELDS[0]]: businessId,
        [SAVED_BUSINESS_FIELDS[1]]: operations.serverTimestamp(),
      }
      transaction.set(reference, values)
      return Object.freeze({ saved: true, created: true })
    })
  } catch (error) {
    throw normalizedFailure(error, 'save')
  }
}

export async function removeSavedBusiness(uid, businessId, overrides) {
  const { database, operations } = dependencies(overrides)
  const reference = savedBusinessReference(database, uid, businessId, operations)
  try {
    await operations.deleteDoc(reference)
    return Object.freeze({ saved: false })
  } catch (error) {
    throw normalizedFailure(error, 'remove')
  }
}
