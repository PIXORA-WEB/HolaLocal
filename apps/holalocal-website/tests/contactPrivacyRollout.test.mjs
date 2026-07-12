import test from 'node:test'
import assert from 'node:assert/strict'
import { projectPublicContact } from '@holalocal/firebase-contract'

const oldAllowedContactKeys = new Set([
  'phone', 'phoneVisible', 'email', 'emailVisible', 'whatsappNumber',
  'whatsappVisible', 'website', 'preferredContactMethod', 'allowCallbackRequests',
])

const newAllowedContactKeys = new Set([...oldAllowedContactKeys, 'websiteVisible'])

const privateContact = {
  phone: '000000000',
  phoneVisible: false,
  email: 'owner@example.invalid',
  emailVisible: false,
  whatsappNumber: '111111111',
  whatsappVisible: false,
  website: 'https://example.invalid',
  websiteVisible: false,
  preferredContactMethod: 'holalocal',
  allowCallbackRequests: false,
}

function oldWebsitePublicContact(contact = {}) {
  return {
    phone: contact.phoneVisible === true ? contact.phone : '',
    phoneVisible: contact.phoneVisible === true,
    email: contact.emailVisible === true ? contact.email : '',
    emailVisible: contact.emailVisible === true,
    whatsappNumber: contact.whatsappVisible === true ? contact.whatsappNumber : '',
    whatsappVisible: contact.whatsappVisible === true,
    website: typeof contact.website === 'string' ? contact.website.trim() : '',
    preferredContactMethod: contact.preferredContactMethod ?? 'holalocal',
    allowCallbackRequests: contact.allowCallbackRequests === true,
  }
}

function newWebsitePublicContact(contact = {}) {
  return projectPublicContact(contact).contact
}

function oldRulesSafePublicContact(contact) {
  return contact && typeof contact === 'object' && !Array.isArray(contact)
    && Object.keys(contact).every((field) => oldAllowedContactKeys.has(field))
    && ['phoneVisible', 'emailVisible', 'whatsappVisible', 'allowCallbackRequests']
      .every((field) => typeof contact[field] === 'boolean')
    && ['phone', 'email', 'whatsappNumber', 'website']
      .every((field) => typeof contact[field] === 'string')
    && (contact.phoneVisible || contact.phone === '')
    && (contact.emailVisible || contact.email === '')
    && (contact.whatsappVisible || contact.whatsappNumber === '')
    && ['holalocal', 'phone', 'email', 'whatsapp'].includes(contact.preferredContactMethod)
}

function newRulesSafePublicContact(contact) {
  return contact && typeof contact === 'object' && !Array.isArray(contact)
    && Object.keys(contact).every((field) => newAllowedContactKeys.has(field))
    && ['phoneVisible', 'emailVisible', 'whatsappVisible', 'websiteVisible', 'allowCallbackRequests']
      .every((field) => typeof contact[field] === 'boolean')
    && ['phone', 'email', 'whatsappNumber', 'website']
      .every((field) => typeof contact[field] === 'string')
    && (contact.phoneVisible || contact.phone === '')
    && (contact.emailVisible || contact.email === '')
    && (contact.whatsappVisible || contact.whatsappNumber === '')
    && (contact.websiteVisible || contact.website === '')
    && ['holalocal', 'phone', 'email', 'whatsapp'].includes(contact.preferredContactMethod)
}

test('old deployed website payloads are not compatible with final strict website-visibility rules', () => {
  const hiddenWebsite = oldWebsitePublicContact(privateContact)
  assert.equal(oldRulesSafePublicContact(hiddenWebsite), true)
  assert.equal(newRulesSafePublicContact(hiddenWebsite), false)

  const unrelatedEditWithEmptyWebsite = oldWebsitePublicContact({ ...privateContact, website: '' })
  assert.equal(oldRulesSafePublicContact(unrelatedEditWithEmptyWebsite), true)
  assert.equal(newRulesSafePublicContact(unrelatedEditWithEmptyWebsite), false)

  const phoneOnlyOldShape = oldWebsitePublicContact({
    ...privateContact,
    phoneVisible: true,
    website: '',
  })
  assert.equal(oldRulesSafePublicContact(phoneOnlyOldShape), true)
  assert.equal(newRulesSafePublicContact(phoneOnlyOldShape), false)
})

test('new website payloads are not compatible with old deployed rules because websiteVisible is unknown there', () => {
  const hiddenWebsite = newWebsitePublicContact(privateContact)
  assert.equal(newRulesSafePublicContact(hiddenWebsite), true)
  assert.equal(oldRulesSafePublicContact(hiddenWebsite), false)

  const visibleWebsite = newWebsitePublicContact({ ...privateContact, websiteVisible: true })
  assert.equal(newRulesSafePublicContact(visibleWebsite), true)
  assert.equal(oldRulesSafePublicContact(visibleWebsite), false)

  const unrelatedEdit = newWebsitePublicContact({ ...privateContact, website: '' })
  assert.equal(newRulesSafePublicContact(unrelatedEdit), true)
  assert.equal(oldRulesSafePublicContact(unrelatedEdit), false)
})

test('new website payloads satisfy final strict rules and preserve existing channel invariants', () => {
  assert.equal(newRulesSafePublicContact(newWebsitePublicContact({ ...privateContact, websiteVisible: true })), true)
  assert.equal(newRulesSafePublicContact({ ...newWebsitePublicContact(privateContact), website: 'https://example.invalid' }), false)
  assert.equal(newRulesSafePublicContact(newWebsitePublicContact(privateContact)), true)

  for (const [valueField, visibilityField, value] of [
    ['phone', 'phoneVisible', '000000000'],
    ['email', 'emailVisible', 'owner@example.invalid'],
    ['whatsappNumber', 'whatsappVisible', '111111111'],
  ]) {
    const hidden = newWebsitePublicContact({ ...privateContact, [valueField]: value, [visibilityField]: false })
    assert.equal(hidden[valueField], '')
    assert.equal(newRulesSafePublicContact(hidden), true)
    const visible = newWebsitePublicContact({ ...privateContact, [valueField]: value, [visibilityField]: true })
    assert.equal(visible[valueField], value)
    assert.equal(newRulesSafePublicContact(visible), true)
  }
})
