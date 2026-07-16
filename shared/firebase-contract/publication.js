import { detectUnsafePublicContact } from './contact.js'
import { validatePrimaryLanguage } from './validators.js'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function stringList(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim())
    : []
}

function hasTimestampLikeValue(value) {
  return Boolean(value)
}

export function hasCompletePublicBusinessProfile(business = {}) {
  const categoryIds = stringList(business.categoryIds)
  const serviceAreas = stringList(business.serviceAreas)
  const languages = stringList(business.languages)
  const location = business.location && typeof business.location === 'object'
    ? business.location
    : {}

  return Boolean(
    text(business.ownerId)
    && Array.isArray(business.managerIds)
    && business.managerIds.includes(business.ownerId)
    && text(business.name)
    && text(business.description)
    && text(business.primaryCategoryId)
    && categoryIds.length > 0
    && serviceAreas.length > 0
    && languages.length > 0
    && validatePrimaryLanguage(business.primaryLanguage, languages).valid
    && text(location.locality)
    && text(location.region)
    && text(location.countryCode)
  )
}

export function isPublicBusinessEligible(business = {}) {
  return Boolean(
    business?.status === 'active'
    && hasTimestampLikeValue(business.publishedAt)
    && business.deletedAt == null
    && business.deletionRequestedAt == null
    && detectUnsafePublicContact(business).safe
    && hasCompletePublicBusinessProfile(business)
  )
}
