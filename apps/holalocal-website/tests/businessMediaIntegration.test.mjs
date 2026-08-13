import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clearBusinessMediaPresentationCache,
  resolveBusinessMediaPresentation,
} from '../src/services/businessMediaPresentation.js'
import {
  selectAvailableCanonicalGallerySlot,
  runBusinessGalleryUploads,
  runBusinessLogoUpload,
} from '../src/services/businessMediaWorkflow.js'

const businessId = 'business-1'
const token = '123e4567-e89b-12d3-a456-426614174000'
const legacy = (folder, file = 'old.jpg', id = businessId, bucket = 'holalocal-491c9.firebasestorage.app') =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(`businesses/${id}/${folder}/${file}`)}?alt=media&token=${token}`

test('canonical slot selection skips occupied paths but ignores legacy image count', () => {
  assert.equal(selectAvailableCanonicalGallerySlot(businessId, [
    `businesses/${businessId}/photos/0`, `businesses/${businessId}/photos/2`,
  ]), 1)
  assert.equal(selectAvailableCanonicalGallerySlot(businessId, [], [0, 1]), 2)
  assert.equal(selectAvailableCanonicalGallerySlot(businessId,
    Array.from({ length: 8 }, (_, slot) => `businesses/${businessId}/photos/${slot}`)), null)
})

test('logo upload finalizes after upload, refreshes, and never client-writes a URL', async () => {
  const calls = []
  const result = await runBusinessLogoUpload(businessId, { type: 'image/webp' }, {
    getBusiness: async () => ({ businessId }),
    upload: async (path) => calls.push(['upload', path]),
    finalize: async (...args) => calls.push(['finalize', ...args]),
    remove: async (path) => calls.push(['remove', path]),
  })
  assert.deepEqual(calls, [
    ['upload', `businesses/${businessId}/logos/logo`],
    ['finalize', 'set-logo', businessId, `businesses/${businessId}/logos/logo`],
  ])
  assert.equal(result.businessId, businessId)
  assert.equal('downloadUrl' in result, false)
})

test('failed gallery finalization preserves the bounded slot and original error', async () => {
  const failure = new Error('finalizer-failed')
  const removed = []
  await assert.rejects(runBusinessGalleryUploads(businessId, [{}], {
    getBusiness: async () => ({ businessId, galleryStoragePaths: [] }),
    upload: async () => undefined,
    finalize: async () => { throw failure },
    remove: async (path) => { removed.push(path); throw new Error('cleanup-failed') },
  }), (error) => error === failure)
  assert.deepEqual(removed, [])
})

test('a failed independent session never deletes a slot another session finalized', async () => {
  const [{ runBusinessGalleryUploads: runSessionA }, { runBusinessGalleryUploads: runSessionB }] = await Promise.all([
    import('../src/services/businessMediaWorkflow.js?gallery-session=a'),
    import('../src/services/businessMediaWorkflow.js?gallery-session=b'),
  ])
  const storagePath = `businesses/${businessId}/photos/0`
  const manifest = []
  const liveObjects = new Set()
  const removals = []
  let bothUploaded
  let uploads = 0
  const uploadsReady = new Promise((resolve) => { bothUploaded = resolve })
  const upload = async (path) => {
    assert.equal(path, storagePath)
    liveObjects.add(path)
    uploads += 1
    if (uploads === 2) bothUploaded()
    await uploadsReady
  }
  const getBusiness = async () => ({ businessId, galleryStoragePaths: [...manifest] })
  const remove = async (path) => { removals.push(path); liveObjects.delete(path) }
  const failure = new Error('session-b-finalizer-failed')

  const sessionA = runSessionA(businessId, [{}], {
    getBusiness,
    upload,
    finalize: async (_action, _businessId, path) => { manifest.push(path) },
    remove,
  })
  const sessionB = runSessionB(businessId, [{}], {
    getBusiness,
    upload,
    finalize: async () => { throw failure },
    remove,
  })

  await sessionA
  await assert.rejects(sessionB, (error) => error === failure)
  assert.deepEqual(manifest, [storagePath])
  assert.equal(liveObjects.has(storagePath), true)
  assert.deepEqual(removals, [])
})

test('a failure before another session finalizes leaves the slot available to become authoritative', async () => {
  const [{ runBusinessGalleryUploads: runSessionA }, { runBusinessGalleryUploads: runSessionB }] = await Promise.all([
    import('../src/services/businessMediaWorkflow.js?gallery-session=c'),
    import('../src/services/businessMediaWorkflow.js?gallery-session=d'),
  ])
  const storagePath = `businesses/${businessId}/photos/0`
  const manifest = []
  const liveObjects = new Set()
  const removals = []
  let bothUploaded
  let uploads = 0
  const uploadsReady = new Promise((resolve) => { bothUploaded = resolve })
  let allowSuccessfulFinalize
  const successfulFinalizeReady = new Promise((resolve) => { allowSuccessfulFinalize = resolve })
  const dependencies = {
    getBusiness: async () => ({ businessId, galleryStoragePaths: [...manifest] }),
    upload: async (path) => {
      liveObjects.add(path)
      uploads += 1
      if (uploads === 2) bothUploaded()
      await uploadsReady
    },
    remove: async (path) => { removals.push(path); liveObjects.delete(path) },
  }
  const failure = new Error('failed-before-other-finalize')
  const sessionA = runSessionA(businessId, [{}], {
    ...dependencies,
    finalize: async (_action, _businessId, path) => {
      await successfulFinalizeReady
      manifest.push(path)
    },
  })
  const sessionB = runSessionB(businessId, [{}], {
    ...dependencies,
    finalize: async () => { throw failure },
  })

  await assert.rejects(sessionB, (error) => error === failure)
  assert.equal(liveObjects.has(storagePath), true)
  assert.deepEqual(removals, [])
  allowSuccessfulFinalize()
  await sessionA
  assert.deepEqual(manifest, [storagePath])
  assert.equal(liveObjects.has(storagePath), true)
})

test('failed cleanup cannot delete an existing referenced slot or unrelated media', async () => {
  const referencedPath = `businesses/${businessId}/photos/0`
  const failedPath = `businesses/${businessId}/photos/1`
  const removals = []
  const failure = new Error('finalizer-failed-after-reference')
  await assert.rejects(runBusinessGalleryUploads(businessId, [{}], {
    getBusiness: async () => ({ businessId, galleryStoragePaths: [referencedPath] }),
    upload: async (path) => assert.equal(path, failedPath),
    finalize: async () => { throw failure },
    remove: async (path) => removals.push(path),
  }), (error) => error === failure)
  assert.deepEqual(removals, [])
  assert.equal(referencedPath, `businesses/${businessId}/photos/0`)
})

test('local concurrent gallery additions reserve different canonical slots', async () => {
  const uploaded = []
  let releaseFirst
  const firstUpload = new Promise((resolve) => { releaseFirst = resolve })
  const dependencies = {
    getBusiness: async () => ({ businessId, galleryStoragePaths: [] }),
    upload: async (path) => { uploaded.push(path); if (uploaded.length === 1) await firstUpload },
    finalize: async () => undefined,
    remove: async () => undefined,
  }
  const first = runBusinessGalleryUploads(businessId, [{}], dependencies)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const second = runBusinessGalleryUploads(businessId, [{}], dependencies)
  await new Promise((resolve) => setTimeout(resolve, 0))
  releaseFirst()
  await Promise.all([first, second])
  assert.deepEqual(new Set(uploaded), new Set([
    `businesses/${businessId}/photos/0`, `businesses/${businessId}/photos/1`,
  ]))
})

test('presentation resolves canonical first, preserves order, and accepts only strict legacy media', async () => {
  clearBusinessMediaPresentationCache()
  const resolved = await resolveBusinessMediaPresentation(businessId, {
    businessId,
    logoStoragePath: `businesses/${businessId}/logos/logo`,
    galleryStoragePaths: [
      `businesses/${businessId}/photos/2`, `businesses/${businessId}/photos/0`,
    ],
    profilePhoto: { downloadUrl: legacy('logos') },
    galleryImageURLs: [
      legacy('photos', 'old.jpg'),
      'https://evil.example/image.jpg',
      legacy('photos', 'wrong.jpg', 'other-business'),
      legacy('photos', 'wrong-bucket.jpg', businessId, 'other.firebasestorage.app'),
    ],
  }, { resolveCanonicalUrl: async (path) => `blob:presentation/${path}` })

  assert.equal(resolved.logoUrl, `blob:presentation/businesses/${businessId}/logos/logo`)
  assert.deepEqual(resolved.galleryEntries.map(({ kind, storagePath }) => [kind, storagePath]), [
    ['canonical', `businesses/${businessId}/photos/2`],
    ['canonical', `businesses/${businessId}/photos/0`],
    ['legacy', `businesses/${businessId}/photos/old.jpg`],
  ])
  assert.equal(JSON.stringify(resolved).includes('originalName'), false)
  assert.equal(JSON.stringify(resolved).includes('evil.example'), false)
})

test('wrong-business canonical media and malformed legacy media never reach presentation URLs', async () => {
  clearBusinessMediaPresentationCache()
  const resolved = await resolveBusinessMediaPresentation(businessId, {
    logoStoragePath: 'businesses/other-business/logos/logo',
    galleryStoragePaths: ['businesses/other-business/photos/0', 'businesses/business-1/photos/8'],
    logoUrl: 'https://evil.example/logo.svg',
    galleryUrls: ['not a url'],
  }, { resolveCanonicalUrl: async () => { throw new Error('must not resolve') } })
  assert.equal(resolved.logoUrl, null)
  assert.deepEqual(resolved.galleryUrls, [])
})
