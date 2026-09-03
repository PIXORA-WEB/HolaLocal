export function normalizeInternalLocation(location) {
  const pathname = location?.pathname
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.includes('\\')) {
    return null
  }
  let decodedPathname
  try {
    decodedPathname = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decodedPathname.startsWith('//') || decodedPathname.includes('\\')) return null

  const search = typeof location.search === 'string' && location.search.startsWith('?')
    ? location.search : ''
  const hash = typeof location.hash === 'string' && location.hash.startsWith('#')
    ? location.hash : ''
  const candidate = `${pathname}${search}${hash}`
  try {
    const base = new URL('https://internal.holalocal.invalid/')
    const resolved = new URL(candidate, base)
    if (resolved.origin !== base.origin) return null
    return Object.freeze({
      pathname: resolved.pathname,
      search: resolved.search,
      hash: resolved.hash,
    })
  } catch {
    return null
  }
}

export function internalPathFromLocation(location, fallback = '/') {
  const normalized = normalizeInternalLocation(location)
  return normalized
    ? `${normalized.pathname}${normalized.search}${normalized.hash}`
    : fallback
}

export function intendedLocation(location) {
  return normalizeInternalLocation(location?.state?.from)
}
