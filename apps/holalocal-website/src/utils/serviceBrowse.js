import {
  getServiceGroupId,
  isCanonicalServiceId,
} from '@holalocal/firebase-contract'
import { SERVICE_DISCOVERY_QUERY_TYPES } from './serviceDiscovery.js'

export function deriveServiceBrowseSelection(query) {
  if (query?.type === SERVICE_DISCOVERY_QUERY_TYPES.SERVICE) {
    return Object.freeze({
      groupId: getServiceGroupId(query.serviceId) ?? '',
      serviceId: query.serviceId,
    })
  }
  if (query?.type === SERVICE_DISCOVERY_QUERY_TYPES.GROUP_COMPATIBILITY) {
    return Object.freeze({ groupId: query.groupId, serviceId: '' })
  }
  return Object.freeze({ groupId: '', serviceId: '' })
}

export function buildServiceSelectionSearchParams(value, serviceId) {
  const params = value instanceof URLSearchParams
    ? new URLSearchParams(value)
    : new URLSearchParams(typeof value === 'string' ? value : '')
  params.delete('category')
  params.delete('service')
  if (isCanonicalServiceId(serviceId)) params.set('service', serviceId)
  return params
}
