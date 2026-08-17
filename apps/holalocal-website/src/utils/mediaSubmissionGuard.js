function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function mediaFileContentIdentity(file, subtle = globalThis.crypto?.subtle) {
  if (!file || typeof file.arrayBuffer !== 'function' || !subtle?.digest) {
    throw new Error('A browser File and Web Crypto are required for media upload deduplication.')
  }
  const digest = await subtle.digest('SHA-256', await file.arrayBuffer())
  return `sha256:${bytesToHex(new Uint8Array(digest))}`
}

export function createMediaSubmissionGuard({ identify = mediaFileContentIdentity } = {}) {
  let active = false
  const identities = new WeakMap()
  const successfulIdentities = new Set()

  async function identityFor(file) {
    let identity = identities.get(file)
    if (!identity) {
      identity = await identify(file)
      identities.set(file, identity)
    }
    return identity
  }

  return Object.freeze({
    tryAcquire() {
      if (active) return false
      active = true
      return true
    },

    release() {
      active = false
    },

    async pendingFiles(files) {
      const pending = []
      const seen = new Set()
      for (const file of files) {
        const identity = await identityFor(file)
        if (seen.has(identity) || successfulIdentities.has(identity)) continue
        seen.add(identity)
        pending.push(file)
      }
      return pending
    },

    async markSuccessful(file) {
      successfulIdentities.add(await identityFor(file))
    },
  })
}
