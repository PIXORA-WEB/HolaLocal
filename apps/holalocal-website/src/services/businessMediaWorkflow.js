import {
  buildCanonicalBusinessGalleryPath,
  buildCanonicalBusinessLogoPath,
  CANONICAL_BUSINESS_GALLERY_SLOTS,
  isCanonicalBusinessGalleryPath,
  parseLegacyFirebaseBusinessMediaUrl,
} from '@holalocal/firebase-contract'
import { createApplicationError } from '../utils/frontendErrors.js'

const reservationsByBusiness = new Map()

export function selectAvailableCanonicalGallerySlot(businessId, galleryStoragePaths = [], reservedSlots = []) {
  const occupied = new Set(galleryStoragePaths
    .filter((path) => isCanonicalBusinessGalleryPath(path, businessId))
    .map((path) => Number(path.split('/')[3])))
  for (const slot of reservedSlots) occupied.add(slot)
  return CANONICAL_BUSINESS_GALLERY_SLOTS.find((slot) => !occupied.has(slot)) ?? null
}

export async function runBusinessLogoUpload(businessId, file, { getBusiness, upload, prepare, finalize, remove }) {
  const before = await getBusiness(businessId)
  const storagePath = buildCanonicalBusinessLogoPath(businessId)
  const session = await prepare('prepare-logo', businessId, storagePath)
  const uploaded = await upload(session.stagingPath, file, session.requestId)
  await finalize('finalize-logo', businessId, storagePath, {
    requestId: session.requestId, stagingGeneration: uploaded.generation,
  })
  const legacyLogo = parseLegacyFirebaseBusinessMediaUrl(
    before?.profilePhoto?.downloadUrl ?? before?.legacyMedia?.logoURL,
    businessId,
  )
  if (legacyLogo?.kind === 'logo') await remove(legacyLogo.storagePath).catch(() => undefined)
  return getBusiness(businessId)
}

export async function runBusinessGalleryUploads(
  businessId, files, { getBusiness, upload, prepare, finalize },
) {
  const reservations = reservationsByBusiness.get(businessId) ?? new Set()
  reservationsByBusiness.set(businessId, reservations)
  let latest = await getBusiness(businessId)
  try {
    for (const file of files) {
      const slot = selectAvailableCanonicalGallerySlot(businessId, latest?.galleryStoragePaths, reservations)
      if (slot === null) throw createApplicationError('media-gallery-slots-full')
      reservations.add(slot)
      const storagePath = buildCanonicalBusinessGalleryPath(businessId, slot)
      try {
        const session = await prepare('prepare-gallery', businessId, storagePath)
        const uploaded = await upload(session.stagingPath, file, session.requestId)
        await finalize('finalize-gallery', businessId, storagePath, {
          requestId: session.requestId, stagingGeneration: uploaded.generation,
        })
        latest = await getBusiness(businessId)
      } finally {
        reservations.delete(slot)
      }
    }
    return latest
  } finally {
    if (reservations.size === 0) reservationsByBusiness.delete(businessId)
  }
}
