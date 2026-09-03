export const SAVED_BUSINESSES_SUBCOLLECTION = 'savedBusinesses'
export const SAVED_BUSINESS_FIELDS = Object.freeze(['businessId', 'createdAt'])
export const SAVED_BUSINESSES_DEFAULT_PAGE_SIZE = 20
export const SAVED_BUSINESSES_MAX_PAGE_SIZE = 50

function isNonEmptyDocumentId(value) {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && value.length <= 128
    && !value.includes('/')
}

function isTimestampLike(value) {
  if (!value || typeof value !== 'object') return false
  if (typeof value.toMillis === 'function') {
    try {
      return Number.isFinite(value.toMillis())
    } catch {
      return false
    }
  }
  return Number.isInteger(value.seconds)
    && Number.isInteger(value.nanoseconds)
    && value.nanoseconds >= 0
    && value.nanoseconds < 1_000_000_000
}

export function hasSavedBusinessCustomerCapability(user = {}) {
  return user?.accountStatus === 'active'
    && user?.deletionRequestedAt == null
    && Array.isArray(user?.roles)
    && user.roles.includes('customer')
}

export function normalizeSavedBusinessesPageSize(value) {
  if (value == null) return SAVED_BUSINESSES_DEFAULT_PAGE_SIZE
  if (!Number.isInteger(value) || value < 1 || value > SAVED_BUSINESSES_MAX_PAGE_SIZE) {
    return null
  }
  return value
}

export function validateSavedBusinessesCursor(cursor) {
  if (cursor == null) return { valid: true, value: null }
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)
    || Object.keys(cursor).length !== 2
    || !Object.hasOwn(cursor, 'createdAtMillis')
    || !Object.hasOwn(cursor, 'businessId')
    || !Number.isSafeInteger(cursor.createdAtMillis)
    || cursor.createdAtMillis < 0
    || !isNonEmptyDocumentId(cursor.businessId)) {
    return { valid: false, value: null }
  }
  return {
    valid: true,
    value: Object.freeze({
      createdAtMillis: cursor.createdAtMillis,
      businessId: cursor.businessId,
    }),
  }
}

export function validateSavedBusinessRecord(record, { businessId } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, reason: 'invalid-record' }
  }
  const keys = Object.keys(record)
  if (keys.length !== SAVED_BUSINESS_FIELDS.length
    || SAVED_BUSINESS_FIELDS.some((field) => !keys.includes(field))) {
    return { valid: false, reason: 'invalid-fields' }
  }
  if (!isNonEmptyDocumentId(record.businessId)) {
    return { valid: false, reason: 'invalid-business-id' }
  }
  if (businessId !== undefined && record.businessId !== businessId) {
    return { valid: false, reason: 'business-id-mismatch' }
  }
  if (!isTimestampLike(record.createdAt)) {
    return { valid: false, reason: 'invalid-created-at' }
  }
  return { valid: true, reason: null }
}
