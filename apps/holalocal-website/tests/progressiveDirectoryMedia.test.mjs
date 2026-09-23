import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadPublicBusinessDirectory } from '../src/services/publicBusinessDirectoryLoader.js'
import { prepareBusinessMediaPresentation, resolveBusinessMediaPresentation } from '../src/services/businessMediaPresentation.js'

const row = (id) => ({ businessId: id, name: id, logoStoragePath: `businesses/${id}/logos/logo/a`, galleryStoragePaths: [] })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const prepare = business => prepareBusinessMediaPresentation(business.businessId, business)

test('directory publishes filtered ordered rows with safe placeholders without resolving images', async () => {
  const response = deferred()
  const pending = loadPublicBusinessDirectory({ callPublicBusinesses: () => response.promise, maxResults: 60,
    presentBusiness: prepare, fallbackBusiness: prepare })
  response.resolve({ data: { businesses: [row('first'), { name: 'invalid' }, row('second')] } })
  const rows = await pending
  assert.deepEqual(rows.map(x => x.name), ['first', 'second'])
  assert.equal(rows[0].logoStoragePath, 'businesses/first/logos/logo/a')
  assert.equal(rows[0].logoUrl, null)
  assert.deepEqual(rows[1].galleryUrls, [])
})

test('directory endpoint failure remains an error, not empty successful data', async () => {
  const error = new Error('directory unavailable')
  await assert.rejects(loadPublicBusinessDirectory({ callPublicBusinesses: async () => { throw error },
    maxResults: 60, presentBusiness: prepare, fallbackBusiness: prepare }), error)
})

test('mixed list text and healthy media are independent of one delayed/failed business', async () => {
  const slow = deferred(), controller = new AbortController(), revoked = []
  const rows = [row('slow'), row('healthy'), { businessId: 'none', name: 'No media' }].map(prepare)
  const options = { signal: controller.signal, resolveCanonicalUrl: path => path.includes('/slow/')
    ? slow.promise : Promise.resolve({ url: 'blob:healthy', revoke: () => revoked.push('healthy') }) }
  const pending = resolveBusinessMediaPresentation('slow', rows[0], options)
  const healthy = await resolveBusinessMediaPresentation('healthy', rows[1], options)
  assert.equal(healthy.logoUrl, 'blob:healthy')
  assert.equal(rows[0].name, 'slow')
  assert.equal(rows[2].logoUrl, null)
  slow.resolve(Promise.reject(new Error('missing media')))
  assert.equal((await pending).logoUrl, null)
  assert.deepEqual(revoked, [])
  controller.abort()
  assert.deepEqual(revoked, ['healthy'])
})

test('late stale directory URLs are revoked without revoking the current list URL', async () => {
  const old = new AbortController(), current = new AbortController(), late = deferred(), revoked = []
  const pending = resolveBusinessMediaPresentation('same', row('same'), { signal: old.signal,
    resolveCanonicalUrl: () => late.promise })
  await new Promise(resolve => setImmediate(resolve))
  old.abort()
  const newer = await resolveBusinessMediaPresentation('same', { ...row('same'), name: 'New authoritative text' }, {
    signal: current.signal, resolveCanonicalUrl: async () => ({ url: 'blob:new', revoke: () => revoked.push('new') }) })
  late.resolve({ url: 'blob:old', revoke: () => revoked.push('old') })
  await pending
  assert.deepEqual(revoked, ['old'])
  assert.equal(newer.name, 'New authoritative text')
  assert.equal(newer.logoUrl, 'blob:new')
  current.abort()
  assert.deepEqual(revoked, ['old', 'new'])
})
