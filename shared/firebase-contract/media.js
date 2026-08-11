export const HOLALOCAL_FIREBASE_STORAGE_BUCKET = 'holalocal-491c9.firebasestorage.app'
export const MAX_CANONICAL_BUSINESS_GALLERY_SLOTS = 8
export const CANONICAL_BUSINESS_GALLERY_SLOTS = Object.freeze(
  Array.from({ length: MAX_CANONICAL_BUSINESS_GALLERY_SLOTS }, (_, slot) => slot),
)

const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const LEGACY_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
const FIREBASE_DOWNLOAD_HOST = 'firebasestorage.googleapis.com'
const FIREBASE_DOWNLOAD_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireMediaId(value, label) {
  if (typeof value !== 'string' || !MEDIA_ID_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a valid Firebase identifier`)
  }
  return value
}

export function isCanonicalBusinessGallerySlot(slot) {
  return Number.isInteger(slot) && slot >= 0 && slot < MAX_CANONICAL_BUSINESS_GALLERY_SLOTS
}

export function buildCanonicalProfileMediaPath(uid) {
  return `users/${requireMediaId(uid, 'uid')}/profile/avatar`
}

export function isCanonicalProfileMediaPath(storagePath, expectedUid) {
  if (!MEDIA_ID_PATTERN.test(expectedUid ?? '')) return false
  const parsed = parseCanonicalMediaPath(storagePath)
  return parsed?.kind === 'profile' && parsed.uid === expectedUid
}

export function buildCanonicalBusinessLogoPath(businessId) {
  return `businesses/${requireMediaId(businessId, 'businessId')}/logos/logo`
}

export function buildCanonicalBusinessGalleryPath(businessId, slot) {
  requireMediaId(businessId, 'businessId')
  if (!isCanonicalBusinessGallerySlot(slot)) {
    throw new RangeError(`gallery slot must be an integer from 0 to ${MAX_CANONICAL_BUSINESS_GALLERY_SLOTS - 1}`)
  }
  return `businesses/${businessId}/photos/${slot}`
}

export function parseCanonicalMediaPath(storagePath) {
  if (typeof storagePath !== 'string' || storagePath.includes('%') || storagePath.includes('\\')) {
    return null
  }
  const segments = storagePath.split('/')
  if (segments.length !== 4 || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null
  }

  if (
    segments[0] === 'users'
    && MEDIA_ID_PATTERN.test(segments[1])
    && segments[2] === 'profile'
    && segments[3] === 'avatar'
  ) {
    return Object.freeze({ kind: 'profile', uid: segments[1], storagePath })
  }

  if (segments[0] !== 'businesses' || !MEDIA_ID_PATTERN.test(segments[1])) return null
  if (segments[2] === 'logos' && segments[3] === 'logo') {
    return Object.freeze({ businessId: segments[1], kind: 'logo', storagePath })
  }
  if (segments[2] === 'photos' && /^[0-7]$/.test(segments[3])) {
    return Object.freeze({
      businessId: segments[1],
      kind: 'gallery',
      slot: Number(segments[3]),
      storagePath,
    })
  }
  return null
}

export function isCanonicalBusinessLogoPath(storagePath, expectedBusinessId) {
  if (!MEDIA_ID_PATTERN.test(expectedBusinessId ?? '')) return false
  const parsed = parseCanonicalMediaPath(storagePath)
  return parsed?.kind === 'logo' && parsed.businessId === expectedBusinessId
}

export function isCanonicalBusinessGalleryPath(storagePath, expectedBusinessId) {
  if (!MEDIA_ID_PATTERN.test(expectedBusinessId ?? '')) return false
  const parsed = parseCanonicalMediaPath(storagePath)
  return parsed?.kind === 'gallery' && parsed.businessId === expectedBusinessId
}

export function validateCanonicalBusinessMedia({
  businessId,
  logoStoragePath = null,
  galleryStoragePaths = [],
} = {}) {
  if (!MEDIA_ID_PATTERN.test(businessId ?? '')) return false
  if (logoStoragePath !== null && !isCanonicalBusinessLogoPath(logoStoragePath, businessId)) return false
  if (!Array.isArray(galleryStoragePaths) || galleryStoragePaths.length > MAX_CANONICAL_BUSINESS_GALLERY_SLOTS) {
    return false
  }
  if (new Set(galleryStoragePaths).size !== galleryStoragePaths.length) return false
  return galleryStoragePaths.every((path) => isCanonicalBusinessGalleryPath(path, businessId))
}

function safelyDecodeFirebaseObjectPath(encodedPath) {
  try {
    const decoded = decodeURIComponent(encodedPath)
    if (
      !decoded
      || decoded.includes('%')
      || decoded.includes('\\')
      || /[\u0000-\u001f\u007f]/.test(decoded)
      || encodeURIComponent(decoded).toLowerCase() !== encodedPath.toLowerCase()
    ) return null
    const segments = decoded.split('/')
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null
    return { decoded, segments }
  } catch {
    return null
  }
}

export function parseLegacyFirebaseBusinessMediaUrl(url, expectedBusinessId) {
  if (
    typeof url !== 'string'
    || url !== url.trim()
    || url.length > 4096
    || url.includes('\\')
    || !MEDIA_ID_PATTERN.test(expectedBusinessId ?? '')
  ) return null

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }

  if (
    parsedUrl.protocol !== 'https:'
    || parsedUrl.hostname !== FIREBASE_DOWNLOAD_HOST
    || parsedUrl.port
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.hash
  ) return null

  const pathSegments = parsedUrl.pathname.split('/')
  if (
    pathSegments.length !== 6
    || pathSegments[0] !== ''
    || pathSegments[1] !== 'v0'
    || pathSegments[2] !== 'b'
    || pathSegments[3] !== HOLALOCAL_FIREBASE_STORAGE_BUCKET
    || pathSegments[4] !== 'o'
  ) return null

  const queryKeys = [...parsedUrl.searchParams.keys()]
  if (
    queryKeys.length !== 2
    || new Set(queryKeys).size !== 2
    || parsedUrl.searchParams.get('alt') !== 'media'
    || !FIREBASE_DOWNLOAD_TOKEN_PATTERN.test(parsedUrl.searchParams.get('token') ?? '')
  ) return null

  const objectPath = safelyDecodeFirebaseObjectPath(pathSegments[5])
  if (!objectPath || objectPath.segments.length !== 4) return null
  const [root, businessId, folder, filename] = objectPath.segments
  if (
    root !== 'businesses'
    || businessId !== expectedBusinessId
    || !['logos', 'photos'].includes(folder)
    || !LEGACY_FILENAME_PATTERN.test(filename)
    || filename === '.'
    || filename === '..'
  ) return null

  return Object.freeze({
    bucket: HOLALOCAL_FIREBASE_STORAGE_BUCKET,
    businessId,
    kind: folder === 'logos' ? 'logo' : 'gallery',
    storagePath: objectPath.decoded,
  })
}

export function isLegacyFirebaseBusinessMediaUrl(url, expectedBusinessId, expectedKind) {
  const parsed = parseLegacyFirebaseBusinessMediaUrl(url, expectedBusinessId)
  return Boolean(parsed && (expectedKind === undefined || parsed.kind === expectedKind))
}

export function parseLegacyFirebaseProfileMediaUrl(url, expectedUid) {
  if (
    typeof url !== 'string'
    || url !== url.trim()
    || url.length > 4096
    || url.includes('\\')
    || !MEDIA_ID_PATTERN.test(expectedUid ?? '')
  ) return null

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }

  if (
    parsedUrl.protocol !== 'https:'
    || parsedUrl.hostname !== FIREBASE_DOWNLOAD_HOST
    || parsedUrl.port
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.hash
  ) return null

  const pathSegments = parsedUrl.pathname.split('/')
  if (
    pathSegments.length !== 6
    || pathSegments[0] !== ''
    || pathSegments[1] !== 'v0'
    || pathSegments[2] !== 'b'
    || pathSegments[3] !== HOLALOCAL_FIREBASE_STORAGE_BUCKET
    || pathSegments[4] !== 'o'
  ) return null

  const queryKeys = [...parsedUrl.searchParams.keys()]
  if (
    queryKeys.length !== 2
    || new Set(queryKeys).size !== 2
    || parsedUrl.searchParams.get('alt') !== 'media'
    || !FIREBASE_DOWNLOAD_TOKEN_PATTERN.test(parsedUrl.searchParams.get('token') ?? '')
  ) return null

  const objectPath = safelyDecodeFirebaseObjectPath(pathSegments[5])
  if (!objectPath || objectPath.segments.length !== 4) return null
  const [root, uid, folder, filename] = objectPath.segments
  if (
    root !== 'users'
    || uid !== expectedUid
    || folder !== 'profile'
    || filename === 'avatar'
    || !LEGACY_FILENAME_PATTERN.test(filename)
  ) return null

  return Object.freeze({
    bucket: HOLALOCAL_FIREBASE_STORAGE_BUCKET,
    kind: 'profile',
    storagePath: objectPath.decoded,
    uid,
  })
}

export function isLegacyFirebaseProfileMediaUrl(url, expectedUid) {
  return Boolean(parseLegacyFirebaseProfileMediaUrl(url, expectedUid))
}
