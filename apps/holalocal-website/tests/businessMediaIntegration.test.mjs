import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

test('logo upload prepares a bounded slot, captures generation, and finalizes trusted promotion', async () => {
  const calls = []
  const result = await runBusinessLogoUpload(businessId, { type: 'image/webp' }, {
    getBusiness: async () => ({ businessId }),
    prepare: async (...args) => {
      calls.push(['prepare', ...args])
      return { requestId: 'request-1', stagingPath: `businesses/${businessId}/staging/logos/logo` }
    },
    upload: async (path) => { calls.push(['upload', path]); return { generation: '42' } },
    finalize: async (...args) => calls.push(['finalize', ...args]),
    remove: async (path) => calls.push(['remove', path]),
  })
  assert.deepEqual(calls, [
    ['prepare', 'prepare-logo', businessId, `businesses/${businessId}/logos/logo`],
    ['upload', `businesses/${businessId}/staging/logos/logo`],
    ['finalize', 'finalize-logo', businessId, `businesses/${businessId}/logos/logo`, {
      requestId: 'request-1', stagingGeneration: '42',
    }],
  ])
  assert.equal(result.businessId, businessId)
  assert.equal('downloadUrl' in result, false)
})

test('failed gallery finalization never performs client cleanup against canonical media', async () => {
  const failure = new Error('finalizer-failed')
  const removed = []
  await assert.rejects(runBusinessGalleryUploads(businessId, [{}], {
    getBusiness: async () => ({ businessId, galleryStoragePaths: [] }),
    prepare: async () => ({ requestId: 'request-2', stagingPath: `businesses/${businessId}/staging/photos/0` }),
    upload: async () => ({ generation: '43' }),
    finalize: async () => { throw failure },
    remove: async (path) => { removed.push(path); throw new Error('cleanup-failed') },
  }), (error) => error === failure)
  assert.deepEqual(removed, [])
})

test('local concurrent gallery additions reserve different canonical slots', async () => {
  const uploaded = []
  let releaseFirst
  const firstUpload = new Promise((resolve) => { releaseFirst = resolve })
  const dependencies = {
    getBusiness: async () => ({ businessId, galleryStoragePaths: [] }),
    prepare: async (_action, _businessId, canonicalPath) => ({
      requestId: canonicalPath, stagingPath: canonicalPath.replace('/photos/', '/staging/photos/'),
    }),
    upload: async (path) => { uploaded.push(path); if (uploaded.length === 1) await firstUpload; return { generation: String(uploaded.length) } },
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
    `businesses/${businessId}/staging/photos/0`, `businesses/${businessId}/staging/photos/1`,
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
  }, { resolveCanonicalUrl: async (path) => ({ url: `blob:presentation/${path}`, revoke() {} }) })

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

test('route replacement and application unmount revoke cached canonical business object URLs', async () => {
  const routes = await readFile(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8')
  assert.match(routes, /useEffect\(\(\) => \(\) => clearBusinessMediaPresentationCache\(\), \[pathname\]\)/)
})
