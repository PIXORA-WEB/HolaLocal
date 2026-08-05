import { createHash } from 'node:crypto'
import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  BUSINESS_CONTACT_ACTIONS,
  BUSINESS_INSIGHTS_DAYS,
  BUSINESS_INSIGHTS_MAX_RANGE_DAYS,
  BUSINESS_INSIGHTS_SCHEMA_VERSION,
  BUSINESS_INSIGHT_TOKEN_PATTERN,
  isBusinessContactAction,
  isBusinessInsightEvent,
  isPublicBusinessEligible,
  inclusiveUtcDateKeys,
  parseBusinessInsightDate,
  recentUtcDateKeys,
  utcDateKey,
} from '@holalocal/firebase-contract'
import {
  BUSINESS_INSIGHT_GLOBAL_HOURLY_LIMIT,
  BUSINESS_INSIGHT_PER_BUSINESS_HOURLY_LIMIT,
  assertBusinessInsightLimit,
  businessInsightRateLimitReferences,
  rateLimitCount,
  rateLimitDocument,
} from './businessInsightRateLimit.js'

const ALLOWED_TRACKING_FIELDS = new Set(['businessId', 'eventType', 'contactAction', 'eventToken'])
const DEDUPE_HOURS = 24

function invalid(message) {
  throw new HttpsError('invalid-argument', message)
}

function requireId(value, message = 'invalid-business-id') {
  if (typeof value !== 'string' || !value.trim() || value.includes('/') || value.length > 128) invalid(message)
  return value.trim()
}

function requireStrictObject(data, allowed) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid('invalid-insight-request')
  if (Object.keys(data).some((key) => !allowed.has(key))) invalid('unsupported-insight-field')
}

function contactAvailable(business, action) {
  const contact = business.contact ?? {}
  if (action === 'holalocal') return typeof business.ownerId === 'string' && business.ownerId.length > 0
  if (action === 'phone') return typeof contact.phone === 'string' && contact.phone.length > 0
  if (action === 'email') return typeof contact.email === 'string' && contact.email.length > 0
  if (action === 'whatsapp') return typeof contact.whatsappNumber === 'string' && contact.whatsappNumber.length > 0
  if (action === 'website') return typeof contact.website === 'string' && contact.website.length > 0
  return false
}

function increments(eventType, action) {
  if (eventType === 'profile_view') return { profileViews: 1 }
  return {
    contactActions: 1,
    [`contactActionBreakdown.${action}`]: 1,
  }
}

function aggregateUpdate(current = {}, delta, timestamp, includeStart = false) {
  const next = {
    schemaVersion: BUSINESS_INSIGHTS_SCHEMA_VERSION,
    ...(includeStart ? { trackingStartedAt: timestamp } : {}),
    lastUpdatedAt: timestamp,
    profileViews: number(current.profileViews),
    enquiries: number(current.enquiries),
    contactActions: number(current.contactActions),
    contactActionBreakdown: Object.fromEntries(BUSINESS_CONTACT_ACTIONS.map((action) => [action, number(current.contactActionBreakdown?.[action])])),
  }
  for (const [key, amount] of Object.entries(delta)) {
    if (key.startsWith('contactActionBreakdown.')) next.contactActionBreakdown[key.split('.')[1]] += amount
    else next[key] += amount
  }
  return next
}

function tokenDigest({ businessId, eventType, contactAction, eventToken }) {
  return createHash('sha256')
    .update(`${businessId}|${eventType}|${contactAction ?? ''}|${eventToken}`)
    .digest('hex')
}

function isUnexpiredDedupe(snapshot, timestamp) {
  if (!snapshot.exists) return false
  const expiresAt = snapshot.data()?.expiresAt
  if (!expiresAt || typeof expiresAt.toMillis !== 'function') return false
  const expiryMillis = expiresAt.toMillis()
  return Number.isFinite(expiryMillis) && expiryMillis > timestamp.toMillis()
}

export async function recordBusinessInsight({ data, db, now = () => Timestamp.now() }) {
  requireStrictObject(data, ALLOWED_TRACKING_FIELDS)
  const businessId = requireId(data.businessId)
  if (!isBusinessInsightEvent(data.eventType)) invalid('unsupported-insight-event')
  if (typeof data.eventToken !== 'string' || !BUSINESS_INSIGHT_TOKEN_PATTERN.test(data.eventToken)) invalid('invalid-insight-token')
  if (data.eventType === 'contact_action' && !isBusinessContactAction(data.contactAction)) invalid('unsupported-contact-action')
  if (data.eventType === 'profile_view' && data.contactAction !== undefined) invalid('unexpected-contact-action')

  const timestamp = now()
  const digest = tokenDigest({ ...data, businessId })
  const businessRef = db.doc(`businesses/${businessId}`)
  const aggregateRef = db.doc(`businessInsights/${businessId}`)
  const dayRef = aggregateRef.collection('days').doc(utcDateKey(timestamp.toDate()))
  const dedupeRef = aggregateRef.collection('insightDedupe').doc(digest)
  const rateLimits = businessInsightRateLimitReferences(db, businessId, timestamp)
  const delta = increments(data.eventType, data.contactAction)

  const counted = await db.runTransaction(async (transaction) => {
    const businessSnapshot = await transaction.get(businessRef)
    if (!businessSnapshot.exists || !isPublicBusinessEligible(businessSnapshot.data())) {
      throw new HttpsError('failed-precondition', 'business-not-public')
    }
    if (data.eventType === 'contact_action' && !contactAvailable(businessSnapshot.data(), data.contactAction)) {
      throw new HttpsError('failed-precondition', 'contact-action-unavailable')
    }

    const duplicate = await transaction.get(dedupeRef)
    if (isUnexpiredDedupe(duplicate, timestamp)) return false
    const globalRateLimit = await transaction.get(rateLimits.globalRef)
    const globalCount = rateLimitCount(globalRateLimit, {
      scope: 'global', window: rateLimits.window,
    })
    assertBusinessInsightLimit(
      globalCount,
      BUSINESS_INSIGHT_GLOBAL_HOURLY_LIMIT,
      'business-insight-global-rate-limit',
    )
    const businessRateLimit = await transaction.get(rateLimits.businessRef)
    const businessCount = rateLimitCount(businessRateLimit, {
      scope: 'business', businessId, window: rateLimits.window,
    })
    assertBusinessInsightLimit(
      businessCount,
      BUSINESS_INSIGHT_PER_BUSINESS_HOURLY_LIMIT,
      'business-insight-business-rate-limit',
    )
    const aggregate = await transaction.get(aggregateRef)
    const day = await transaction.get(dayRef)
    transaction.set(dedupeRef, {
      expiresAt: Timestamp.fromMillis(timestamp.toMillis() + DEDUPE_HOURS * 60 * 60 * 1000),
      createdAt: timestamp,
    })
    transaction.set(rateLimits.globalRef, rateLimitDocument({
      snapshot: globalRateLimit,
      scope: 'global',
      count: globalCount + 1,
      timestamp,
      window: rateLimits.window,
    }))
    transaction.set(rateLimits.businessRef, rateLimitDocument({
      snapshot: businessRateLimit,
      scope: 'business',
      businessId,
      count: businessCount + 1,
      timestamp,
      window: rateLimits.window,
    }))
    transaction.set(aggregateRef, aggregateUpdate(aggregate.data(), delta, timestamp, !aggregate.exists || !aggregate.data().trackingStartedAt), { merge: true })
    transaction.set(dayRef, aggregateUpdate(day.data(), delta, timestamp, !day.exists), { merge: true })
    return true
  })
  return { ok: true, counted }
}

export async function countCreatedConversation({ conversationId, conversation, db, now = () => Timestamp.now() }) {
  if (!conversation || typeof conversation.businessId !== 'string') return { counted: false }
  const conversationRef = db.doc(`conversations/${conversationId}`)
  const aggregateRef = db.doc(`businessInsights/${conversation.businessId}`)
  const timestamp = now()
  const dayRef = aggregateRef.collection('days').doc(utcDateKey(timestamp.toDate()))
  let counted = false
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(conversationRef)
    if (!current.exists || current.data().insightsEnquiryCountedAt) return
    const aggregate = await transaction.get(aggregateRef)
    const day = await transaction.get(dayRef)
    const delta = { enquiries: 1 }
    transaction.update(conversationRef, { insightsEnquiryCountedAt: timestamp })
    transaction.set(aggregateRef, aggregateUpdate(aggregate.data(), delta, timestamp, !aggregate.exists || !aggregate.data().trackingStartedAt), { merge: true })
    transaction.set(dayRef, aggregateUpdate(day.data(), delta, timestamp, !day.exists), { merge: true })
    counted = true
  })
  return { counted }
}

function number(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function publicCounts(data = {}) {
  return {
    profileViews: number(data.profileViews),
    enquiries: number(data.enquiries),
    contactActions: number(data.contactActions),
  }
}

function publicBreakdown(data = {}) {
  return Object.fromEntries(BUSINESS_CONTACT_ACTIONS.map((action) => [action, number(data.contactActionBreakdown?.[action])]))
}

function countsWithBreakdown(data = {}) {
  return { ...publicCounts(data), contactActionBreakdown: publicBreakdown(data) }
}

function selectedDateRange(data, currentDate) {
  const hasStart = data.startDate !== undefined
  const hasEnd = data.endDate !== undefined
  if (hasStart !== hasEnd) invalid('insight-date-range-required')
  const endDate = hasEnd ? data.endDate : utcDateKey(currentDate)
  const startDate = hasStart
    ? data.startDate
    : recentUtcDateKeys(currentDate, BUSINESS_INSIGHTS_DAYS)[0]
  const start = parseBusinessInsightDate(startDate)
  const end = parseBusinessInsightDate(endDate)
  if (!start || !end) invalid('invalid-insight-date')
  if (start > end) invalid('insight-start-after-end')
  const today = parseBusinessInsightDate(utcDateKey(currentDate))
  if (end > today) invalid('insight-future-end-date')
  const dateKeys = inclusiveUtcDateKeys(startDate, endDate)
  if (dateKeys.length === 0 || dateKeys.length > BUSINESS_INSIGHTS_MAX_RANGE_DAYS) invalid('insight-date-range-too-long')
  const preset = endDate === utcDateKey(currentDate) && [7, 30, 90].includes(dateKeys.length)
    ? `last_${dateKeys.length}_days`
    : 'custom'
  return { startDate, endDate, dateKeys, preset }
}

export async function getOwnerBusinessInsights({ uid, data, db, now = () => Timestamp.now() }) {
  requireStrictObject(data, new Set(['businessId', 'startDate', 'endDate']))
  const businessId = requireId(data.businessId)
  const currentTimestamp = now()
  const requestedRange = selectedDateRange(data, currentTimestamp.toDate())
  const [userSnapshot, businessSnapshot, aggregateSnapshot] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`businesses/${businessId}`).get(),
    db.doc(`businessInsights/${businessId}`).get(),
  ])
  if (!userSnapshot.exists || userSnapshot.data().accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'active-account-required')
  }
  const user = userSnapshot.data()
  const business = businessSnapshot.data()
  if (!businessSnapshot.exists || business?.ownerId !== uid || user.businessId !== businessId) {
    throw new HttpsError('permission-denied', 'business-owner-required')
  }
  const daySnapshot = await db.collection(`businessInsights/${businessId}/days`)
    .where(FieldPath.documentId(), '>=', requestedRange.startDate)
    .where(FieldPath.documentId(), '<=', requestedRange.endDate)
    .get()
  const storedDays = new Map(daySnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data()]))
  const days = requestedRange.dateKeys.map((date) => ({ date, ...countsWithBreakdown(storedDays.get(date)) }))
  const aggregate = aggregateSnapshot.data() ?? {}
  const selectedRange = days.reduce((totals, day) => ({
    profileViews: totals.profileViews + day.profileViews,
    enquiries: totals.enquiries + day.enquiries,
    contactActions: totals.contactActions + day.contactActions,
    contactActionBreakdown: Object.fromEntries(BUSINESS_CONTACT_ACTIONS.map((action) => [
      action,
      totals.contactActionBreakdown[action] + day.contactActionBreakdown[action],
    ])),
  }), countsWithBreakdown())
  return {
    schemaVersion: BUSINESS_INSIGHTS_SCHEMA_VERSION,
    businessId,
    businessStatus: business.status,
    trackingStartedAt: aggregate.trackingStartedAt?.toDate?.().toISOString() ?? null,
    range: {
      startDate: requestedRange.startDate,
      endDate: requestedRange.endDate,
      numberOfDays: requestedRange.dateKeys.length,
      preset: requestedRange.preset,
    },
    selectedRange,
    allTime: countsWithBreakdown(aggregate),
    days,
  }
}
