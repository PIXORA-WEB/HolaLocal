import { isCanonicalServiceId } from '@holalocal/firebase-contract'

export function getHomepageServiceHref(serviceId) {
  return isCanonicalServiceId(serviceId)
    ? `/services?service=${encodeURIComponent(serviceId)}`
    : '/services'
}

export function buildHomepageSearchHref({ searchTerm, area } = {}) {
  const params = new URLSearchParams()
  const normalizedSearchTerm = typeof searchTerm === 'string' ? searchTerm.trim() : ''
  const normalizedArea = typeof area === 'string' ? area.trim() : ''

  if (normalizedSearchTerm) {
    params.set('q', normalizedSearchTerm)
  }

  if (normalizedArea) {
    params.set('area', normalizedArea)
  }

  const query = params.toString()
  return query ? `/services?${query}` : '/services'
}
