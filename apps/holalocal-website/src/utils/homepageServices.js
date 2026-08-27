import { isCanonicalServiceId } from '@holalocal/firebase-contract'

export function getHomepageServiceHref(serviceId) {
  return isCanonicalServiceId(serviceId)
    ? `/services?service=${encodeURIComponent(serviceId)}`
    : '/services'
}
