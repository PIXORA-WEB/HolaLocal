import test from 'node:test'
import assert from 'node:assert/strict'
import { BUSINESS_MEDIA_ACTIONS, manageBusinessMedia, validateCanonicalStorageObjectMetadata } from '../src/businessMedia.js'
import { projectSafeBusinessMedia } from '../src/businessMediaProjection.js'
import { FakeFirestore } from './fakeFirestore.mjs'

const BUSINESS_ID = 'business-1'
const LOGO = `businesses/${BUSINESS_ID}/logos/logo`
const PHOTO = (slot) => `businesses/${BUSINESS_ID}/photos/${slot}`
const STAGING_LOGO = `businesses/${BUSINESS_ID}/staging/logos/logo`

function activeUser(overrides = {}) { return { accountStatus: 'active', deletionRequestedAt: null, ...overrides } }
function business(overrides = {}) {
  return { ownerId: 'owner', managerIds: ['owner', 'manager'], status: 'draft', deletionRequestedAt: null,
    deletedAt: null, logoStoragePath: null, galleryStoragePaths: [], galleryImages: [], galleryImageURLs: [],
    subscription: { schemaVersion: 1, planId: 'starter', planRevision: 1, accessStatus: 'active', assignmentSource: 'system' },
    ...overrides }
}
function dbWith(overrides = {}) {
  return new FakeFirestore({ 'users/owner': activeUser(), 'users/manager': activeUser(), 'users/other': activeUser(), [`businesses/${BUSINESS_ID}`]: business(overrides) })
}
function bucketWith(generation = null) {
  return { file(path) { return { async getMetadata() { if (generation == null) throw Object.assign(new Error('missing'), { code: 404 }); return [{ name: path, generation }] } } } }
}
function bucketFrom(metadataByPath) {
  return { file(path) { return { async getMetadata() {
    const metadata = metadataByPath.get(path)
    if (!metadata) throw Object.assign(new Error('missing'), { code: 404 })
    return [metadata]
  } } } }
}
function prepareArgs(overrides = {}) {
  return { uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.PREPARE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, db: dbWith(), bucket: bucketWith(), now: new Date(1000), ...overrides }
}
async function bindUpload(db, generation = '9') {
  await db.doc(`mediaUploadSessions/business_${BUSINESS_ID}_logo`)
    .update({ stagingGeneration: generation, state: 'uploaded' })
}

test('prepare requires active authorized manager, exact paths, and captures destination generation', async () => {
  const db = dbWith()
  const prepared = await manageBusinessMedia(prepareArgs({ db, bucket: bucketWith('88') }))
  assert.equal(prepared.stagingPath, STAGING_LOGO)
  const session = db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`)
  assert.equal(session.expectedCanonicalGeneration, '88')
  assert.equal(session.principalUid, 'owner')
  await assert.rejects(manageBusinessMedia(prepareArgs({ uid: 'other' })), /business-management-required/)
  await assert.rejects(manageBusinessMedia(prepareArgs({ storagePath: 'businesses/other/logos/logo' })), /invalid-canonical/)
})

test('one bounded logical slot rejects a concurrent active prepare', async () => {
  const db = dbWith()
  await manageBusinessMedia(prepareArgs({ db }))
  await assert.rejects(manageBusinessMedia(prepareArgs({ db, now: new Date(2000) })), /media-upload-already-active/)
})

test('finalize promotes exact cleaned generation before manifest update and then conditionally cleans staging', async () => {
  const db = dbWith()
  const prepared = await manageBusinessMedia(prepareArgs({ db }))
  await bindUpload(db)
  const calls = []
  const result = await manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db,
    bucket: bucketWith(), now: new Date(2000),
    clean: async (input) => { calls.push(['clean', input.path, input.generation]); return { metageneration: '2' } },
    promote: async (input) => { calls.push(['promote', input]); return { generation: '10' } },
    clearContext: async (input) => calls.push(['clear-context', input.path, input.generation]),
    removeExact: async (input) => calls.push(['remove', input.path, input.generation]),
  })
  assert.equal(result.ok, true)
  assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, `${LOGO}/a`)
  assert.equal(db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`).state, 'completed')
  assert.deepEqual(calls[0], ['clean', STAGING_LOGO, '9'])
  assert.equal(calls[1][0], 'promote')
  assert.equal(calls[1][1].expectedCanonicalGeneration, '0')
  assert.equal(calls[1][1].canonicalPath, `${LOGO}/a`)
  assert.deepEqual(calls[2], ['clear-context', `${LOGO}/a`, '10'])
  assert.deepEqual(calls[3], ['remove', STAGING_LOGO, '9'])
})

test('failed promotion leaves the old manifest untouched', async () => {
  const db = dbWith({ logoStoragePath: LOGO })
  const prepared = await manageBusinessMedia(prepareArgs({ db, bucket: bucketWith('7') }))
  await bindUpload(db)
  await assert.rejects(manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db, bucket: bucketWith(),
    now: new Date(2000),
    clean: async () => ({ metageneration: '2' }), promote: async () => { throw new Error('precondition') },
    clearContext: async () => undefined,
  }), /precondition/)
  assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, LOGO)
})

test('A/B replacement preserves old authority when business state changes before the switch', async () => {
  const db = dbWith({ logoStoragePath: `${LOGO}/a` })
  const prepared = await manageBusinessMedia(prepareArgs({ db, bucket: bucketWith('7') }))
  const session = db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`)
  assert.equal(session.canonicalPath, `${LOGO}/b`)
  assert.equal(session.expectedAuthorityPath, `${LOGO}/a`)
  await bindUpload(db)
  await assert.rejects(manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db,
    bucket: bucketWith(), now: new Date(2000), clean: async () => ({ metageneration: '2' }),
    promote: async () => ({ generation: '10' }),
    clearContext: async () => db.doc(`businesses/${BUSINESS_ID}`).update({ status: 'active' }),
  }), /business-media-not-editable/)
  assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, `${LOGO}/a`)
  assert.equal(db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`).state, 'failed')

  const reverseDb = dbWith({ logoStoragePath: `${LOGO}/b` })
  await manageBusinessMedia(prepareArgs({ db: reverseDb, bucket: bucketWith('11'), now: new Date(3000) }))
  assert.equal(
    reverseDb.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`).canonicalPath,
    `${LOGO}/a`,
  )
})

for (const { currentSlot, nextSlot, oldGeneration } of [
  { currentSlot: 'a', nextSlot: 'b', oldGeneration: '7' },
  { currentSlot: 'b', nextSlot: 'a', oldGeneration: '8' },
]) {
  test(`successful ${currentSlot.toUpperCase()} to ${nextSlot.toUpperCase()} replacement switches authority atomically and cleans the old generation`, async () => {
    const currentPath = `${LOGO}/${currentSlot}`
    const nextPath = `${LOGO}/${nextSlot}`
    const metadata = new Map([[currentPath, { name: currentPath, generation: oldGeneration }]])
    const bucket = bucketFrom(metadata)
    const db = dbWith({ logoStoragePath: currentPath })
    const prepared = await manageBusinessMedia(prepareArgs({ db, bucket }))
    await bindUpload(db)
    const removed = []
    const result = await manageBusinessMedia({
      uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
      storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db, bucket,
      now: new Date(2000), clean: async () => ({ metageneration: '2' }),
      promote: async ({ canonicalPath }) => {
        assert.equal(canonicalPath, nextPath)
        metadata.set(nextPath, {
          name: nextPath, generation: '10', metageneration: '2',
          size: '100', contentType: 'image/png', metadata: {},
        })
        return { generation: '10' }
      },
      clearContext: async ({ path, generation }) => {
        assert.equal(path, nextPath)
        assert.equal(generation, '10')
        assert.deepEqual(metadata.get(path).metadata, {})
      },
      removeExact: async (target) => removed.push({ path: target.path, generation: target.generation }),
    })
    const session = db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`)
    assert.equal(result.storagePath, nextPath)
    assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, nextPath)
    assert.equal(session.state, 'completed')
    assert.equal(session.promotedGeneration, '10')
    assert.equal(session.cleanupPending, false)
    assert.deepEqual(removed, [
      { path: STAGING_LOGO, generation: '9' },
      { path: currentPath, generation: oldGeneration },
    ])
  })
}

test('failed exact old-slot cleanup retains responsibility and completed retry reconciles it safely', async () => {
  const currentPath = `${LOGO}/a`
  const nextPath = `${LOGO}/b`
  const metadata = new Map([[currentPath, { name: currentPath, generation: '7' }]])
  const bucket = bucketFrom(metadata)
  const db = dbWith({ logoStoragePath: currentPath })
  const prepared = await manageBusinessMedia(prepareArgs({ db, bucket }))
  await bindUpload(db)
  let promotions = 0
  const firstCleanupCalls = []
  const result = await manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db, bucket,
    now: new Date(2000), clean: async () => ({ metageneration: '2' }),
    promote: async ({ canonicalPath }) => {
      promotions += 1
      assert.equal(canonicalPath, nextPath)
      metadata.set(nextPath, {
        name: nextPath, generation: '10', metageneration: '2',
        size: '100', contentType: 'image/png', metadata: {},
      })
      return { generation: '10' }
    },
    clearContext: async () => undefined,
    removeExact: async ({ path, generation }) => {
      firstCleanupCalls.push({ path, generation })
      if (path === currentPath) {
        throw Object.assign(new Error('newer generation protected by precondition'), { code: 412 })
      }
    },
  })

  const pending = db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`)
  assert.equal(result.storagePath, nextPath)
  assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, nextPath)
  assert.equal(pending.state, 'completed')
  assert.equal(pending.cleanupPending, true)
  assert.equal(pending.cleanupFailure, 'generation-mismatch')
  assert.equal(pending.cleanupOldPath, currentPath)
  assert.equal(pending.cleanupOldGeneration, '7')
  assert.equal(promotions, 1)
  assert.deepEqual(firstCleanupCalls, [
    { path: STAGING_LOGO, generation: '9' },
    { path: currentPath, generation: '7' },
  ])

  const retryCleanupCalls = []
  const retry = await manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db, bucket,
    now: new Date(3000),
    promote: async () => { promotions += 1; return { generation: 'unexpected' } },
    removeExact: async ({ path, generation }) => retryCleanupCalls.push({ path, generation }),
  })

  const completed = db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`)
  assert.equal(retry.idempotent, true)
  assert.equal(retry.storagePath, nextPath)
  assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, nextPath)
  assert.equal(completed.state, 'completed')
  assert.equal(completed.cleanupPending, false)
  assert.equal(completed.cleanupFailure, null)
  assert.equal(completed.cleanupOldPath, currentPath)
  assert.equal(completed.cleanupOldGeneration, '7')
  assert.equal(promotions, 1)
  assert.deepEqual(retryCleanupCalls, [
    { path: STAGING_LOGO, generation: '9' },
    { path: currentPath, generation: '7' },
  ])
})

test('post-commit crash retries completed business finalization without a second promotion', async () => {
  const db = dbWith()
  const prepared = await manageBusinessMedia(prepareArgs({ db }))
  await bindUpload(db)
  let promotions = 0
  await assert.rejects(manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db,
    bucket: bucketWith(), now: new Date(2000),
    clean: async () => ({ metageneration: '2' }),
    promote: async () => { promotions += 1; return { generation: '10' } },
    clearContext: async () => undefined,
    afterAuthorityCommit: async () => { throw new Error('post-commit-crash') },
  }), /post-commit-crash/)
  assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, `${LOGO}/a`)
  assert.equal(db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`).state, 'completed')
  assert.equal(db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`).cleanupPending, true)

  const removed = []
  const retry = await manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db,
    bucket: bucketWith(), now: new Date(3000),
    promote: async () => { promotions += 1; return { generation: 'unexpected' } },
    removeExact: async (target) => removed.push(target),
  })
  assert.equal(retry.idempotent, true)
  assert.equal(retry.storagePath, `${LOGO}/a`)
  assert.equal(promotions, 1)
  assert.equal(db.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`).cleanupPending, false)
  assert.deepEqual(removed.map(({ path, generation }) => ({ path, generation })), [
    { path: STAGING_LOGO, generation: '9' },
  ])
})

test('pre-commit transaction failure leaves old authority and retry completes the promoted checkpoint', async () => {
  const backing = dbWith({ logoStoragePath: `${LOGO}/a` })
  let failNextTransaction = false
  const db = {
    doc: (...args) => backing.doc(...args),
    runTransaction: async (callback) => {
      if (failNextTransaction) { failNextTransaction = false; throw new Error('transaction-not-committed') }
      return backing.runTransaction(callback)
    },
  }
  const initialMetadata = new Map([[
    `${LOGO}/a`, { name: `${LOGO}/a`, generation: '7' },
  ]])
  const prepared = await manageBusinessMedia(prepareArgs({ db, bucket: bucketFrom(initialMetadata) }))
  await bindUpload(backing)
  let promotions = 0
  failNextTransaction = true
  await assert.rejects(manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db,
    bucket: bucketFrom(initialMetadata), now: new Date(2000),
    clean: async () => ({ metageneration: '2' }),
    promote: async () => { promotions += 1; return { generation: '10' } },
    clearContext: async () => undefined,
  }), /transaction-not-committed/)
  assert.equal(backing.data(`businesses/${BUSINESS_ID}`).logoStoragePath, `${LOGO}/a`)
  assert.equal(backing.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`).state, 'promoted')

  initialMetadata.set(`${LOGO}/b`, {
    name: `${LOGO}/b`, generation: '10', metageneration: '2',
    size: '100', contentType: 'image/png', metadata: {},
  })
  const retry = await manageBusinessMedia({
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.FINALIZE_LOGO, businessId: BUSINESS_ID,
    storagePath: LOGO, requestId: prepared.requestId, stagingGeneration: '9', db,
    bucket: bucketFrom(initialMetadata), now: new Date(3000),
    promote: async () => { promotions += 1; return { generation: 'unexpected' } },
    clearContext: async () => undefined,
    removeExact: async () => undefined,
  })
  assert.equal(retry.storagePath, `${LOGO}/b`)
  assert.equal(promotions, 1)
  assert.equal(backing.data(`businesses/${BUSINESS_ID}`).logoStoragePath, `${LOGO}/b`)
  assert.equal(backing.data(`mediaUploadSessions/business_${BUSINESS_ID}_logo`).state, 'completed')
})

test('new backend retains old live website set/add protocol during transition', async () => {
  const db = dbWith()
  const metadata = { contentType: 'image/png', size: '100', metadata: { firebaseStorageDownloadTokens: 'hidden' } }
  await manageBusinessMedia({ uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.SET_LOGO,
    businessId: BUSINESS_ID, storagePath: LOGO, db, bucket: {}, readObjectMetadata: async () => metadata })
  await manageBusinessMedia({ uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.ADD_GALLERY,
    businessId: BUSINESS_ID, storagePath: PHOTO(0), db, bucket: {}, readObjectMetadata: async () => metadata })
  assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, LOGO)
  assert.deepEqual(db.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths, [PHOTO(0)])
})

test('gallery prepare enforces slot bounds, lifecycle and entitlement capacity', async () => {
  const full = dbWith({ galleryStoragePaths: [0, 1, 2, 3].map(PHOTO) })
  await assert.rejects(manageBusinessMedia({ ...prepareArgs({ db: full }), action: BUSINESS_MEDIA_ACTIONS.PREPARE_GALLERY, storagePath: PHOTO(4) }), /business-gallery-limit/)
  await assert.rejects(manageBusinessMedia({ ...prepareArgs({ db: dbWith({ status: 'active' }) }), action: BUSINESS_MEDIA_ACTIONS.PREPARE_GALLERY, storagePath: PHOTO(0) }), /business-media-not-editable/)
  await assert.rejects(manageBusinessMedia({ ...prepareArgs(), action: BUSINESS_MEDIA_ACTIONS.PREPARE_GALLERY, storagePath: PHOTO(8) }), /invalid-canonical/)
})

test('canonical metadata validator rejects tokens and every other custom key', () => {
  const valid = { contentType: 'image/webp', size: '1024', metadata: {} }
  assert.doesNotThrow(() => validateCanonicalStorageObjectMetadata(valid))
  for (const metadata of [{ firebaseStorageDownloadTokens: 'x' }, { originalName: 'x' }]) {
    assert.throws(() => validateCanonicalStorageObjectMetadata({ ...valid, metadata }), /business-media-forbidden-metadata/)
  }
})

test('removal depublishes before origin deletion and legacy projection remains strict', async () => {
  const db = dbWith({ logoStoragePath: LOGO, galleryStoragePaths: [PHOTO(0)] })
  await manageBusinessMedia({ ...prepareArgs({ db }), action: BUSINESS_MEDIA_ACTIONS.REMOVE_GALLERY,
    storagePath: PHOTO(0), deleteObject: async () => 'deleted' })
  assert.deepEqual(db.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths, [])
  const projected = projectSafeBusinessMedia(BUSINESS_ID, {
    logoStoragePath: LOGO, galleryStoragePaths: [PHOTO(1), 'businesses/other/photos/0'],
    logoUrl: 'https://evil.invalid/logo', galleryUrls: ['https://evil.invalid/photo'],
  })
  assert.equal(projected.logoStoragePath, LOGO)
  assert.deepEqual(projected.galleryStoragePaths, [PHOTO(1)])
  assert.equal(projected.logoUrl, null)
  assert.deepEqual(projected.galleryUrls, [])
})
