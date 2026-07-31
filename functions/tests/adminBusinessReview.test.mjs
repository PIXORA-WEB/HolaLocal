import test from 'node:test'
import assert from 'node:assert/strict'
import { getAdminBusinessReview } from '../src/adminBusinessReview.js'
import { FakeFirestore } from './fakeFirestore.mjs'

test('admin review returns only limited owner fields and recent protected moderation data', async () => {
  const db = new FakeFirestore({
    'businesses/business-1': {
      ownerId: 'owner-1', name: 'Review me', status: 'pending_review',
    },
    'businessPrivate/business-1': {
      ownerId: 'owner-1',
      contact: { phone: 'private' },
      currentRejection: { reasonCode: 'other', guidance: 'Prior guidance' },
    },
    'users/owner-1': {
      displayName: 'Owner', email: 'owner@example.invalid', preferredLocale: 'es',
      privateAddress: 'must not be returned', roles: ['business'],
    },
    'businesses/business-1/moderationEvents/event-1': {
      action: 'reject', createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  })
  const result = await getAdminBusinessReview({
    uid: 'admin-1', claims: { admin: true }, businessId: 'business-1', db,
  })
  assert.deepEqual(result.owner, {
    uid: 'owner-1', displayName: 'Owner', email: 'owner@example.invalid', preferredLocale: 'es',
  })
  assert.equal(result.privateModeration.currentRejection.guidance, 'Prior guidance')
  assert.equal(result.history.length, 1)
  assert.equal(result.owner.privateAddress, undefined)
})

test('admin review denies an ordinary authenticated business owner', async () => {
  await assert.rejects(() => getAdminBusinessReview({
    uid: 'owner-1',
    claims: {},
    businessId: 'business-1',
    db: new FakeFirestore(),
  }), (error) => error?.code === 'permission-denied')
})
