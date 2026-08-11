import {
  isCanonicalBusinessGalleryPath,
  isCanonicalBusinessLogoPath,
  parseLegacyFirebaseBusinessMediaUrl,
} from '@holalocal/firebase-contract'

function legacyUrlForKind(url, businessId, kind) {
  const parsed = parseLegacyFirebaseBusinessMediaUrl(url, businessId)
  return parsed?.kind === kind ? url : null
}

function legacyGalleryCandidates(rawBusiness) {
  if (Array.isArray(rawBusiness?.galleryImages) && rawBusiness.galleryImages.length > 0) {
    return rawBusiness.galleryImages.map((value) => value?.downloadUrl)
  }
  return Array.isArray(rawBusiness?.galleryImageURLs) ? rawBusiness.galleryImageURLs : []
}

export function projectSafeBusinessMedia(businessId, rawBusiness) {
  const logoStoragePath = isCanonicalBusinessLogoPath(rawBusiness?.logoStoragePath, businessId)
    ? rawBusiness.logoStoragePath
    : null
  const galleryStoragePaths = Array.isArray(rawBusiness?.galleryStoragePaths)
    ? rawBusiness.galleryStoragePaths.filter(
      (path, index, values) => isCanonicalBusinessGalleryPath(path, businessId)
        && values.indexOf(path) === index,
    )
    : []
  const logoUrl = legacyUrlForKind(rawBusiness?.profilePhoto?.downloadUrl, businessId, 'logo')
  const galleryUrls = []
  const seenLegacyPaths = new Set()
  for (const url of legacyGalleryCandidates(rawBusiness)) {
    const parsed = parseLegacyFirebaseBusinessMediaUrl(url, businessId)
    if (parsed?.kind !== 'gallery' || seenLegacyPaths.has(parsed.storagePath)) continue
    seenLegacyPaths.add(parsed.storagePath)
    galleryUrls.push(url)
  }
  return Object.freeze({ logoStoragePath, galleryStoragePaths, logoUrl, galleryUrls })
}
