import {
  isCanonicalBusinessGalleryPath,
  isCanonicalBusinessLogoPath,
  parseLegacyFirebaseBusinessMediaUrl,
} from '@holalocal/firebase-contract'
import { loadCanonicalBlobPresentation } from './canonicalMediaPresentation.js'

const canonicalUrlCache = new Map()

async function defaultCanonicalUrlResolver(storagePath) {
  return loadCanonicalBlobPresentation(storagePath)
}

async function resolveCanonicalUrl(storagePath, resolver) {
  if (!canonicalUrlCache.has(storagePath)) {
    canonicalUrlCache.set(storagePath, Promise.resolve(resolver(storagePath)).catch((error) => {
      canonicalUrlCache.delete(storagePath)
      throw error
    }))
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

export async function resolveBusinessMediaPresentation(
  businessId,
  business,
  { resolveCanonicalUrl: resolver = defaultCanonicalUrlResolver } = {},
) {
  const logoStoragePath = isCanonicalBusinessLogoPath(business?.logoStoragePath, businessId)
    ? business.logoStoragePath : null
  const galleryStoragePaths = Array.isArray(business?.galleryStoragePaths)
    ? business.galleryStoragePaths.filter((path, index, paths) => (
      isCanonicalBusinessGalleryPath(path, businessId) && paths.indexOf(path) === index
    ))
    : []
  const canonicalGallery = (await Promise.all(galleryStoragePaths.map(async (storagePath) => {
    try {
      return Object.freeze({
        downloadUrl: (await resolveCanonicalUrl(storagePath, resolver)).url,
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
        downloadUrl: (await resolveCanonicalUrl(logoStoragePath, resolver)).url,
        kind: 'canonical',
        storagePath: logoStoragePath,
      })
    } catch {
      canonicalLogo = null
    }
  }

  const legacy = legacyCandidates(business)
  const legacyLogo = safeLegacyEntry(legacy.logo, businessId, 'logo')
  const seen = new Set(canonicalGallery.map(({ storagePath }) => storagePath))
  const legacyGallery = legacy.gallery.map((url) => safeLegacyEntry(url, businessId, 'gallery'))
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

export function clearBusinessMediaPresentationCache() {
  for (const entry of canonicalUrlCache.values()) {
    Promise.resolve(entry).then((presentation) => presentation?.revoke?.()).catch(() => undefined)
  }
  canonicalUrlCache.clear()
}
