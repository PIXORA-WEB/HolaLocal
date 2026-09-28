import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepareBusinessMediaPresentation, resolveBusinessMediaPresentation, clearBusinessMediaPresentationCache } from '../src/services/businessMediaPresentation.js'
import { getBusinessProfileCompletion } from '../src/utils/businessCompletion.js'

const id = 'business-1'
const row = {
  businessId: id, ownerId: 'owner', managerIds: ['owner'], categoryIds: ['home-maintenance'], primaryLanguage: 'en', name: 'Workshop', description: 'Repair workshop', primaryCategoryId: 'home-maintenance',
  location: { locality: 'Málaga', region: 'malaga', countryCode: 'ES' }, serviceAreas: ['Málaga'],
  languages: ['en'], contact: { preferredContactMethod: 'holalocal' },
  logoStoragePath: `businesses/${id}/logos/logo/a`, galleryStoragePaths: [`businesses/${id}/photos/0/a`],
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const legacy = kind => `https://firebasestorage.googleapis.com/v0/b/holalocal-491c9.firebasestorage.app/o/${encodeURIComponent(`businesses/${id}/${kind}/old.jpg`)}?alt=media&token=123e4567-e89b-12d3-a456-426614174000`

test('prepared canonical metadata preserves real completion while presentation is pending', async () => {
  const prepared = prepareBusinessMediaPresentation(id, row)
  assert.equal(prepared.logoUrl, null)
  assert.equal(getBusinessProfileCompletion(prepared).ready, true)
  const before = getBusinessProfileCompletion(prepared)
  const gate = deferred(), controller = new AbortController(), calls = []
  const pending = resolveBusinessMediaPresentation(id, prepared, { includeGallery: false, signal: controller.signal,
    resolveCanonicalUrl: path => { calls.push(path); return gate.promise } })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls, [row.logoStoragePath])
  gate.resolve({ url: 'blob:logo', revoke() {} })
  const presentation = await pending
  // The dashboard displays this URL separately, never replacing gallery metadata.
  assert.equal(presentation.logoUrl, 'blob:logo')
  assert.deepEqual(getBusinessProfileCompletion(prepared), before)
  assert.deepEqual(prepared.galleryStoragePaths, row.galleryStoragePaths)
  controller.abort()
})

test('missing and invalid media cannot become complete through preparation', () => {
  for (const input of [{ ...row, logoStoragePath: null, galleryStoragePaths: [] },
    { ...row, logoStoragePath: 'businesses/other/logos/logo/a', galleryStoragePaths: ['businesses/other/photos/0/a'], logoUrl: 'https://unsafe.invalid/a' }]) {
    const completion = getBusinessProfileCompletion(prepareBusinessMediaPresentation(id, input))
    assert.deepEqual(completion.items.filter(x => ['logo', 'images'].includes(x.key)).map(x => x.complete), [false, false])
  }
})

test('legacy-only and mixed validated metadata retains completion with failed canonical resolution', async () => {
  for (const canonical of [false, true]) {
    const prepared = prepareBusinessMediaPresentation(id, { ...row,
      logoStoragePath: canonical ? row.logoStoragePath : null, galleryStoragePaths: canonical ? row.galleryStoragePaths : [],
      profilePhoto: { downloadUrl: legacy('logos') }, galleryImageURLs: [legacy('photos'), 'https://unsafe.invalid/a'],
    })
    const before = getBusinessProfileCompletion(prepared)
    assert.equal(before.ready, true)
    const controller = new AbortController()
    const result = await resolveBusinessMediaPresentation(id, prepared, { includeGallery: false, signal: controller.signal,
      resolveCanonicalUrl: async () => { throw Error('synthetic transport error') } })
    assert.equal(result.logoUrl, legacy('logos'))
    assert.equal(prepared.galleryEntries.length, 1)
    assert.deepEqual(getBusinessProfileCompletion(prepared), before)
    controller.abort()
  }
})

test('page-owned request releases a late result without revoking shared or newer consumers', async () => {
  clearBusinessMediaPresentationCache()
  const revoked = []
  const shared = await resolveBusinessMediaPresentation(id, row, { includeGallery: false,
    resolveCanonicalUrl: async () => ({ url: 'blob:shared', revoke: () => revoked.push('shared') }) })
  const gate = deferred(), old = new AbortController(), current = new AbortController()
  const pending = resolveBusinessMediaPresentation(id, row, { includeGallery: false, signal: old.signal, resolveCanonicalUrl: () => gate.promise })
  await new Promise(resolve => setImmediate(resolve))
  old.abort()
  const newer = await resolveBusinessMediaPresentation(id, row, { includeGallery: false, signal: current.signal,
    resolveCanonicalUrl: async () => ({ url: 'blob:new', revoke: () => revoked.push('new') }) })
  gate.resolve({ url: 'blob:old', revoke: () => revoked.push('old') })
  await pending
  assert.deepEqual(revoked, ['old'])
  assert.equal(shared.logoUrl, 'blob:shared')
  assert.equal(newer.logoUrl, 'blob:new')
  current.abort()
  assert.deepEqual(revoked, ['old', 'new'])
  clearBusinessMediaPresentationCache()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(revoked, ['old', 'new', 'shared'])
})
