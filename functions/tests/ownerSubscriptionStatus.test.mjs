import test from 'node:test'
import assert from 'node:assert/strict'
import { getOwnerSubscriptionStatus } from '../src/ownerSubscriptionStatus.js'
import { FakeFirestore } from './fakeFirestore.mjs'

function database() {
  return new FakeFirestore({
    'businesses/business-1': {
      ownerId: 'owner-1', managerIds: ['owner-1', 'manager-1'], subscription: { tier: 'free' },
    },
    'businessSubscriptions/business-1': {
      schemaVersion: 1, businessId: 'business-1', planId: 'growth', planRevision: 1,
      accessStatus: 'active', assignmentSource: 'admin', assignmentVersion: 3,
      updatedBy: 'admin-1', reason: 'private', requestId: 'private-request',
    },
  })
}

test('owner and manager receive only effective subscription entitlements', async () => {
  for (const uid of ['owner-1', 'manager-1']) {
    const result = await getOwnerSubscriptionStatus({ uid, businessId: 'business-1', db: database() })
    assert.equal(result.effectivePlanId, 'growth')
    assert.equal(result.sourceType, 'private_authoritative')
    assert.equal(result.features.publicListing, true)
    assert.equal(result.updatedBy, undefined)
    assert.equal(result.assignmentVersion, undefined)
    assert.equal(result.reason, undefined)
  }
})

test('unrelated authenticated users cannot inspect owner subscription status', async () => {
  const db = database()
  await assert.rejects(
    () => getOwnerSubscriptionStatus({ uid: 'customer', businessId: 'business-1', db }),
    (error) => error?.code === 'permission-denied',
  )
  assert.deepEqual(db.readPaths, ['businesses/business-1'])
})

test('owner subscription status validates bounded business IDs before reads', async () => {
  const db = database()
  for (const businessId of ['', 'bad/id', 'x'.repeat(129)]) {
    await assert.rejects(
      () => getOwnerSubscriptionStatus({ uid: 'owner-1', businessId, db }),
      (error) => error?.code === 'invalid-argument',
    )
  }
  assert.deepEqual(db.readPaths, [])
})
