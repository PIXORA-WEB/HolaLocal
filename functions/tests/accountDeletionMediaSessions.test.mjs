import assert from 'node:assert/strict'
import test from 'node:test'
import { Timestamp } from 'firebase-admin/firestore'
import { cleanupUserMedia } from '../src/accountDeletionPrimitives.js'
import { finalizeAccountDeletion } from '../src/accountDeletionFinalizer.js'
import { customerReviewCleanupPath } from '../src/customerReviewDeletion.js'
import { OpenMediaFirestore as FakeFirestore } from './mediaCutoverFixture.mjs'

const emptyBucket = { getFiles: async () => [[]] }
const session = uid => ({ uid, state: 'completed', path: `users/${uid}/profile/image`, promotedGeneration: '1' })
function failingDeletion(db, paths, code = 14) {
  const original = db.runTransaction.bind(db)
  db.runTransaction = callback => original(transaction => {
    const remove = transaction.delete.bind(transaction)
    transaction.delete = ref => {
      if (paths.has(ref.path)) throw Object.assign(new Error('Synthetic metadata failure with private path'), { code })
      return remove(ref)
    }
    return callback(transaction)
  })
}
for (const code of [7, 14, 5]) {
  test(`session deletion error ${code} reports failure, never confirmed absence`, async () => {
    const db = new FakeFirestore({ 'mediaUploadSessions/profile_target': session('target') })
    failingDeletion(db, new Set(['mediaUploadSessions/profile_target']), code)
    const result = await cleanupUserMedia({ uid: 'target', bucket: emptyBucket, db })
    assert.deepEqual(result, { ok: false, retryable: true, counts: { attempted: 1, deleted: 0, alreadyMissing: 0, failed: 1 } })
    assert.ok(db.data('mediaUploadSessions/profile_target'))
    assert.equal(JSON.stringify(result).includes('private'), false)
  })
}
test('missing session deletion is idempotent without inferring absence from errors', async () => {
  const db = new FakeFirestore()
  for (let i = 0; i < 2; i++) {
    // Firestore delete without a precondition acknowledges even an absent record.
    assert.deepEqual(await cleanupUserMedia({ uid: 'target', bucket: emptyBucket, db }), {
      ok: true, retryable: false, counts: { attempted: 1, deleted: 1, alreadyMissing: 0, failed: 0 },
    })
  }
})
test('separate UID cleanup attempts preserve partial session progress and unrelated promotion records', async () => {
  const db = new FakeFirestore(Object.fromEntries(['one', 'two', 'three', 'unrelated'].map(uid => [`mediaUploadSessions/profile_${uid}`, session(uid)])))
  const failures = new Set(['mediaUploadSessions/profile_two']); failingDeletion(db, failures)
  const results = []
  // The primitive owns one canonical slot per UID, not a collection-wide sweep.
  for (const uid of ['one', 'two', 'three']) results.push(await cleanupUserMedia({ uid, bucket: emptyBucket, db }))
  assert.deepEqual(results.map(r => r.ok), [true, false, true])
  assert.equal(results.reduce((n, r) => n + r.counts.failed, 0), 1)
  assert.equal(db.data('mediaUploadSessions/profile_one'), undefined)
  assert.equal(db.data('mediaUploadSessions/profile_three'), undefined)
  assert.deepEqual(db.data('mediaUploadSessions/profile_unrelated'), session('unrelated'))
  failures.clear()
  assert.equal((await cleanupUserMedia({ uid: 'two', bucket: emptyBucket, db })).ok, true)
})
test('Storage failures retain the session owner and report only attempted object operations', async () => {
  const db = new FakeFirestore({ 'mediaUploadSessions/profile_target': session('target') })
  const bucket = { getFiles: async ({ prefix }) => {
    assert.equal(prefix, 'users/target/')
    return [[{ delete: async () => {} }, { delete: async () => { throw { code: 404 } } }, { delete: async () => { throw { code: 503 } } }]]
  } }
  assert.deepEqual(await cleanupUserMedia({ uid: 'target', bucket, db }), {
    ok: false, retryable: true, counts: { attempted: 3, deleted: 1, alreadyMissing: 1, failed: 1 },
  })
  assert.deepEqual(db.data('mediaUploadSessions/profile_target'), session('target'))
})
test('real finalizer persists retry state before profile/Auth removal, then resumes with real cleanup', async () => {
  const stamp = Timestamp.fromMillis(1700000000000)
  const user = { businessId: null, termsAccepted: true, termsVersion: '1.0', termsAcceptedAt: stamp, privacyAccepted: true, privacyVersion: '1.0', privacyAcceptedAt: stamp }
  const db = new FakeFirestore({
    'accountDeletionRequests/target': { uid: 'target', state: 'requested', requestVersion: 1 },
    'mediaUploadSessions/profile_target': session('target'),
  })
  // Preserve SDK Timestamp prototypes; FakeFirestore's seed clone strips them.
  db.store.set('users/target', user)
  const failures = new Set(['mediaUploadSessions/profile_target']); failingDeletion(db, failures)
  const objects = new Set(['image'])
  const bucket = { getFiles: async () => [[...objects].map(name => ({ delete: async () => { objects.delete(name) } }))] }
  const calls = []
  const primitives = {
    cleanupMedia: args => cleanupUserMedia({ ...args, bucket }),
    // Review erasure is a separate lifecycle; supply only its completion prerequisite.
    cleanupCustomerReviews: async () => { calls.push('reviews'); db.store.set(customerReviewCleanupPath('target'), { complete: true }); return { complete: true } },
    deleteAuthUser: async () => { calls.push('auth'); return { ok: true } },
  }
  const invoke = version => finalizeAccountDeletion({ adminUid: 'admin', claims: { admin: true }, uid: 'target', expectedRequestVersion: version, db, primitives })
  const failed = await invoke(1)
  assert.equal(failed.state, 'failed_retryable')
  assert.equal(failed.failureCode, 'profile_media_cleanup_failed')
  assert.equal(failed.lastCompletedStep, 'saved_businesses_cleaned')
  assert.deepEqual(failed.cleanupCounts, { attempted: 2, deleted: 1, alreadyMissing: 0, failed: 1 })
  assert.equal(db.data('accountDeletionRequests/target').state, 'failed_retryable')
  assert.equal(db.data('accountDeletionRequests/target').lastCompletedStep, 'saved_businesses_cleaned')
  assert.deepEqual(db.data('users/target'), user)
  assert.deepEqual(calls, [])
  assert.equal(objects.size, 0) // Does not establish retained image bytes.
  assert.ok(db.data('mediaUploadSessions/profile_target'))
  failures.clear()
  const completed = await invoke(failed.requestVersion)
  assert.equal(completed.state, 'completed')
  assert.equal(db.data('users/target'), undefined)
  assert.equal(db.data('mediaUploadSessions/profile_target'), undefined)
  assert.deepEqual(calls, ['reviews', 'auth'])
  assert.equal(db.data('accountDeletionRequests/target').retainedConsentEvidence.termsVersion, '1.0')
})
