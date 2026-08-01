import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  classifyFrontendError,
  createApplicationError,
} from '../src/utils/frontendErrors.js'
import { authenticatedTranslations } from '../src/i18n/locales/authenticatedTranslations.js'

const storageUrl = new URL('../src/firebase/storageClient.js', import.meta.url)
const profileUrl = new URL('../src/pages/customer/ProfilePage.jsx', import.meta.url)
const businessEditorUrl = new URL('../src/pages/business/EditBusinessPage.jsx', import.meta.url)
const businessServiceUrl = new URL('../src/services/businessService.js', import.meta.url)
const userServiceUrl = new URL('../src/services/userService.js', import.meta.url)

test('media classifier maps validation, Firebase, and unknown failures safely', () => {
  const fixtures = [
    [createApplicationError('media-invalid-type'), 'MEDIA_INVALID_TYPE'],
    [createApplicationError('media-too-large'), 'MEDIA_TOO_LARGE'],
    [{ code: 'storage/unauthenticated', message: 'Firebase Storage users/example-user' }, 'MEDIA_UNAUTHENTICATED'],
    [{ code: 'storage/unauthorized', message: 'gs://bucket/path' }, 'MEDIA_PERMISSION_DENIED'],
    [{ code: 'firestore/permission-denied', message: 'businesses/example-business' }, 'MEDIA_PERMISSION_DENIED'],
    [{ code: 'storage/retry-limit-exceeded', message: 'storage.googleapis.com/private' }, 'MEDIA_NETWORK_UNAVAILABLE'],
    [{ code: 'storage/object-not-found', message: 'users/example-user/photo.jpg' }, 'MEDIA_OBJECT_NOT_FOUND'],
    [createApplicationError('media-save-failed'), 'MEDIA_SAVE_FAILED'],
    [{ code: 'storage/unknown', message: 'Firebase Storage gs://bucket/path' }, 'MEDIA_UPLOAD_FAILED'],
  ]

  for (const [error, expectedType] of fixtures) {
    const result = classifyFrontendError(error, {
      domain: 'media',
      fallbackType: 'MEDIA_UPLOAD_FAILED',
    })
    assert.equal(result.type, expectedType)
    assert.deepEqual(Object.keys(result).sort(), ['recovery', 'translationKey', 'type'])
    assert.doesNotMatch(
      JSON.stringify(result),
      /gs:\/\/|users\/example-user|businesses\/example-business|storage\.googleapis\.com|Firebase Storage|permission-denied|media-/,
    )
  }

  const deleteFallback = classifyFrontendError(
    { code: 'storage/unknown', message: 'gs://bucket/path' },
    { domain: 'media', fallbackType: 'MEDIA_DELETE_FAILED' },
  )
  assert.equal(deleteFallback.type, 'MEDIA_DELETE_FAILED')
})

test('image validation retains formats and five-megabyte limit using stable reasons', async () => {
  const source = await readFile(storageUrl, 'utf8')

  assert.match(source, /new Set\(\['image\/jpeg', 'image\/png', 'image\/webp'\]\)/)
  assert.match(source, /maxSizeBytes = 5 \* 1024 \* 1024/)
  assert.match(source, /createApplicationError\('media-invalid-type'\)/)
  assert.match(source, /createApplicationError\('media-too-large'\)/)
  assert.doesNotMatch(source, /throw new Error\(['"`]Choose a JPG/)
  assert.doesNotMatch(source, /Image must be smaller/)
})

test('profile-photo integration preserves the existing image and suppresses raw failures', async () => {
  const [page, service] = await Promise.all([
    readFile(profileUrl, 'utf8'),
    readFile(userServiceUrl, 'utf8'),
  ])

  assert.match(page, /profilePhotoUrl = userProfile\?\.profilePhoto\?\.downloadUrl \|\| userProfile\?\.photoURL \|\| user\?\.photoURL/)
  assert.match(page, /classifyFrontendError\(uploadError, \{\s*domain: 'media',\s*fallbackType: 'MEDIA_UPLOAD_FAILED'/s)
  assert.match(page, /await uploadUserProfilePhoto\(user\.uid, file\)/)
  assert.match(page, /setSuccess\(t\('profile\.imageUpdated'\)\)/)
  assert.doesNotMatch(page, /uploadError\.message/)
  assert.doesNotMatch(page, /setPhotoError\([^)]*\.message/)
  assert.match(service, /uploadImageFile\(`users\/\$\{uid\}\/profile`, file\)/)
  assert.match(service, /photoURL: uploadedPhoto\.downloadUrl/)
  assert.match(service, /deleteImageFile\(uploadedPhoto\.storagePath\)\.catch\(\(\) => undefined\)/)
  assert.match(service, /throw createApplicationError\('media-save-failed'\)/)
})

test('business media integration preserves paths, payloads, ordering, and failure state', async () => {
  const [page, service] = await Promise.all([
    readFile(businessEditorUrl, 'utf8'),
    readFile(businessServiceUrl, 'utf8'),
  ])

  assert.match(service, /uploadImageFile\(`businesses\/\$\{businessId\}\/logos`, file\)/)
  assert.match(service, /uploadImageFile\(`businesses\/\$\{businessId\}\/photos`, file\)/)
  assert.match(service, /profilePhoto: \{ \.\.\.uploadedLogo, updatedAt:/)
  assert.match(service, /galleryImageURLs: galleryImages\.map\(\(\{ downloadUrl \}\) => downloadUrl\)/)
  assert.match(service, /for \(const file of files\)/)
  assert.match(service, /uploadedImages\.push/)
  assert.match(service, /slice\(0, 8\)/)
  assert.match(service, /throw createApplicationError\('media-save-failed'\)/)

  const deleteStart = service.indexOf('export async function deleteBusinessGalleryImage')
  const deleteSection = service.slice(deleteStart, service.indexOf('export async function ensureBusinessProfile'))
  assert.ok(deleteSection.indexOf('updateBusinessProfile') < deleteSection.indexOf('deleteImageFile'))
  assert.match(deleteSection, /deleteImageFile\(image\.storagePath\)\.catch\(\(\) => undefined\)/)

  assert.ok((page.match(/classifyFrontendError\(/g) ?? []).length >= 3)
  assert.doesNotMatch(page, /(?:uploadError|deleteError)\.message/)
  assert.match(page, /setBusinessProfile\(await uploadBusinessLogo/)
  assert.match(page, /setBusinessProfile\(\s*await uploadBusinessGalleryImages/s)
  assert.match(page, /setBusinessProfile\(await deleteBusinessGalleryImage/)
  assert.match(page, /remainingSlots = Math\.max\(8 - galleryImages\.length, 0\)/)

  for (const catchName of ['uploadError', 'deleteError']) {
    const catchIndex = page.indexOf(`catch (${catchName})`)
    const finallyIndex = page.indexOf('} finally {', catchIndex)
    assert.doesNotMatch(page.slice(catchIndex, finallyIndex), /setBusinessProfile/)
  }
})

test('media error translations resolve for all seventeen locales', async () => {
  const keys = [
    'invalidType',
    'tooLarge',
    'sessionExpired',
    'permissionDenied',
    'networkUnavailable',
    'objectNotFound',
    'uploadFailed',
    'deleteFailed',
    'saveFailed',
  ]
  const nonEnglish = ['es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it', 'sv', 'da', 'fi', 'no']

  for (const locale of nonEnglish) {
    for (const key of keys) {
      assert.ok(authenticatedTranslations[locale]?.media?.errors?.[key]?.trim(), `${locale}: media.errors.${key}`)
    }
  }

  const english = JSON.parse(await readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'))
  for (const key of keys) {
    assert.ok(english.media?.errors?.[key]?.trim(), `en: media.errors.${key}`)
  }
})
