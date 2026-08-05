import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

export const BUSINESS_INSIGHT_GLOBAL_HOURLY_LIMIT = 1000
export const BUSINESS_INSIGHT_PER_BUSINESS_HOURLY_LIMIT = 300
export const BUSINESS_INSIGHT_RATE_LIMIT_RETENTION_HOURS = 48

const RATE_LIMIT_SCHEMA_VERSION = 1
const HOUR_MILLIS = 60 * 60 * 1000

function asTimestamp(millis) {
  return Timestamp.fromMillis(millis)
}

export function businessInsightHour(timestamp) {
  const hourStartMillis = Math.floor(timestamp.toMillis() / HOUR_MILLIS) * HOUR_MILLIS
  const hourEndMillis = hourStartMillis + HOUR_MILLIS
  const hourKey = new Date(hourStartMillis).toISOString().slice(0, 13).replaceAll(/[-T]/g, '')
  return {
    hourKey,
    windowStartedAt: asTimestamp(hourStartMillis),
    windowEndsAt: asTimestamp(hourEndMillis),
    expiresAt: asTimestamp(
      hourEndMillis + BUSINESS_INSIGHT_RATE_LIMIT_RETENTION_HOURS * HOUR_MILLIS,
    ),
  }
}

export function businessInsightRateLimitReferences(db, businessId, timestamp) {
  const window = businessInsightHour(timestamp)
  const businessDigest = createHash('sha256').update(businessId).digest('hex')
  return {
    window,
    globalRef: db.doc(`businessInsightRateLimitHours/global_${window.hourKey}`),
    businessRef: db.doc(
      `businessInsightRateLimitHours/business_${businessDigest}_${window.hourKey}`,
    ),
  }
}

function validTimestamp(value, expected) {
  return typeof value?.toMillis === 'function' && value.toMillis() === expected.toMillis()
}

export function rateLimitCount(snapshot, { scope, businessId, window }) {
  if (!snapshot.exists) return 0
  const data = snapshot.data()
  const valid = data?.schemaVersion === RATE_LIMIT_SCHEMA_VERSION
    && data.scope === scope
    && (scope === 'global' || data.businessId === businessId)
    && Number.isInteger(data.count)
    && data.count >= 0
    && validTimestamp(data.windowStartedAt, window.windowStartedAt)
    && validTimestamp(data.windowEndsAt, window.windowEndsAt)
    && typeof data.createdAt?.toMillis === 'function'
    && typeof data.updatedAt?.toMillis === 'function'
    && validTimestamp(data.expiresAt, window.expiresAt)
  if (!valid) {
    throw new HttpsError('failed-precondition', 'insight-rate-limit-state-invalid')
  }
  return data.count
}

export function rateLimitDocument({
  snapshot,
  scope,
  businessId,
  count,
  timestamp,
  window,
}) {
  return {
    schemaVersion: RATE_LIMIT_SCHEMA_VERSION,
    scope,
    ...(scope === 'business' ? { businessId } : {}),
    windowStartedAt: window.windowStartedAt,
    windowEndsAt: window.windowEndsAt,
    count,
    createdAt: snapshot.exists ? snapshot.data().createdAt : timestamp,
    updatedAt: timestamp,
    expiresAt: window.expiresAt,
  }
}

export function assertBusinessInsightLimit(count, limit, message) {
  if (count >= limit) throw new HttpsError('resource-exhausted', message)
}
