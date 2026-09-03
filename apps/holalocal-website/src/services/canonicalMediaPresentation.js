import { withTimeout } from '../utils/withTimeout.js'

export const CANONICAL_MEDIA_MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024
export const CANONICAL_MEDIA_RESOLUTION_TIMEOUT_MS = 4_000
export const CANONICAL_MEDIA_TIMEOUT_CODE = 'canonical-media-timeout'

export async function loadCanonicalBlobPresentation(storagePath, dependencies = {}) {
  const getBlob = dependencies.getBlob ?? (async (path, maxBytes) => {
    const storage = await import('../firebase/storageClient.js')
    return storage.getCanonicalImageBlob(path, maxBytes)
  })
  const createObjectURL = dependencies.createObjectURL ?? ((blob) => URL.createObjectURL(blob))
  const revokeObjectURL = dependencies.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url))
  const timeoutMs = dependencies.timeoutMs ?? CANONICAL_MEDIA_RESOLUTION_TIMEOUT_MS
  const blob = await withTimeout(
    () => getBlob(storagePath, CANONICAL_MEDIA_MAX_DOWNLOAD_BYTES),
    timeoutMs,
    { timeoutCode: CANONICAL_MEDIA_TIMEOUT_CODE },
  )
  const url = createObjectURL(blob)
  let revoked = false
  return Object.freeze({
    storagePath,
    url,
    revoke() {
      if (revoked) return
      revoked = true
      revokeObjectURL(url)
    },
  })
}
