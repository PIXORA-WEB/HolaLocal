import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  loadProfileMediaPresentation,
  PRIVATE_PROFILE_MEDIA_MAX_BYTES,
  resolveProfileMediaReference,
} from '../src/services/profileMediaPresentation.js'
import { HOLALOCAL_FIREBASE_STORAGE_BUCKET } from '@holalocal/firebase-contract'

const uid = 'profile_user'
const canonicalPath = `users/${uid}/profile/avatar`
const token = '123e4567-e89b-42d3-a456-426614174000'
const legacyUrl = (path, bucket = HOLALOCAL_FIREBASE_STORAGE_BUCKET) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`

test('canonical profile presentation loads a bounded private blob and owns object URL cleanup', async () => {
  const calls = []
  const presentation = await loadProfileMediaPresentation(uid, {
    profilePhoto: { storagePath: canonicalPath },
    photoURL: legacyUrl(`users/${uid}/profile/old.png`),
  }, {
    getBlob: async (...args) => { calls.push(['blob', ...args]); return { type: 'image/png' } },
    createObjectURL: (blob) => { calls.push(['create', blob]); return 'blob:private-avatar' },
    revokeObjectURL: (url) => calls.push(['revoke', url]),
  })

  assert.equal(presentation.kind, 'canonical')
  assert.equal(presentation.url, 'blob:private-avatar')
  assert.deepEqual(calls[0], ['blob', canonicalPath, PRIVATE_PROFILE_MEDIA_MAX_BYTES])
  assert.deepEqual(calls[1], ['create', { type: 'image/png' }])
  presentation.revoke()
  assert.deepEqual(calls[2], ['revoke', 'blob:private-avatar'])
})

test('canonical state is authoritative and invalid canonical paths fail closed', async () => {
  const legacy = legacyUrl(`users/${uid}/profile/old.png`)
  assert.deepEqual(resolveProfileMediaReference(uid, {
    profilePhoto: { storagePath: canonicalPath, downloadUrl: legacy }, photoURL: legacy,
  }), { kind: 'canonical', storagePath: canonicalPath })
  for (const storagePath of [
    'users/other/profile/avatar',
    `users/${uid}/profile/arbitrary.png`,
    `businesses/${uid}/logos/logo`,
  ]) {
    assert.equal(resolveProfileMediaReference(uid, {
      profilePhoto: { storagePath, downloadUrl: legacy }, photoURL: legacy,
    }), null)
  }
})

test('only validated owner legacy media is used when canonical state is absent', async () => {
  const valid = legacyUrl(`users/${uid}/profile/old.png`)
  assert.deepEqual(resolveProfileMediaReference(uid, {
    profilePhoto: { downloadUrl: valid, storagePath: `users/${uid}/profile/old.png` },
    photoURL: 'https://example.invalid/avatar.png',
  }), { kind: 'legacy', storagePath: `users/${uid}/profile/old.png`, url: valid })
  for (const url of [
    legacyUrl('users/other/profile/old.png'),
    legacyUrl(`businesses/${uid}/photos/old.png`),
    legacyUrl(`users/${uid}/profile/old.png`, 'wrong.firebasestorage.app'),
    'https://example.invalid/avatar.png',
    'not a url',
  ]) assert.equal(resolveProfileMediaReference(uid, { photoURL: url }), null)
})

test('private blob failures propagate without producing a presentation URL', async () => {
  await assert.rejects(loadProfileMediaPresentation(uid, {
    profilePhoto: { storagePath: canonicalPath },
  }, {
    getBlob: async () => { throw Object.assign(new Error('blocked'), { code: 'storage/unauthorized' }) },
    createObjectURL: () => assert.fail('must not create an object URL'),
  }), /blocked/)
})

test('profile upload uses bounded staging generation and delegates descriptor authority to trusted finalization', async () => {
  const source = await readFile(new URL('../src/services/userService.js', import.meta.url), 'utf8')
  const upload = source.slice(source.indexOf('export async function uploadUserProfilePhoto'), source.indexOf('export async function ensureUserProfile'))
  assert.match(upload, /prepareProfileMediaUploadCallable\(\{\}\)/)
  assert.match(upload, /uploadCanonicalImageFile\(stagingPath, file, requestId\)/)
  assert.match(upload, /stagingGeneration: uploaded\.generation/)
  assert.match(upload, /finalizeProfileMediaCallable/)
  assert.match(upload, /await onCommitted\?\.\(file\)/)
  assert.match(upload, /getUserProfile\(uid\)\.catch\(\(\) => null\)/)
  assert.doesNotMatch(upload, /photoURL: null/)
  assert.doesNotMatch(upload, /profilePhoto: \{ storagePath \}/)
  assert.doesNotMatch(upload, /randomUUID|originalName|getDownloadURL|uploadedAt/)
  assert.doesNotMatch(upload, /updateDoc|deleteImageFile|getDownloadURL/)

  const editable = source.match(/const editableProfileFields = new Set\(\[([\s\S]*?)\]\)/)?.[1]
  assert.ok(editable)
  assert.doesNotMatch(editable, /photoURL|profilePhoto/)
})

test('profile page never falls back to Firebase Auth token URLs and revokes presentations', async () => {
  const source = await readFile(new URL('../src/pages/customer/ProfilePage.jsx', import.meta.url), 'utf8')
  assert.match(source, /loadProfileMediaPresentation\(user\?\.uid, userProfile\)/)
  assert.match(source, /presentation\?\.revoke\?\.\(\)/)
  assert.match(source, /revoke\?\.\(\)/)
  assert.doesNotMatch(source, /user\?\.photoURL/)
  assert.doesNotMatch(source, /profilePhoto\?\.downloadUrl \|\|/)
})

test('profile page synchronously guards submissions, suppresses committed files, and disables Retry', async () => {
  const source = await readFile(new URL('../src/pages/customer/ProfilePage.jsx', import.meta.url), 'utf8')
  const upload = source.slice(source.indexOf('async function uploadProfilePhoto'), source.indexOf('function handleProfilePhotoChange'))
  assert.match(upload, /if \(!submission\.tryAcquire\(\)\) return/)
  assert.ok(upload.indexOf('tryAcquire()') < upload.indexOf('setPhotoUploading(true)'))
  assert.match(upload, /photoRetryRef\.current = null/)
  assert.match(upload, /submission\.pendingFiles\(\[file\]\)/)
  assert.match(upload, /onCommitted: \(\) => submission\.markSuccessful\(pendingFile\)/)
  assert.match(upload, /finally \{\s*submission\.release\(\)/)
  assert.match(source, /actionPending=\{photoUploading\}/)
})
