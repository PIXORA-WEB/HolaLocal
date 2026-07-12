import { CONTACT_METHODS, PUBLIC_CONTACT_FIELDS } from './constants.js'
import { ISSUE_CODES, issue } from './issues.js'

const VALUE_FIELDS = Object.freeze({ phone: 'phone', email: 'email', whatsapp: 'whatsappNumber', website: 'website' })
const VISIBILITY_FIELDS = Object.freeze({
  phone: 'phoneVisible', email: 'emailVisible', whatsapp: 'whatsappVisible', website: 'websiteVisible',
})

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function projectPublicContact(privateContact = {}) {
  const issues = []
  const container = privateContact && typeof privateContact === 'object' && !Array.isArray(privateContact)
    ? privateContact : {}
  if (container !== privateContact) issues.push(issue(ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE))
  if (Object.hasOwn(container, 'contact') && (
    !container.contact || typeof container.contact !== 'object' || Array.isArray(container.contact)
  )) issues.push(issue(ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE, { field: 'contact' }))
  if (Object.hasOwn(container, 'visibility') && (
    !container.visibility || typeof container.visibility !== 'object' || Array.isArray(container.visibility)
  )) issues.push(issue(ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE, { field: 'visibility' }))
  const contact = container.contact && typeof container.contact === 'object' && !Array.isArray(container.contact)
    ? container.contact : container
  const visibility = container.visibility && typeof container.visibility === 'object'
    ? container.visibility
    : contact.visibility && typeof contact.visibility === 'object' ? contact.visibility : contact
  const knownPrivateContactKeys = new Set([
    ...PUBLIC_CONTACT_FIELDS, 'whatsapp', 'phoneVisible', 'emailVisible', 'whatsappVisible',
    'websiteVisible', 'visibility', 'preferredContactMethod', 'allowCallbackRequests',
    'callbackPreferences',
  ])
  if (contact !== container && Object.keys(contact).some((field) => !knownPrivateContactKeys.has(field))) {
    issues.push(issue(ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE, { field: 'contact' }))
  }
  const projection = {
    phone: '', phoneVisible: visibility.phone === true || visibility.phoneVisible === true,
    email: '', emailVisible: visibility.email === true || visibility.emailVisible === true,
    whatsappNumber: '', whatsappVisible: visibility.whatsapp === true || visibility.whatsappVisible === true,
    website: '', websiteVisible: visibility.website === true || visibility.websiteVisible === true,
    preferredContactMethod: 'holalocal',
    allowCallbackRequests: container.allowCallbackRequests === true || contact.allowCallbackRequests === true ||
      container.callbackPreferences?.allowRequests === true || contact.callbackPreferences?.allowRequests === true,
  }
  for (const method of Object.keys(VALUE_FIELDS)) {
    const valueField = VALUE_FIELDS[method]
    const visibilityField = VISIBILITY_FIELDS[method]
    if (projection[visibilityField]) projection[valueField] = text(contact[valueField] ?? contact[method])
  }
  const preferred = container.preferredContactMethod ?? contact.preferredContactMethod ?? 'holalocal'
  if (!CONTACT_METHODS.includes(preferred)) {
    issues.push(issue(ISSUE_CODES.CONTACT_INVALID_PREFERRED_METHOD, { method: preferred }))
  } else if (preferred !== 'holalocal' && (
    !projection[VISIBILITY_FIELDS[preferred]] || !projection[VALUE_FIELDS[preferred]]
  )) {
    issues.push(issue(ISSUE_CODES.CONTACT_PREFERRED_METHOD_NOT_PUBLIC, { method: preferred }))
  } else {
    projection.preferredContactMethod = preferred
  }
  return { contact: projection, issues }
}

export function detectUnsafePublicContact(business = {}) {
  const issues = []
  if (!business || typeof business !== 'object' || Array.isArray(business)) {
    return { safe: false, issues: [issue(ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE)] }
  }
  for (const field of ['phone', 'email', 'whatsapp', 'whatsappNumber', 'website']) {
    if (typeof business[field] === 'string' && business[field].trim()) {
      issues.push(issue(ISSUE_CODES.CONTACT_TOP_LEVEL_PRIVATE_FIELD, { field }))
    }
  }
  const contact = business.contact
  if (contact !== undefined && (!contact || typeof contact !== 'object' || Array.isArray(contact))) {
    issues.push(issue(ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE, { field: 'contact' }))
  } else if (contact) {
    const known = new Set([
      ...PUBLIC_CONTACT_FIELDS, 'whatsapp', 'phoneVisible', 'emailVisible', 'whatsappVisible',
      'websiteVisible', 'preferredContactMethod', 'allowCallbackRequests',
    ])
    if (Object.keys(contact).some((field) => !known.has(field))) {
      issues.push(issue(ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE, { field: 'contact' }))
    }
    for (const method of Object.keys(VALUE_FIELDS)) {
      const valueField = VALUE_FIELDS[method]
      const visibilityField = VISIBILITY_FIELDS[method]
      if (contact[visibilityField] !== undefined && typeof contact[visibilityField] !== 'boolean') {
        issues.push(issue(ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE, { field: `contact.${visibilityField}` }))
      }
      if (text(contact[valueField] ?? contact[method]) && contact[visibilityField] !== true) {
        issues.push(issue(ISSUE_CODES.CONTACT_HIDDEN_VALUE_PRESENT, { field: `contact.${valueField}` }))
      }
    }
  }
  return { safe: issues.length === 0, issues }
}
