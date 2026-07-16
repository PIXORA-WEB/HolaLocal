// Version of the approved target contract, not a claim about deployed documents.
export const TARGET_FIREBASE_CONTRACT_VERSION = 1
export const FIREBASE_CONTRACT_SCHEMA_VERSION = TARGET_FIREBASE_CONTRACT_VERSION

export const USER_ROLES = Object.freeze(['customer', 'business'])
export const ACCOUNT_STATUSES = Object.freeze(['active', 'suspended', 'deletion_pending', 'deleted'])
export const BUSINESS_STATUSES = Object.freeze([
  'draft', 'pending_review', 'rejected', 'active', 'suspended', 'archived', 'deleted',
])
export const VERIFICATION_STATUSES = Object.freeze(['unverified', 'pending', 'verified', 'rejected'])
export const SUBSCRIPTION_STATUSES = Object.freeze([
  'none', 'trial', 'active', 'past_due', 'cancelled', 'expired',
])
export const CONTACT_METHODS = Object.freeze(['holalocal', 'phone', 'email', 'whatsapp'])
export const SUPPORTED_LANGUAGE_CODES = Object.freeze([
  'en', 'es', 'fr', 'de', 'nl', 'pt', 'pl', 'ro', 'cs', 'sk', 'hu', 'uk', 'it',
  'sv', 'da', 'fi', 'no',
])

export const LOOKUP_STATUSES = Object.freeze([
  'found', 'not_found', 'ambiguous', 'invalid_mapping', 'owner_mismatch',
])
export const LOOKUP_SOURCES = Object.freeze([
  'business_owner_mapping', 'user_business_id', 'owner_uid_document', 'owner_id_query',
])

export const PUBLIC_CONTACT_FIELDS = Object.freeze(['phone', 'email', 'whatsappNumber', 'website'])

export const USER_TRUSTED_FIELDS = Object.freeze([
  'businessId', 'emailVerified', 'accountStatus', 'displayNameNormalized',
  'deletionScheduledFor', 'anonymizedAt', 'createdAt', 'updatedAt',
])

export const BUSINESS_TRUSTED_FIELDS = Object.freeze([
  'ownerId', 'managerIds', 'nameNormalized', 'slug', 'galleryCount', 'status',
  'verificationStatus', 'verifiedAt', 'subscription', 'ratingAverage', 'ratingCount',
  'publishedAt', 'submittedAt', 'deletedAt', 'createdAt', 'updatedAt', 'contact',
])

export const DEFAULT_ARRAY_BOUNDS = Object.freeze({
  roles: 2,
  managerIds: 20,
  languages: 20,
  categoryIds: 30,
  serviceAreas: 50,
  galleryImages: 8,
})
