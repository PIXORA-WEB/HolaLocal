import {
  ACCOUNT_STATUSES, BUSINESS_STATUSES, BUSINESS_TRUSTED_FIELDS, CONTACT_METHODS,
  DEFAULT_ARRAY_BOUNDS, SUBSCRIPTION_STATUSES, USER_ROLES, USER_TRUSTED_FIELDS,
  VERIFICATION_STATUSES,
} from './constants.js'
import { detectUnsafePublicContact } from './contact.js'
import { ISSUE_CODES, issue } from './issues.js'
import { isCustomIdentifier, isStandardLanguageCode } from './normalization.js'

function result(issues) {
  return { valid: issues.length === 0, issues }
}

function enumValidator(value, allowed, field) {
  return result(allowed.includes(value) ? [] : [issue(ISSUE_CODES.VALIDATION_INVALID_VALUE, { field, value })])
}

export const validateAccountStatus = (value) => enumValidator(value, ACCOUNT_STATUSES, 'accountStatus')
export const validateBusinessStatus = (value) => enumValidator(value, BUSINESS_STATUSES, 'status')
export const validateVerificationStatus = (value) => enumValidator(value, VERIFICATION_STATUSES, 'verificationStatus')
export const validateSubscriptionStatus = (value) => enumValidator(value, SUBSCRIPTION_STATUSES, 'subscription.status')

export function validateRoles(value) {
  const issues = []
  if (!Array.isArray(value) || value.length === 0) return result([issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: 'roles' })])
  if (value.length > DEFAULT_ARRAY_BOUNDS.roles) issues.push(issue(ISSUE_CODES.VALIDATION_ARRAY_TOO_LARGE, { field: 'roles' }))
  if (new Set(value).size !== value.length) issues.push(issue(ISSUE_CODES.VALIDATION_ARRAY_DUPLICATE, { field: 'roles' }))
  if (value.some((role) => !USER_ROLES.includes(role))) issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_VALUE, { field: 'roles' }))
  return result(issues)
}

export function validateBoundedArray(value, field, maximum = DEFAULT_ARRAY_BOUNDS[field]) {
  const issues = []
  if (!Array.isArray(value)) return result([issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field })])
  if (Number.isInteger(maximum) && value.length > maximum) issues.push(issue(ISSUE_CODES.VALIDATION_ARRAY_TOO_LARGE, { field, maximum }))
  if (new Set(value).size !== value.length) issues.push(issue(ISSUE_CODES.VALIDATION_ARRAY_DUPLICATE, { field }))
  return result(issues)
}

export function validateLanguageIdentifier(value) {
  return result(isStandardLanguageCode(value) || isCustomIdentifier(value, 'language')
    ? [] : [issue(ISSUE_CODES.VALIDATION_INVALID_VALUE, { field: 'language', value })])
}

export function validatePrimaryLanguage(primaryLanguage, languages) {
  const issues = []
  if (!Array.isArray(languages) || languages.some((value) => !validateLanguageIdentifier(value).valid)) {
    issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_VALUE, { field: 'languages' }))
  }
  if (!languages?.includes(primaryLanguage)) issues.push(issue(ISSUE_CODES.VALIDATION_PRIMARY_NOT_IN_LANGUAGES))
  return result(issues)
}

export function validateOwnerId(ownerId) {
  return result(typeof ownerId === 'string' && ownerId.trim()
    ? [] : [issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: 'ownerId' })])
}

export function validateManagerIds(ownerId, managerIds) {
  const issues = [...validateOwnerId(ownerId).issues, ...validateBoundedArray(managerIds, 'managerIds').issues]
  if (managerIds?.some((id) => typeof id !== 'string' || !id.trim())) {
    issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: 'managerIds' }))
  }
  if (!managerIds?.includes(ownerId)) issues.push(issue(ISSUE_CODES.VALIDATION_OWNER_NOT_MANAGER))
  return result(issues)
}

export function validatePublicContact(businessOrContact) {
  const business = Object.hasOwn(businessOrContact ?? {}, 'contact') ? businessOrContact : { contact: businessOrContact }
  const safety = detectUnsafePublicContact(business)
  return result(safety.issues)
}

export function validatePrivateContact(contact) {
  const issues = []
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return result([issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: 'contact' })])
  }
  const values = contact.contact && typeof contact.contact === 'object' && !Array.isArray(contact.contact)
    ? contact.contact : contact
  const visibility = contact.visibility && typeof contact.visibility === 'object' && !Array.isArray(contact.visibility)
    ? contact.visibility : values
  for (const field of ['phone', 'email', 'whatsappNumber', 'website']) {
    if (values[field] !== undefined && typeof values[field] !== 'string') {
      issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: `contact.${field}` }))
    }
  }
  const valueKeys = new Set([
    'phone', 'email', 'whatsappNumber', 'website', 'phoneVisible', 'emailVisible',
    'whatsappVisible', 'websiteVisible', 'visibility', 'preferredContactMethod',
    'allowCallbackRequests', 'callbackPreferences',
  ])
  if (Object.keys(values).some((field) => !valueKeys.has(field))) {
    issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_VALUE, { field: 'contact' }))
  }
  for (const field of ['phone', 'email', 'whatsapp', 'website']) {
    const value = visibility[field] ?? visibility[`${field}Visible`]
    if (value !== undefined && typeof value !== 'boolean') {
      issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: `visibility.${field}` }))
    }
  }
  const preferredContactMethod = contact.preferredContactMethod ?? values.preferredContactMethod
  if (preferredContactMethod !== undefined && !CONTACT_METHODS.includes(preferredContactMethod)) {
    issues.push(issue(ISSUE_CODES.VALIDATION_INVALID_VALUE, { field: 'preferredContactMethod' }))
  }
  return result(issues)
}

export function validateBusinessOwnerMapping(mapping, documentId) {
  const issues = []
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    return result([issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: 'mapping' })])
  }
  if (typeof mapping.ownerId !== 'string' || mapping.ownerId !== documentId) issues.push(issue(ISSUE_CODES.LOOKUP_INVALID_MAPPING))
  if (typeof mapping.businessId !== 'string' || !mapping.businessId.trim() || mapping.businessId !== mapping.businessId.trim()) {
    issues.push(issue(ISSUE_CODES.LOOKUP_INVALID_MAPPING))
  }
  return result(issues)
}

export function validateOwnerWritablePayload(payload, contract) {
  const trusted = contract === 'user'
    ? [...USER_TRUSTED_FIELDS]
    : contract === 'business'
      ? [...BUSINESS_TRUSTED_FIELDS, 'verification', 'publication', 'ratings']
      : []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return result([issue(ISSUE_CODES.VALIDATION_INVALID_TYPE, { field: 'payload' })])
  }
  const paths = []
  const visit = (value, prefix = '') => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    for (const [key, nestedValue] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      paths.push(path)
      visit(nestedValue, path)
    }
  }
  visit(payload)
  const forbidden = [...new Set(paths.filter((path) => trusted.some(
    (trustedPath) => path === trustedPath || path.startsWith(`${trustedPath}.`),
  )))]
  return result(forbidden.map((field) => issue(
    ISSUE_CODES.VALIDATION_TRUSTED_FIELD_IN_OWNER_PAYLOAD, { field },
  )))
}
