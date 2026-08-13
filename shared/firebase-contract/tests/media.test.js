import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCanonicalBusinessGalleryPath,
  buildCanonicalBusinessLogoPath,
  buildCanonicalProfileMediaPath,
  CANONICAL_BUSINESS_GALLERY_SLOTS,
  HOLALOCAL_FIREBASE_STORAGE_BUCKET,
  isCanonicalProfileMediaPath,
  isCanonicalBusinessGalleryPath,
  isCanonicalBusinessGallerySlot,
  isCanonicalBusinessLogoPath,
  isLegacyFirebaseBusinessMediaUrl,
  parseLegacyFirebaseProfileMediaUrl,
  MAX_CANONICAL_BUSINESS_GALLERY_SLOTS,
  parseCanonicalMediaPath,
  parseLegacyFirebaseBusinessMediaUrl,
  validateCanonicalBusinessMedia,
} from '../index.js'

const BUSINESS_ID = 'business_123'
const OTHER_BUSINESS_ID = 'business_456'
const TOKEN = '123e4567-e89b-42d3-a456-426614174000'

function legacyUrl(storagePath, {
  bucket = HOLALOCAL_FIREBASE_STORAGE_BUCKET,
  token = TOKEN,
} = {}) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`
}

test('canonical media builders produce deterministic bounded paths', () => {
  assert.equal(MAX_CANONICAL_BUSINESS_GALLERY_SLOTS, 8)
  assert.deepEqual(CANONICAL_BUSINESS_GALLERY_SLOTS, [0, 1, 2, 3, 4, 5, 6, 7])
  assert.equal(buildCanonicalProfileMediaPath('user_123'), 'users/user_123/profile/avatar')
  assert.equal(buildCanonicalBusinessLogoPath(BUSINESS_ID), `businesses/${BUSINESS_ID}/logos/logo`)
  assert.equal(buildCanonicalBusinessGalleryPath(BUSINESS_ID, 0), `businesses/${BUSINESS_ID}/photos/0`)
  assert.equal(buildCanonicalBusinessGalleryPath(BUSINESS_ID, 7), `businesses/${BUSINESS_ID}/photos/7`)
  assert.equal(isCanonicalBusinessGallerySlot(0), true)
  assert.equal(isCanonicalBusinessGallerySlot(7), true)
})

test('canonical builders reject invalid identifiers and gallery slots', () => {
  for (const slot of [8, -1, 1.5, '1', null, undefined, Number.NaN]) {
    assert.equal(isCanonicalBusinessGallerySlot(slot), false)
    assert.throws(() => buildCanonicalBusinessGalleryPath(BUSINESS_ID, slot))
  }
  for (const id of ['', ' ', '../business', 'business/other', 'business%2Fother', 'business\\other']) {
    assert.throws(() => buildCanonicalBusinessLogoPath(id))
  }
})

test('canonical parser accepts only exact fixed slots and filenames', () => {
  assert.deepEqual(parseCanonicalMediaPath('users/user_123/profile/avatar'), {
    kind: 'profile', uid: 'user_123', storagePath: 'users/user_123/profile/avatar',
  })
  assert.equal(isCanonicalProfileMediaPath('users/user_123/profile/avatar', 'user_123'), true)
  assert.equal(isCanonicalProfileMediaPath('users/other/profile/avatar', 'user_123'), false)
  assert.equal(isCanonicalProfileMediaPath('users/user_123/profile/custom.png', 'user_123'), false)
  assert.equal(isCanonicalBusinessLogoPath(`businesses/${BUSINESS_ID}/logos/logo`, BUSINESS_ID), true)
  assert.equal(isCanonicalBusinessGalleryPath(`businesses/${BUSINESS_ID}/photos/7`, BUSINESS_ID), true)

  assert.equal(isCanonicalBusinessLogoPath(
    `businesses/${OTHER_BUSINESS_ID}/logos/logo`,
    BUSINESS_ID,
  ), false)
  for (const path of [
    `businesses/${BUSINESS_ID}/logos/custom.png`,
    `businesses/${BUSINESS_ID}/photos/8`,
    `businesses/${BUSINESS_ID}/photos/-1`,
    `businesses/${BUSINESS_ID}/photos/01`,
    `businesses/${BUSINESS_ID}/covers/logo`,
    `businesses/${BUSINESS_ID}/photos/../logo`,
    `businesses/${BUSINESS_ID}/photos%2F0`,
    `businesses/${BUSINESS_ID}/photos/%30`,
    `businesses/${BUSINESS_ID}\\photos\\0`,
  ]) {
    assert.equal(parseCanonicalMediaPath(path), null)
  }
})

test('legacy profile media URLs are strictly owner and bucket bound', () => {
  const valid = legacyUrl('users/user_123/profile/legacy-avatar.png')
  assert.deepEqual(parseLegacyFirebaseProfileMediaUrl(valid, 'user_123'), {
    bucket: HOLALOCAL_FIREBASE_STORAGE_BUCKET,
    kind: 'profile',
    storagePath: 'users/user_123/profile/legacy-avatar.png',
    uid: 'user_123',
  })
  for (const rejected of [
    legacyUrl('users/other/profile/legacy-avatar.png'),
    legacyUrl('users/user_123/profile/avatar'),
    legacyUrl('businesses/user_123/logos/logo.png'),
    legacyUrl('users/user_123/documents/file.png'),
    legacyUrl('users/user_123/profile/legacy.png', { bucket: 'other.firebasestorage.app' }),
    'https://example.com/avatar.png',
    'not a URL',
    `https://firebasestorage.googleapis.com/v0/b/${HOLALOCAL_FIREBASE_STORAGE_BUCKET}/o/users%252Fuser_123%252Fprofile%252Favatar.png?alt=media&token=${TOKEN}`,
    `https://firebasestorage.googleapis.com/v0/b/${HOLALOCAL_FIREBASE_STORAGE_BUCKET}/o/users%2Fuser_123%2Fprofile%2F..%2Favatar.png?alt=media&token=${TOKEN}`,
  ]) assert.equal(parseLegacyFirebaseProfileMediaUrl(rejected, 'user_123'), null)
})

test('canonical business schema preserves ordered unique gallery paths', () => {
  const ordered = [
    buildCanonicalBusinessGalleryPath(BUSINESS_ID, 7),
    buildCanonicalBusinessGalleryPath(BUSINESS_ID, 0),
    buildCanonicalBusinessGalleryPath(BUSINESS_ID, 3),
  ]
  assert.equal(validateCanonicalBusinessMedia({
    businessId: BUSINESS_ID,
    logoStoragePath: buildCanonicalBusinessLogoPath(BUSINESS_ID),
    galleryStoragePaths: ordered,
  }), true)
  assert.deepEqual(ordered, [
    `businesses/${BUSINESS_ID}/photos/7`,
    `businesses/${BUSINESS_ID}/photos/0`,
    `businesses/${BUSINESS_ID}/photos/3`,
  ])
  assert.equal(validateCanonicalBusinessMedia({
    businessId: BUSINESS_ID,
    galleryStoragePaths: [ordered[0], ordered[0]],
  }), false)
  assert.equal(validateCanonicalBusinessMedia({
    businessId: BUSINESS_ID,
    galleryStoragePaths: [buildCanonicalBusinessGalleryPath(OTHER_BUSINESS_ID, 0)],
  }), false)
})

test('legacy Firebase business media URLs validate bucket, business, folder and kind', () => {
  const logo = legacyUrl(`businesses/${BUSINESS_ID}/logos/legacy-logo.png`)
  const photo = legacyUrl(`businesses/${BUSINESS_ID}/photos/legacy-photo.webp`)
  assert.deepEqual(parseLegacyFirebaseBusinessMediaUrl(logo, BUSINESS_ID), {
    bucket: HOLALOCAL_FIREBASE_STORAGE_BUCKET,
    businessId: BUSINESS_ID,
    kind: 'logo',
    storagePath: `businesses/${BUSINESS_ID}/logos/legacy-logo.png`,
  })
  assert.equal(isLegacyFirebaseBusinessMediaUrl(photo, BUSINESS_ID, 'gallery'), true)
  assert.equal(isLegacyFirebaseBusinessMediaUrl(photo, BUSINESS_ID, 'logo'), false)
})

test('legacy URL validation rejects external, wrong-bucket and cross-scope media', () => {
  const rejected = [
    'https://example.com/image.png',
    `http://127.0.0.1:9199/v0/b/${HOLALOCAL_FIREBASE_STORAGE_BUCKET}/o/businesses%2F${BUSINESS_ID}%2Flogos%2Flogo.png?alt=media&token=${TOKEN}`,
    legacyUrl(`businesses/${BUSINESS_ID}/logos/logo.png`, { bucket: 'other.firebasestorage.app' }),
    legacyUrl(`businesses/${OTHER_BUSINESS_ID}/logos/logo.png`),
    legacyUrl('users/user_123/profile/avatar.png'),
    legacyUrl(`businesses/${BUSINESS_ID}/documents/file.png`),
    legacyUrl(`unrelated/${BUSINESS_ID}/photos/file.png`),
    `https://storage.googleapis.com/${HOLALOCAL_FIREBASE_STORAGE_BUCKET}/businesses/${BUSINESS_ID}/photos/file.png`,
    `https://firebasestorage.googleapis.com.evil.example/v0/b/${HOLALOCAL_FIREBASE_STORAGE_BUCKET}/o/file?alt=media&token=${TOKEN}`,
  ]
  for (const url of rejected) assert.equal(parseLegacyFirebaseBusinessMediaUrl(url, BUSINESS_ID), null)
})

test('legacy URL validation fails closed on malformed and encoded path confusion', () => {
  const base = `https://firebasestorage.googleapis.com/v0/b/${HOLALOCAL_FIREBASE_STORAGE_BUCKET}/o/`
  const rejected = [
    'not a URL',
    `${base}%E0%A4%A?alt=media&token=${TOKEN}`,
    `${base}businesses%252F${BUSINESS_ID}%252Fphotos%252Ffile.png?alt=media&token=${TOKEN}`,
    `${base}businesses%2F${BUSINESS_ID}%2Fphotos%2F..%2Flogos%2Ffile.png?alt=media&token=${TOKEN}`,
    `${base}businesses%2F${BUSINESS_ID}%2Fphotos%2F%252e%252e?alt=media&token=${TOKEN}`,
    `${base}businesses%2F${BUSINESS_ID}%2Fphotos%2Ffile%2Fother.png?alt=media&token=${TOKEN}`,
    `${base}businesses%2F${BUSINESS_ID}%2Fphotos%2Ffile.png?alt=media`,
    `${base}businesses%2F${BUSINESS_ID}%2Fphotos%2Ffile.png?alt=media&token=not-a-token`,
    `${base}businesses%2F${BUSINESS_ID}%2Fphotos%2Ffile.png?alt=media&token=${TOKEN}&extra=1`,
    `${base}businesses%2F${BUSINESS_ID}%2Fphotos%2Ffile.png/?alt=media&token=${TOKEN}`,
  ]
  for (const url of rejected) assert.equal(parseLegacyFirebaseBusinessMediaUrl(url, BUSINESS_ID), null)
})
