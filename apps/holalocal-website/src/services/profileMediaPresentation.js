import {
  isCanonicalProfileMediaPath,
  parseLegacyFirebaseProfileMediaUrl,
} from '@holalocal/firebase-contract'
import { CANONICAL_MEDIA_MAX_DOWNLOAD_BYTES, loadCanonicalBlobPresentation } from './canonicalMediaPresentation.js'

export const PRIVATE_PROFILE_MEDIA_MAX_BYTES = CANONICAL_MEDIA_MAX_DOWNLOAD_BYTES

export function resolveProfileMediaReference(uid, userProfile) {
  if (!uid || !userProfile) return null

  const storagePath = userProfile.profilePhoto?.storagePath
  if (isCanonicalProfileMediaPath(storagePath, uid)) {
    return Object.freeze({ kind: 'canonical', storagePath })
  }

  for (const url of [userProfile.profilePhoto?.downloadUrl, userProfile.photoURL]) {
    const legacy = parseLegacyFirebaseProfileMediaUrl(url, uid)
    if (legacy && (storagePath == null || storagePath === legacy.storagePath)) {
      return Object.freeze({ kind: 'legacy', storagePath: legacy.storagePath, url })
    }
  }
  return null
}

export async function loadProfileMediaPresentation(uid, userProfile, dependencies = {}) {
  const media = resolveProfileMediaReference(uid, userProfile)
  if (!media) return null
  if (media.kind === 'legacy') return Object.freeze({ kind: 'legacy', revoke: null, url: media.url })

  const presentation = await loadCanonicalBlobPresentation(media.storagePath, dependencies)
  return Object.freeze({
    kind: 'canonical',
    revoke: presentation.revoke,
    url: presentation.url,
  })
}
