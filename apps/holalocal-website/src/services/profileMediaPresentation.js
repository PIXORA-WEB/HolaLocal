import {
  isCanonicalProfileMediaPath,
  parseLegacyFirebaseProfileMediaUrl,
} from '@holalocal/firebase-contract'

export const PRIVATE_PROFILE_MEDIA_MAX_BYTES = 5 * 1024 * 1024

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

  const getBlob = dependencies.getBlob ?? (async (storagePath, maxBytes) => {
    const storage = await import('../firebase/storageClient.js')
    return storage.getPrivateImageBlob(storagePath, maxBytes)
  })
  const createObjectURL = dependencies.createObjectURL ?? ((blob) => URL.createObjectURL(blob))
  const revokeObjectURL = dependencies.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url))
  const blob = await getBlob(media.storagePath, PRIVATE_PROFILE_MEDIA_MAX_BYTES)
  const url = createObjectURL(blob)
  return Object.freeze({
    kind: 'canonical',
    revoke: () => revokeObjectURL(url),
    url,
  })
}
