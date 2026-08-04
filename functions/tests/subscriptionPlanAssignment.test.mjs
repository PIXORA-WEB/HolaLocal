import test from 'node:test'
import assert from 'node:assert/strict'
import { PLAN_DEFINITIONS } from '@holalocal/firebase-contract'
import { assignBusinessSubscriptionPlan, projectSubscriptionState } from '../src/subscriptionPlanAssignment.js'
import { handleAssignBusinessSubscriptionPlan } from '../src/index.js'
import { FakeFirestore } from './fakeFirestore.mjs'

const baseInput = {
  uid: 'admin-1',
  claims: { admin: true },
  businessId: 'business-1',
  planId: 'growth',
  reason: 'Approved manual plan assignment.',
  requestId: 'assignment_request_001',
  expectedAssignmentVersion: 0,
}

function business(overrides = {}) {
  return {
    ownerId: 'owner-1', managerIds: ['owner-1', 'manager-1'],
    name: 'Test business', status: 'active', deletedAt: null,
    subscription: { tier: 'free' }, ...overrides,
  }
}

function canonicalSubscription(overrides = {}) {
  return {
    schemaVersion: 1, businessId: 'business-1', planId: 'starter', planRevision: 1,
    accessStatus: 'active', assignmentSource: 'admin', assignedAt: null,
    startsAt: null, endsAt: null, updatedAt: null, updatedBy: 'admin-0',
    assignmentVersion: 1, ...overrides,
  }
}

function code(error) {
  return error?.code
}

test('assignment is admin-only across authentication and role boundaries', async () => {
  const db = new FakeFirestore({ 'businesses/business-1': business() })
  for (const input of [
    { uid: '', claims: { admin: true }, expected: 'unauthenticated' },
    { uid: 'moderator', claims: { moderator: true }, expected: 'permission-denied' },
    { uid: 'owner-1', claims: {}, expected: 'permission-denied' },
    { uid: 'manager-1', claims: {}, expected: 'permission-denied' },
    { uid: 'customer', claims: {}, expected: 'permission-denied' },
  ]) {
    await assert.rejects(
      () => assignBusinessSubscriptionPlan({ ...baseInput, ...input, db }),
      (error) => code(error) === input.expected,
    )
  }
  assert.equal(db.data('businessSubscriptions/business-1'), undefined)
})

test('assignment strictly validates identifiers, plan, reason, version and request payload', async () => {
  const db = new FakeFirestore({ 'businesses/business-1': business() })
  for (const change of [
    { businessId: '../bad' }, { planId: 'enterprise' }, { reason: '' },
    { reason: 'x'.repeat(2001) }, { requestId: 'short' },
    { expectedAssignmentVersion: -1 }, { expectedAssignmentVersion: 1.5 },
  ]) {
    await assert.rejects(
      () => assignBusinessSubscriptionPlan({ ...baseInput, ...change, db }),
      (error) => code(error) === 'invalid-argument',
    )
  }
  await assert.rejects(() => handleAssignBusinessSubscriptionPlan({
    auth: { uid: 'admin-1', token: { admin: true } },
    data: { ...baseInput, uid: undefined, claims: undefined, unexpected: true },
  }, db), (error) => code(error) === 'invalid-argument')
})

test('missing private state initializes canonical state and immutable bounded history', async () => {
  const db = new FakeFirestore({ 'businesses/business-1': business() })
  const result = await assignBusinessSubscriptionPlan({ ...baseInput, reason: '  Normalized reason.  ', db })
  assert.deepEqual(result, {
    ok: true, changed: true, repaired: false, outcome: 'initialized',
    businessId: 'business-1', planId: 'growth', planRevision: PLAN_DEFINITIONS.growth.revision,
    effectivePlanId: 'growth', assignmentVersion: 1, requestId: 'assignment_request_001',
  })
  const latest = db.data('businessSubscriptions/business-1')
  assert.equal(latest.businessId, 'business-1')
  assert.equal(latest.planId, 'growth')
  assert.equal(latest.assignmentSource, 'admin')
  assert.equal(latest.updatedBy, 'admin-1')
  assert.equal(latest.assignmentVersion, 1)
  assert.ok(latest.assignedAt)
  assert.equal(db.data('businesses/business-1').subscription.tier, 'free')
  const event = db.data('businessSubscriptions/business-1/assignmentEvents/assignment_request_001')
  assert.equal(event.reason, 'Normalized reason.')
  assert.equal(event.adminUid, 'admin-1')
  assert.equal(event.outcome, 'initialized')
  assert.equal(event.previousPlanId, 'early_access')
  assert.equal(event.responseSnapshot.assignmentVersion, 1)
  assert.equal(event.requestFingerprint.length, 64)
})

test('suspended assignment succeeds while archived deleted and missing businesses are denied', async () => {
  const suspended = new FakeFirestore({ 'businesses/business-1': business({ status: 'suspended' }) })
  assert.equal((await assignBusinessSubscriptionPlan({ ...baseInput, db: suspended })).outcome, 'initialized')
  for (const [status, message] of [
    ['archived', 'archived-business-plan-assignment-denied'],
    ['deleted', 'deleted-business-terminal'],
  ]) {
    await assert.rejects(
      () => assignBusinessSubscriptionPlan({
        ...baseInput, db: new FakeFirestore({ 'businesses/business-1': business({ status }) }),
      }),
      (error) => code(error) === 'failed-precondition' && error.message.includes(message),
    )
  }
  await assert.rejects(
    () => assignBusinessSubscriptionPlan({ ...baseInput, db: new FakeFirestore() }),
    (error) => code(error) === 'not-found',
  )
})

test('real changes increment assignmentVersion and derive revision from the catalogue', async () => {
  const db = new FakeFirestore({
    'businesses/business-1': business(),
    'businessSubscriptions/business-1': canonicalSubscription(),
  })
  const result = await assignBusinessSubscriptionPlan({ ...baseInput, expectedAssignmentVersion: 1, db })
  assert.equal(result.outcome, 'changed')
  assert.equal(result.assignmentVersion, 2)
  assert.equal(db.data('businessSubscriptions/business-1').planRevision, PLAN_DEFINITIONS.growth.revision)
  assert.equal(db.data('businessSubscriptions/business-1/assignmentEvents/assignment_request_001').assignmentVersionBefore, 1)
})

test('malformed private state is repaired without copying arbitrary source data', async () => {
  const db = new FakeFirestore({
    'businesses/business-1': business(),
    'businessSubscriptions/business-1': {
      businessId: 'business-1', schemaVersion: 1, planId: 'unknown',
      planRevision: 99, assignmentVersion: 4, secret: 'do-not-copy',
    },
  })
  const result = await assignBusinessSubscriptionPlan({ ...baseInput, expectedAssignmentVersion: 4, db })
  assert.equal(result.outcome, 'repaired')
  assert.equal(result.assignmentVersion, 5)
  const event = db.data('businessSubscriptions/business-1/assignmentEvents/assignment_request_001')
  assert.equal(event.repairedMalformedState, true)
  assert.ok(event.issueCodeBefore)
  assert.equal(event.secret, undefined)
  assert.equal(JSON.stringify(event).includes('do-not-copy'), false)
})

test('canonical same-plan requests are audited no-ops and exact retries are idempotent', async () => {
  const db = new FakeFirestore({
    'businesses/business-1': business(),
    'businessSubscriptions/business-1': canonicalSubscription({ planId: 'growth' }),
  })
  const input = { ...baseInput, expectedAssignmentVersion: 1, db }
  const first = await assignBusinessSubscriptionPlan(input)
  const latestBeforeReplay = db.data('businessSubscriptions/business-1')
  const replay = await assignBusinessSubscriptionPlan(input)
  assert.deepEqual(replay, first)
  assert.equal(first.changed, false)
  assert.equal(first.outcome, 'no_change')
  assert.equal(first.assignmentVersion, 1)
  assert.equal(db.data('businessSubscriptions/business-1'), latestBeforeReplay)
  assert.equal(db.data('businessSubscriptions/business-1/assignmentEvents/assignment_request_001').outcome, 'no_change')

  await assert.rejects(
    () => assignBusinessSubscriptionPlan({ ...input, reason: 'A conflicting reason.' }),
    (error) => code(error) === 'already-exists',
  )
})

test('stale expected versions fail before writing an event', async () => {
  const db = new FakeFirestore({
    'businesses/business-1': business(),
    'businessSubscriptions/business-1': canonicalSubscription({ assignmentVersion: 3 }),
  })
  await assert.rejects(
    () => assignBusinessSubscriptionPlan({ ...baseInput, expectedAssignmentVersion: 2, db }),
    (error) => code(error) === 'failed-precondition'
      && error.message.includes('subscription-assignment-state-changed'),
  )
  assert.equal(db.data('businessSubscriptions/business-1/assignmentEvents/assignment_request_001'), undefined)
})

test('admin and moderator projections are limited and expose assignment capability safely', () => {
  const privateRecord = canonicalSubscription()
  const recentEvent = {
    eventId: 'event-1', outcome: 'changed', previousPlanId: 'growth', newPlanId: 'pro',
    reason: 'Reason', createdAt: '2026-08-03T10:00:00.000Z', adminUid: 'admin-1',
    requestFingerprint: 'private', responseSnapshot: { private: true }, secret: 'hidden',
  }
  const admin = projectSubscriptionState({
    businessId: 'business-1', privateRecord, privateRecordExists: true,
    legacyRecord: { tier: 'free' }, claims: { admin: true },
    recentEvents: [recentEvent],
  })
  const moderator = projectSubscriptionState({
    businessId: 'business-1', privateRecord, privateRecordExists: true,
    legacyRecord: null, claims: { moderator: true }, recentEvents: [recentEvent],
  })
  assert.equal(admin.canAssign, true)
  assert.equal(moderator.canAssign, false)
  assert.equal(admin.assignmentVersion, 1)
  assert.equal(admin.recentAssignmentEvents[0].secret, undefined)
  assert.deepEqual(Object.keys(admin.recentAssignmentEvents[0]).sort(), [
    'createdAt', 'eventId', 'newPlanId', 'outcome', 'previousPlanId', 'reason',
  ])
  assert.equal(admin.recentAssignmentEvents[0].adminUid, undefined)
  assert.equal(admin.updatedBy, undefined)
  assert.deepEqual(moderator.recentAssignmentEvents, admin.recentAssignmentEvents)
})

test('malformed and compatibility fallback states never masquerade as canonical stored plans', () => {
  const malformedPrivate = projectSubscriptionState({
    businessId: 'business-1', privateRecord: { planId: 'pro' }, privateRecordExists: true,
    legacyRecord: { tier: 'free' }, claims: { admin: true }, recentEvents: [],
  })
  const legacyCompatibility = projectSubscriptionState({
    businessId: 'business-1', privateRecord: null, privateRecordExists: false,
    legacyRecord: { tier: 'free' }, claims: { moderator: true }, recentEvents: [],
  })
  for (const projection of [malformedPrivate, legacyCompatibility]) {
    assert.equal(projection.effectivePlanId, 'early_access')
    assert.equal(projection.storedPlanId, null)
    assert.equal(projection.storedPlanRevision, null)
  }
})
