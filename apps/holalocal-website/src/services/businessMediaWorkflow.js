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
    .map((path) => Number(path.split('/').at(-1))))
  for (const slot of reservedSlots) occupied.add(slot)
  return CANONICAL_BUSINESS_GALLERY_SLOTS.find((slot) => !occupied.has(slot)) ?? null
}

export async function runBusinessLogoUpload(businessId, file, { getBusiness, upload, finalize, remove }) {
  const before = await getBusiness(businessId)
  const storagePath = buildCanonicalBusinessLogoPath(businessId)
  await upload(storagePath, file)
  try {
    await finalize('set-logo', businessId, storagePath)
  } catch (error) {
    if (before?.logoStoragePath !== storagePath) await remove(storagePath).catch(() => undefined)
    throw error
  }
  const legacyLogo = parseLegacyFirebaseBusinessMediaUrl(
    before?.profilePhoto?.downloadUrl ?? before?.legacyMedia?.logoURL,
    businessId,
  )
  if (legacyLogo?.kind === 'logo') await remove(legacyLogo.storagePath).catch(() => undefined)
  return getBusiness(businessId)
}

export async function runBusinessGalleryUploads(
  businessId, files, { getBusiness, upload, finalize },
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
        await upload(storagePath, file)
        // Canonical gallery slots are shared deterministic objects. If finalization
        // fails, a different browser may still have finalized this path after
        // overwriting it, so the browser must preserve the object instead of risking
        // deletion of authoritative media. Any residual is bounded to eight private
        // canonical slots and can be reconciled by a future trusted cleanup process.
        await finalize('add-gallery', businessId, storagePath)
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
