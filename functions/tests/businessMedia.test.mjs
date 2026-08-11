import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUSINESS_MEDIA_ACTIONS,
  manageBusinessMedia,
  validateCanonicalStorageObjectMetadata,
} from '../src/businessMedia.js'
import { projectSafeBusinessMedia } from '../src/businessMediaProjection.js'
import { FakeFirestore } from './fakeFirestore.mjs'

const BUSINESS_ID = 'business-1'
const LOGO = `businesses/${BUSINESS_ID}/logos/logo`
const PHOTO = (slot) => `businesses/${BUSINESS_ID}/photos/${slot}`
const TOKEN = '01234567-89ab-4cde-8fab-0123456789ab'

function legacyUrl(path) {
  return `https://firebasestorage.googleapis.com/v0/b/holalocal-491c9.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=${TOKEN}`
}

function activeUser(overrides = {}) {
  return { accountStatus: 'active', deletionRequestedAt: null, ...overrides }
}

function business(overrides = {}) {
  return {
    ownerId: 'owner',
    managerIds: ['owner', 'manager'],
    status: 'draft',
    deletionRequestedAt: null,
    deletedAt: null,
    logoStoragePath: null,
    galleryStoragePaths: [],
    galleryImages: [],
    galleryImageURLs: [],
    subscription: {
      schemaVersion: 1, planId: 'starter', planRevision: 1,
      accessStatus: 'active', assignmentSource: 'system',
    },
    untouched: { private: true },
    ...overrides,
  }
}

function dbWith(overrides = {}, userOverrides = {}) {
  return new FakeFirestore({
    'users/owner': activeUser(userOverrides),
    'users/manager': activeUser(),
    'users/other': activeUser(),
    [`businesses/${BUSINESS_ID}`]: business(overrides),
  })
}

function metadata(overrides = {}) {
  return { contentType: 'image/webp', size: '1024', metadata: {}, ...overrides }
}

function args(overrides = {}) {
  return {
    uid: 'owner', action: BUSINESS_MEDIA_ACTIONS.ADD_GALLERY,
    businessId: BUSINESS_ID, storagePath: PHOTO(0), db: dbWith(),
    readObjectMetadata: async () => metadata(),
    deleteObject: async () => 'deleted',
    ...overrides,
  }
}

function code(error) { return error?.code }

test('requires authentication, an active account and authoritative owner or manager access', async () => {
  await assert.rejects(() => manageBusinessMedia(args({ uid: '' })), (error) => code(error) === 'unauthenticated')
  for (const account of [
    { accountStatus: 'suspended' },
    { accountStatus: 'deleted' },
    { accountStatus: 'active', deletionRequestedAt: new Date() },
  ]) {
    await assert.rejects(
      () => manageBusinessMedia(args({ db: dbWith({}, account) })),
      (error) => code(error) === 'failed-precondition',
    )
  }
  await assert.rejects(
    () => manageBusinessMedia(args({ uid: 'other', db: dbWith() })),
    (error) => code(error) === 'permission-denied',
  )
  await manageBusinessMedia(args())
  const managerDb = dbWith()
  await manageBusinessMedia(args({ uid: 'manager', db: managerDb, storagePath: PHOTO(1) }))
  assert.deepEqual(managerDb.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths, [PHOTO(1)])
})

test('rejects non-editable or deletion-state businesses without normalizing them', async () => {
  for (const state of [
    { status: 'active' }, { status: 'pending_review' }, { status: 'suspended' },
    { status: 'archived' }, { status: 'deleted', deletedAt: new Date() },
    { status: 'draft', deletionRequestedAt: new Date() },
  ]) {
    const db = dbWith(state)
    await assert.rejects(
      () => manageBusinessMedia(args({ db })),
      (error) => code(error) === 'failed-precondition',
    )
    assert.deepEqual(db.data(`businesses/${BUSINESS_ID}`), business(state))
  }
})

test('accepts only exact business-bound canonical logo and gallery paths', async () => {
  const valid = [
    [BUSINESS_MEDIA_ACTIONS.SET_LOGO, LOGO],
    [BUSINESS_MEDIA_ACTIONS.ADD_GALLERY, PHOTO(0)],
    [BUSINESS_MEDIA_ACTIONS.ADD_GALLERY, PHOTO(7)],
  ]
  for (const [action, storagePath] of valid) {
    await manageBusinessMedia(args({ action, storagePath, db: dbWith() }))
  }
  for (const [action, storagePath] of [
    [BUSINESS_MEDIA_ACTIONS.ADD_GALLERY, PHOTO(8)],
    [BUSINESS_MEDIA_ACTIONS.ADD_GALLERY, 'businesses/other/photos/0'],
    [BUSINESS_MEDIA_ACTIONS.ADD_GALLERY, `businesses/${BUSINESS_ID}/photos/file.jpg`],
    [BUSINESS_MEDIA_ACTIONS.SET_LOGO, `businesses/${BUSINESS_ID}/logos/other`],
    [BUSINESS_MEDIA_ACTIONS.SET_LOGO, legacyUrl(`businesses/${BUSINESS_ID}/logos/legacy.jpg`)],
  ]) {
    await assert.rejects(
      () => manageBusinessMedia(args({ action, storagePath, db: dbWith() })),
      (error) => code(error) === 'invalid-argument',
    )
  }
})

test('verifies existence, type, strict size and forbidden custom metadata', async () => {
  await assert.rejects(
    () => manageBusinessMedia(args({ readObjectMetadata: async () => { const error = new Error('missing'); error.code = 404; throw error } })),
    (error) => code(error) === 'failed-precondition' && error.message === 'business-media-object-missing',
  )
  for (const invalid of [
    metadata({ contentType: 'image/svg+xml' }),
    metadata({ size: String(5 * 1024 * 1024) }),
    metadata({ size: String(5 * 1024 * 1024 + 1) }),
    metadata({ size: '1e3' }),
    metadata({ metadata: 'originalName' }),
    metadata({ metadata: { originalName: 'private-name.jpg' } }),
    metadata({ metadata: { arbitrary: 'value' } }),
  ]) {
    assert.throws(() => validateCanonicalStorageObjectMetadata(invalid), (error) => code(error) === 'failed-precondition')
  }
  assert.doesNotThrow(() => validateCanonicalStorageObjectMetadata(metadata()))
  assert.doesNotThrow(() => validateCanonicalStorageObjectMetadata(metadata({
    metadata: { firebaseStorageDownloadTokens: TOKEN },
  })))
})

test('enforces authoritative Starter, Growth, Pro and fallback gallery limits', async () => {
  const starterFour = [0, 1, 2, 3].map(PHOTO)
  const starter = dbWith({ galleryStoragePaths: starterFour })
  await assert.rejects(
    () => manageBusinessMedia(args({ db: starter, storagePath: PHOTO(4) })),
    (error) => code(error) === 'resource-exhausted',
  )

  for (const planId of ['growth', 'pro']) {
    const db = dbWith({
      galleryStoragePaths: [0, 1, 2, 3, 4, 5, 6].map(PHOTO),
      subscription: {
        schemaVersion: 1, planId, planRevision: 1,
        accessStatus: 'active', assignmentSource: 'system',
      },
    })
    await manageBusinessMedia(args({ db, storagePath: PHOTO(7) }))
    assert.equal(db.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths.length, 8)
  }

  const fallback = dbWith({ subscription: null, galleryStoragePaths: [0, 1, 2, 3, 4, 5, 6].map(PHOTO) })
  await manageBusinessMedia(args({ db: fallback, storagePath: PHOTO(7) }))
  assert.equal(fallback.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths.length, 8)

  const privateStarter = dbWith({
    galleryStoragePaths: starterFour,
    subscription: {
      schemaVersion: 1, planId: 'pro', planRevision: 1,
      accessStatus: 'active', assignmentSource: 'system',
    },
  })
  privateStarter.store.set(`businessSubscriptions/${BUSINESS_ID}`, {
    schemaVersion: 1, planId: 'starter', planRevision: 1,
    accessStatus: 'active', assignmentSource: 'admin',
  })
  await assert.rejects(
    () => manageBusinessMedia(args({ db: privateStarter, storagePath: PHOTO(4) })),
    (error) => code(error) === 'resource-exhausted',
  )
})

test('counts strictly validated legacy and canonical gallery references together', async () => {
  const db = dbWith({
    galleryStoragePaths: [PHOTO(0), PHOTO(1)],
    galleryImages: [
      { downloadUrl: legacyUrl(`businesses/${BUSINESS_ID}/photos/legacy-a.jpg`) },
      { downloadUrl: legacyUrl(`businesses/${BUSINESS_ID}/photos/legacy-b.jpg`) },
      { downloadUrl: 'https://evil.example/not-counted.jpg' },
    ],
    galleryImageURLs: [legacyUrl(`businesses/${BUSINESS_ID}/photos/legacy-a.jpg`)],
  })
  await assert.rejects(
    () => manageBusinessMedia(args({ db, storagePath: PHOTO(2) })),
    (error) => code(error) === 'resource-exhausted',
  )

  const downgraded = dbWith({
    galleryStoragePaths: [PHOTO(0), PHOTO(1), PHOTO(2), PHOTO(3), PHOTO(4)],
  })
  await assert.rejects(
    () => manageBusinessMedia(args({ db: downgraded, storagePath: PHOTO(5) })),
    (error) => code(error) === 'resource-exhausted',
  )
  assert.equal(downgraded.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths.length, 5)
})

test('duplicate finalization is idempotent and concurrent different-slot additions preserve order', async () => {
  const duplicateDb = dbWith({ galleryStoragePaths: [PHOTO(0)] })
  const duplicate = await manageBusinessMedia(args({ db: duplicateDb }))
  assert.equal(duplicate.idempotent, true)
  assert.deepEqual(duplicateDb.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths, [PHOTO(0)])

  const concurrentDb = dbWith({
    subscription: {
      schemaVersion: 1, planId: 'growth', planRevision: 1,
      accessStatus: 'active', assignmentSource: 'system',
    },
  })
  await Promise.all([
    manageBusinessMedia(args({ db: concurrentDb, storagePath: PHOTO(2) })),
    manageBusinessMedia(args({ db: concurrentDb, storagePath: PHOTO(5) })),
  ])
  assert.deepEqual(concurrentDb.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths, [PHOTO(2), PHOTO(5)])
  assert.deepEqual(concurrentDb.data(`businesses/${BUSINESS_ID}`).untouched, { private: true })
})

test('logo finalization writes only the exact canonical manifest field and retries idempotently', async () => {
  const db = dbWith()
  const before = structuredClone(db.data(`businesses/${BUSINESS_ID}`))
  const first = await manageBusinessMedia(args({
    action: BUSINESS_MEDIA_ACTIONS.SET_LOGO, storagePath: LOGO, db,
  }))
  const stored = db.data(`businesses/${BUSINESS_ID}`)
  assert.equal(first.idempotent, false)
  assert.equal(stored.logoStoragePath, LOGO)
  assert.deepEqual({ ...stored, logoStoragePath: null }, before)
  const retry = await manageBusinessMedia(args({
    action: BUSINESS_MEDIA_ACTIONS.SET_LOGO, storagePath: LOGO, db,
  }))
  assert.equal(retry.idempotent, true)
})

test('logo and gallery removals depublish first and report origin deletion without token-revocation claims', async () => {
  const db = dbWith({ logoStoragePath: LOGO, galleryStoragePaths: [PHOTO(0), PHOTO(1)] })
  const failed = await manageBusinessMedia(args({
    action: BUSINESS_MEDIA_ACTIONS.REMOVE_GALLERY,
    storagePath: PHOTO(0),
    db,
    deleteObject: async () => { throw new Error('simulated origin deletion failure') },
  }))
  assert.deepEqual(db.data(`businesses/${BUSINESS_ID}`).galleryStoragePaths, [PHOTO(1)])
  assert.equal(failed.objectDeletion, 'failed')
  assert.equal(Object.hasOwn(failed, 'tokenRevoked'), false)

  const cleared = await manageBusinessMedia(args({
    action: BUSINESS_MEDIA_ACTIONS.CLEAR_LOGO, storagePath: LOGO, db,
  }))
  assert.equal(db.data(`businesses/${BUSINESS_ID}`).logoStoragePath, null)
  assert.equal(cleared.objectDeletion, 'deleted')

  const repeated = await manageBusinessMedia(args({
    action: BUSINESS_MEDIA_ACTIONS.REMOVE_GALLERY, storagePath: PHOTO(0), db,
    deleteObject: async () => 'not-found',
  }))
  assert.equal(repeated.idempotent, true)
  assert.equal(repeated.objectDeletion, 'not-found')
})

test('safe projection accepts canonical and valid legacy media but omits arbitrary or cross-business URLs', () => {
  const validLogo = legacyUrl(`businesses/${BUSINESS_ID}/logos/logo-old.jpg`)
  const validGallery = legacyUrl(`businesses/${BUSINESS_ID}/photos/photo-old.jpg`)
  const projected = projectSafeBusinessMedia(BUSINESS_ID, {
    logoStoragePath: LOGO,
    galleryStoragePaths: [PHOTO(1), PHOTO(1), 'businesses/other/photos/0'],
    profilePhoto: { downloadUrl: validLogo, originalName: 'private.jpg' },
    galleryImages: [
      { downloadUrl: validGallery, originalName: 'private-gallery.jpg' },
      { downloadUrl: legacyUrl('businesses/other/photos/wrong.jpg') },
      { downloadUrl: 'https://evil.example/image.jpg' },
    ],
  })
  assert.deepEqual(projected, {
    logoStoragePath: LOGO,
    galleryStoragePaths: [PHOTO(1)],
    logoUrl: validLogo,
    galleryUrls: [validGallery],
  })
  assert.equal(JSON.stringify(projected).includes('originalName'), false)
})
