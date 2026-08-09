export function internalPathFromLocation(location, fallback = '/') {
  const pathname = location?.pathname
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.includes('\\')) {
    return fallback
  }
  let decodedPathname
  try {
    decodedPathname = decodeURIComponent(pathname)
  } catch {
    return fallback
  }
  if (decodedPathname.startsWith('//') || decodedPathname.includes('\\')) return fallback

  const search = typeof location.search === 'string' && location.search.startsWith('?')
    ? location.search : ''
  const hash = typeof location.hash === 'string' && location.hash.startsWith('#')
    ? location.hash : ''
  const candidate = `${pathname}${search}${hash}`
  try {
    const base = new URL('https://internal.holalocal.invalid/')
    const resolved = new URL(candidate, base)
    if (resolved.origin !== base.origin) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}

export function intendedLocation(location) {
  return location?.state?.from ?? null
}
