import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  PLAN_DEFINITIONS,
  PLAN_ID_VALUES,
  SUBSCRIPTION_SCHEMA_VERSION,
  normalizeBusinessSubscription,
  resolveAuthoritativeBusinessEntitlements,
  resolveAuthoritativeBusinessSubscription,
} from '@holalocal/firebase-contract'

const MAX_REASON_LENGTH = 2000
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/
const HISTORY_LIMIT = 10

function safeUid(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new HttpsError('unauthenticated', 'auth-required')
  }
  return value.trim()
}

function safeBusinessId(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/') || value.length > 128) {
    throw new HttpsError('invalid-argument', 'invalid-business-id')
  }
  return value.trim()
}

function safeReason(value) {
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', 'invalid-assignment-reason')
  const normalized = value.trim()
  if (!normalized || normalized.length > MAX_REASON_LENGTH) {
    throw new HttpsError('invalid-argument', 'invalid-assignment-reason')
  }
  return normalized
}

function safeRequestId(value) {
  if (typeof value !== 'string' || !REQUEST_ID_PATTERN.test(value)) {
    throw new HttpsError('invalid-argument', 'invalid-request-id')
  }
  return value
}

function safeExpectedVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new HttpsError('invalid-argument', 'invalid-assignment-version')
  }
  return value
}

function requestFingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function issueCode(normalized) {
  return normalized.issues[0]?.code ?? normalized.fallbackReason ?? null
}

function canonicalPrivateState(snapshot, businessId) {
  if (!snapshot.exists) return { valid: false, version: 0, normalized: null, data: null }
  const data = snapshot.data()
  const normalized = normalizeBusinessSubscription(data)
  const version = Number.isSafeInteger(data?.assignmentVersion) && data.assignmentVersion >= 1
    ? data.assignmentVersion
    : 0
  return {
    data,
    normalized,
    version,
    valid: normalized.source === 'canonical'
      && data.businessId === businessId
      && version >= 1,
  }
}

function eventPlanValue(normalized) {
  return normalized?.subscription?.planId ?? null
}

function eventRevisionValue(normalized) {
  return normalized?.subscription?.planRevision ?? null
}

export async function assignBusinessSubscriptionPlan({
  uid, claims, businessId, planId, reason, requestId, expectedAssignmentVersion, db,
}) {
  const adminUid = safeUid(uid)
  if (claims?.admin !== true) throw new HttpsError('permission-denied', 'admin-claim-required')
  const safeId = safeBusinessId(businessId)
  if (typeof planId !== 'string' || !PLAN_ID_VALUES.includes(planId)) {
    throw new HttpsError('invalid-argument', 'invalid-subscription-plan')
  }
  const normalizedReason = safeReason(reason)
  const safeIdempotencyKey = safeRequestId(requestId)
  const expectedVersion = safeExpectedVersion(expectedAssignmentVersion)
  const planRevision = PLAN_DEFINITIONS[planId].revision
  const normalizedRequest = {
    businessId: safeId, planId, reason: normalizedReason,
    requestId: safeIdempotencyKey, expectedAssignmentVersion: expectedVersion, adminUid,
  }
  const fingerprint = requestFingerprint(normalizedRequest)
  const businessRef = db.doc(`businesses/${safeId}`)
  const subscriptionRef = db.doc(`businessSubscriptions/${safeId}`)
  const eventRef = db.doc(`businessSubscriptions/${safeId}/assignmentEvents/${safeIdempotencyKey}`)
  let response

  await db.runTransaction(async (transaction) => {
    const [businessSnapshot, subscriptionSnapshot, eventSnapshot] = await Promise.all([
      transaction.get(businessRef), transaction.get(subscriptionRef), transaction.get(eventRef),
    ])

    if (eventSnapshot.exists) {
      const event = eventSnapshot.data()
      if (event.requestFingerprint === fingerprint && event.responseSnapshot) {
        response = event.responseSnapshot
        return
      }
      throw new HttpsError('already-exists', 'assignment-request-id-conflict')
    }
    if (!businessSnapshot.exists) throw new HttpsError('not-found', 'business-not-found')
    const business = businessSnapshot.data()
    if (business.status === 'archived') {
      throw new HttpsError('failed-precondition', 'archived-business-plan-assignment-denied')
    }
    if (business.status === 'deleted' || business.deletedAt != null) {
      throw new HttpsError('failed-precondition', 'deleted-business-terminal')
    }

    const privateState = canonicalPrivateState(subscriptionSnapshot, safeId)
    if (expectedVersion !== privateState.version) {
      throw new HttpsError('failed-precondition', 'subscription-assignment-state-changed')
    }
    const legacyNormalized = normalizeBusinessSubscription(business.subscription)
    const previousNormalized = subscriptionSnapshot.exists
      ? privateState.normalized
      : legacyNormalized
    const samePlan = privateState.valid
      && privateState.normalized.subscription.planId === planId
      && privateState.normalized.subscription.planRevision === planRevision
      && privateState.normalized.subscription.accessStatus === 'active'
    const repaired = subscriptionSnapshot.exists
      ? !privateState.valid
      : legacyNormalized.source === 'fallback'
    const outcome = samePlan
      ? 'no_change'
      : subscriptionSnapshot.exists
        ? repaired ? 'repaired' : 'changed'
        : 'initialized'
    const changed = !samePlan
    const nextVersion = changed ? privateState.version + 1 : privateState.version
    response = {
      ok: true,
      changed,
      repaired,
      outcome,
      businessId: safeId,
      planId,
      planRevision,
      effectivePlanId: planId,
      assignmentVersion: nextVersion,
      requestId: safeIdempotencyKey,
    }
    const timestamp = FieldValue.serverTimestamp()

    if (changed) {
      transaction.set(subscriptionRef, {
        schemaVersion: SUBSCRIPTION_SCHEMA_VERSION,
        businessId: safeId,
        planId,
        planRevision,
        accessStatus: 'active',
        assignmentSource: 'admin',
        assignedAt: timestamp,
        startsAt: timestamp,
        endsAt: null,
        updatedAt: timestamp,
        updatedBy: adminUid,
        assignmentVersion: nextVersion,
      })
    }
    transaction.set(eventRef, {
      schemaVersion: 1,
      requestId: safeIdempotencyKey,
      businessId: safeId,
      action: 'assign_subscription_plan',
      outcome,
      changed,
      repairedMalformedState: repaired,
      previousPlanId: eventPlanValue(previousNormalized),
      previousPlanRevision: eventRevisionValue(previousNormalized),
      newPlanId: planId,
      newPlanRevision: planRevision,
      assignmentVersionBefore: privateState.version,
      assignmentVersionAfter: nextVersion,
      assignmentSource: 'admin',
      adminUid,
      reason: normalizedReason,
      issueCodeBefore: issueCode(previousNormalized),
      createdAt: timestamp,
      requestFingerprint: fingerprint,
      responseSnapshot: response,
    })
  })
  return response
}

function timestampValue(value) {
  return typeof value?.toDate === 'function' ? value.toDate().toISOString() : value ?? null
}

export function projectSubscriptionState({
  businessId, privateRecord, privateRecordExists, legacyRecord, claims = {}, recentEvents = [],
}) {
  const authority = resolveAuthoritativeBusinessSubscription(
    privateRecord,
    legacyRecord,
    { privateRecordExists },
  )
  const entitlements = resolveAuthoritativeBusinessEntitlements(
    privateRecord,
    legacyRecord,
    { privateRecordExists },
  )
  const privateState = privateRecordExists
    ? canonicalPrivateState({ exists: true, data: () => privateRecord }, businessId)
    : { valid: false, version: 0 }
  const canonicalStored = privateRecordExists
    ? privateState.valid ? privateState.normalized.subscription : null
    : authority.normalized.source === 'canonical' ? authority.normalized.subscription : null
  return {
    effectivePlanId: entitlements.effectivePlanId,
    effectivePlanRevision: entitlements.effectivePlanRevision,
    storedPlanId: canonicalStored?.planId ?? null,
    storedPlanRevision: canonicalStored?.planRevision ?? null,
    assignmentStatus: canonicalStored?.accessStatus ?? null,
    assignmentVersion: privateState.version,
    sourceType: authority.authoritySource,
    fallbackReason: authority.normalized.fallbackReason,
    issueCode: issueCode(authority.normalized),
    isMalformed: authority.isMalformed,
    isLegacyFallback: authority.isLegacyFallback,
    canAssign: claims.admin === true,
    recentAssignmentEvents: recentEvents.map((event) => ({
      eventId: event.eventId,
      outcome: event.outcome,
      previousPlanId: event.previousPlanId ?? null,
      newPlanId: event.newPlanId ?? null,
      reason: event.reason ?? '',
      createdAt: timestampValue(event.createdAt),
    })),
  }
}

export async function loadSubscriptionProjection({ businessId, legacyRecord, claims, db }) {
  const subscriptionRef = db.doc(`businessSubscriptions/${businessId}`)
  const [subscriptionSnapshot, historySnapshot] = await Promise.all([
    subscriptionRef.get(),
    subscriptionRef.collection('assignmentEvents').orderBy('createdAt', 'desc').limit(HISTORY_LIMIT).get(),
  ])
  return projectSubscriptionState({
    businessId,
    privateRecord: subscriptionSnapshot.exists ? subscriptionSnapshot.data() : null,
    privateRecordExists: subscriptionSnapshot.exists,
    legacyRecord,
    claims,
    recentEvents: historySnapshot.docs.map((snapshot) => ({ eventId: snapshot.id, ...snapshot.data() })),
  })
}
