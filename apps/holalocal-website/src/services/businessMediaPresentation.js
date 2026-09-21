import {
  isCanonicalBusinessGalleryPath,
  isCanonicalBusinessLogoPath,
  parseLegacyFirebaseBusinessMediaUrl,
} from '@holalocal/firebase-contract'
import { loadCanonicalBlobPresentation } from './canonicalMediaPresentation.js'

const canonicalUrlCache = new Map()
const retiredPresentations = new Set()

async function defaultCanonicalUrlResolver(storagePath) {
  return loadCanonicalBlobPresentation(storagePath)
}

async function resolveCanonicalUrl(storagePath, resolver) {
  if (!canonicalUrlCache.has(storagePath)) {
    const presentationPromise = Promise.resolve(resolver(storagePath)).catch((error) => {
      if (canonicalUrlCache.get(storagePath) === presentationPromise) {
        canonicalUrlCache.delete(storagePath)
      }
      throw error
    })
    canonicalUrlCache.set(storagePath, presentationPromise)
  }
  return canonicalUrlCache.get(storagePath)
}

function legacyCandidates(business) {
  const gallery = Array.isArray(business?.galleryImages) && business.galleryImages.length
    ? business.galleryImages.map((image) => image?.downloadUrl)
    : (business?.galleryImageURLs ?? business?.galleryUrls ?? [])
  return {
    gallery: Array.isArray(gallery) ? gallery : [],
    logo: business?.profilePhoto?.downloadUrl ?? business?.legacyMedia?.logoURL ?? business?.logoUrl ?? null,
  }
}

function safeLegacyEntry(url, businessId, kind) {
  const parsed = parseLegacyFirebaseBusinessMediaUrl(url, businessId)
  return parsed?.kind === kind
    ? Object.freeze({ downloadUrl: url, kind: 'legacy', storagePath: parsed.storagePath })
    : null
}

// Apply the same path/legacy URL filtering without downloading canonical media.
export function prepareBusinessMediaPresentation(
  businessId,
  business,
  { includeGallery = true, canonicalGallery = [], canonicalLogo = null } = {},
) {
  const logoStoragePath = isCanonicalBusinessLogoPath(business?.logoStoragePath, businessId)
    ? business.logoStoragePath : null
  const galleryStoragePaths = Array.isArray(business?.galleryStoragePaths)
    ? business.galleryStoragePaths.filter((path, index, paths) => (
      isCanonicalBusinessGalleryPath(path, businessId) && paths.indexOf(path) === index
    ))
    : []
  const legacy = legacyCandidates(business)
  const legacyLogo = safeLegacyEntry(legacy.logo, businessId, 'logo')
  const seen = new Set(canonicalGallery.map(({ storagePath }) => storagePath))
  const legacyGallery = (includeGallery ? legacy.gallery : []).map((url) => safeLegacyEntry(url, businessId, 'gallery'))
    .filter((entry) => entry && !seen.has(entry.storagePath) && (seen.add(entry.storagePath), true))
  const galleryEntries = Object.freeze([...canonicalGallery, ...legacyGallery])
  const logoEntry = canonicalLogo ?? legacyLogo
  const mediaFields = new Set([
    'galleryImageURLs', 'galleryImages', 'galleryUrls', 'legacyMedia', 'logoUrl', 'profilePhoto',
  ])
  const safeBusiness = Object.fromEntries(
    Object.entries(business ?? {}).filter(([field]) => !mediaFields.has(field)),
  )

  return {
    ...safeBusiness,
    logoStoragePath,
    galleryStoragePaths: Object.freeze([...galleryStoragePaths]),
    logoUrl: logoEntry?.downloadUrl ?? null,
    galleryEntries,
    legacyGalleryEntries: Object.freeze([...legacyGallery]),
    galleryUrls: Object.freeze(galleryEntries.map(({ downloadUrl }) => downloadUrl)),
  }
}

export async function resolveBusinessMediaPresentation(
  businessId,
  business,
  { resolveCanonicalUrl: resolver = defaultCanonicalUrlResolver, includeGallery = true, signal } = {},
) {
  const { logoStoragePath, galleryStoragePaths } = prepareBusinessMediaPresentation(businessId, business)
  // Progressive detail requests own their URLs. The route-wide cache can be
  // cleared while these downloads are still running; it must not own them.
  const ownedPresentations = new Set()
  signal?.addEventListener('abort', () => {
    for (const presentation of ownedPresentations) presentation.revoke?.()
    ownedPresentations.clear()
  }, { once: true })
  async function resolveUrl(storagePath) {
    if (!signal) return resolveCanonicalUrl(storagePath, resolver)
    signal.throwIfAborted()
    const presentation = await resolver(storagePath)
    if (signal.aborted) {
      presentation.revoke?.()
      signal.throwIfAborted()
    }
    ownedPresentations.add(presentation)
    return presentation
  }
  const canonicalGallery = (await Promise.all((includeGallery ? galleryStoragePaths : []).map(async (storagePath) => {
    try {
      return Object.freeze({
        downloadUrl: (await resolveUrl(storagePath)).url,
        kind: 'canonical',
        storagePath,
      })
    } catch {
      return null
    }
  }))).filter(Boolean)
  let canonicalLogo = null
  if (logoStoragePath) {
    try {
      canonicalLogo = Object.freeze({
        downloadUrl: (await resolveUrl(logoStoragePath)).url,
        kind: 'canonical',
        storagePath: logoStoragePath,
      })
    } catch {
      canonicalLogo = null
    }
  }
  return prepareBusinessMediaPresentation(businessId, business, { includeGallery, canonicalGallery, canonicalLogo })
}

// In-place refreshes may still display prior URLs until new metadata arrives.
// Retire them now; the route layout cleanup releases them after that view leaves.
export function clearBusinessMediaPresentationCache({ deferRevocation = false } = {}) {
  for (const entry of canonicalUrlCache.values()) retiredPresentations.add(entry)
  canonicalUrlCache.clear()
  if (!deferRevocation) {
    for (const entry of retiredPresentations) {
      Promise.resolve(entry).then((presentation) => presentation?.revoke?.()).catch(() => undefined)
    }
    retiredPresentations.clear()
  }
}
