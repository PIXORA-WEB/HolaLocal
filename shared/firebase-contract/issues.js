export const ISSUE_CODES = /* @__PURE__ */ Object.freeze({
  USER_LEGACY_LANGUAGE: 'USER_LEGACY_LANGUAGE',
  USER_CONFLICTING_LANGUAGE: 'USER_CONFLICTING_LANGUAGE',
  USER_CONFLICTING_ROLES: 'USER_CONFLICTING_ROLES',
  USER_AMBIGUOUS_VERIFICATION: 'USER_AMBIGUOUS_VERIFICATION',
  USER_AMBIGUOUS_DELETION: 'USER_AMBIGUOUS_DELETION',
  USER_LEGACY_PREMIUM_NOT_PROMOTED: 'USER_LEGACY_PREMIUM_NOT_PROMOTED',
  BUSINESS_LEGACY_ID_STRATEGY: 'BUSINESS_LEGACY_ID_STRATEGY',
  BUSINESS_LEGACY_NAME: 'BUSINESS_LEGACY_NAME',
  BUSINESS_CONFLICTING_NAME: 'BUSINESS_CONFLICTING_NAME',
  BUSINESS_CONFLICTING_CATEGORY: 'BUSINESS_CONFLICTING_CATEGORY',
  BUSINESS_CONFLICTING_LOCATION: 'BUSINESS_CONFLICTING_LOCATION',
  BUSINESS_CONFLICTING_CONTACT: 'BUSINESS_CONFLICTING_CONTACT',
  BUSINESS_LEGACY_CATEGORY: 'BUSINESS_LEGACY_CATEGORY',
  BUSINESS_TRUST_STATUS_NOT_PROMOTED: 'BUSINESS_TRUST_STATUS_NOT_PROMOTED',
  BUSINESS_CONTACT_REQUIRES_PRIVATE_MIGRATION: 'BUSINESS_CONTACT_REQUIRES_PRIVATE_MIGRATION',
  BUSINESS_PUBLIC_CONTACT_UNSAFE: 'BUSINESS_PUBLIC_CONTACT_UNSAFE',
  BUSINESS_LEGACY_MEDIA: 'BUSINESS_LEGACY_MEDIA',
  SUBSCRIPTION_MISSING: 'SUBSCRIPTION_MISSING',
  SUBSCRIPTION_INVALID_STRUCTURE: 'SUBSCRIPTION_INVALID_STRUCTURE',
  SUBSCRIPTION_LEGACY_TIER: 'SUBSCRIPTION_LEGACY_TIER',
  SUBSCRIPTION_UNSUPPORTED_SCHEMA_VERSION: 'SUBSCRIPTION_UNSUPPORTED_SCHEMA_VERSION',
  SUBSCRIPTION_UNKNOWN_PLAN: 'SUBSCRIPTION_UNKNOWN_PLAN',
  SUBSCRIPTION_UNKNOWN_PLAN_REVISION: 'SUBSCRIPTION_UNKNOWN_PLAN_REVISION',
  SUBSCRIPTION_INVALID_ACCESS_STATUS: 'SUBSCRIPTION_INVALID_ACCESS_STATUS',
  SUBSCRIPTION_INVALID_ASSIGNMENT_SOURCE: 'SUBSCRIPTION_INVALID_ASSIGNMENT_SOURCE',
  LANGUAGE_UNKNOWN_CUSTOM: 'LANGUAGE_UNKNOWN_CUSTOM',
  LANGUAGE_DUPLICATE_REMOVED: 'LANGUAGE_DUPLICATE_REMOVED',
  LANGUAGE_PRIMARY_REPAIRED: 'LANGUAGE_PRIMARY_REPAIRED',
  LANGUAGE_INVALID_VALUE: 'LANGUAGE_INVALID_VALUE',
  SERVICE_AREA_UNKNOWN_CUSTOM: 'SERVICE_AREA_UNKNOWN_CUSTOM',
  SERVICE_AREA_DUPLICATE_REMOVED: 'SERVICE_AREA_DUPLICATE_REMOVED',
  SERVICE_AREA_INVALID_VALUE: 'SERVICE_AREA_INVALID_VALUE',
  CONTACT_INVALID_PREFERRED_METHOD: 'CONTACT_INVALID_PREFERRED_METHOD',
  CONTACT_PREFERRED_METHOD_NOT_PUBLIC: 'CONTACT_PREFERRED_METHOD_NOT_PUBLIC',
  CONTACT_UNKNOWN_STRUCTURE: 'CONTACT_UNKNOWN_STRUCTURE',
  CONTACT_HIDDEN_VALUE_PRESENT: 'CONTACT_HIDDEN_VALUE_PRESENT',
  CONTACT_TOP_LEVEL_PRIVATE_FIELD: 'CONTACT_TOP_LEVEL_PRIVATE_FIELD',
  LOOKUP_MULTIPLE_CANDIDATES: 'LOOKUP_MULTIPLE_CANDIDATES',
  LOOKUP_INVALID_MAPPING: 'LOOKUP_INVALID_MAPPING',
  LOOKUP_MAPPING_OWNER_MISMATCH: 'LOOKUP_MAPPING_OWNER_MISMATCH',
  COMPATIBILITY_MISSING_REQUIRED_FIELD: 'COMPATIBILITY_MISSING_REQUIRED_FIELD',
  VALIDATION_INVALID_TYPE: 'VALIDATION_INVALID_TYPE',
  VALIDATION_INVALID_VALUE: 'VALIDATION_INVALID_VALUE',
  VALIDATION_ARRAY_TOO_LARGE: 'VALIDATION_ARRAY_TOO_LARGE',
  VALIDATION_ARRAY_DUPLICATE: 'VALIDATION_ARRAY_DUPLICATE',
  VALIDATION_PRIMARY_NOT_IN_LANGUAGES: 'VALIDATION_PRIMARY_NOT_IN_LANGUAGES',
  VALIDATION_OWNER_NOT_MANAGER: 'VALIDATION_OWNER_NOT_MANAGER',
  VALIDATION_TRUSTED_FIELD_IN_OWNER_PAYLOAD: 'VALIDATION_TRUSTED_FIELD_IN_OWNER_PAYLOAD',
})

const KNOWN_ISSUE_CODES = new Set(Object.values(ISSUE_CODES))

export const ISSUE_CODE_DESCRIPTIONS = /* @__PURE__ */ Object.freeze({
  [ISSUE_CODES.USER_LEGACY_LANGUAGE]: 'A legacy user language field was used.',
  [ISSUE_CODES.USER_CONFLICTING_LANGUAGE]: 'preferredLocale and preferredLanguage resolve to different values.',
  [ISSUE_CODES.USER_CONFLICTING_ROLES]: 'roles and accountType describe different role sets.',
  [ISSUE_CODES.USER_AMBIGUOUS_VERIFICATION]: 'Legacy isVerified was present and was not promoted.',
  [ISSUE_CODES.USER_AMBIGUOUS_DELETION]: 'Legacy deletedAt semantics are ambiguous and were not promoted.',
  [ISSUE_CODES.USER_LEGACY_PREMIUM_NOT_PROMOTED]: 'Legacy isPremium was not promoted to subscription state.',
  [ISSUE_CODES.BUSINESS_LEGACY_ID_STRATEGY]: 'The business document ID equals its owner UID.',
  [ISSUE_CODES.BUSINESS_LEGACY_NAME]: 'Legacy businessName supplied the compatibility name.',
  [ISSUE_CODES.BUSINESS_CONFLICTING_NAME]: 'Canonical and legacy business names conflict.',
  [ISSUE_CODES.BUSINESS_CONFLICTING_CATEGORY]: 'Canonical and legacy category values conflict.',
  [ISSUE_CODES.BUSINESS_CONFLICTING_LOCATION]: 'Canonical and legacy location values conflict.',
  [ISSUE_CODES.BUSINESS_CONFLICTING_CONTACT]: 'Canonical and legacy contact values conflict.',
  [ISSUE_CODES.BUSINESS_LEGACY_CATEGORY]: 'Legacy category fields supplied compatibility values.',
  [ISSUE_CODES.BUSINESS_TRUST_STATUS_NOT_PROMOTED]: 'A legacy trust-like field was intentionally not promoted.',
  [ISSUE_CODES.BUSINESS_CONTACT_REQUIRES_PRIVATE_MIGRATION]: 'Legacy contact data requires private-contact migration.',
  [ISSUE_CODES.BUSINESS_PUBLIC_CONTACT_UNSAFE]: 'A public business contact shape can expose hidden data.',
  [ISSUE_CODES.BUSINESS_LEGACY_MEDIA]: 'Legacy media URLs supplied compatibility media.',
  [ISSUE_CODES.SUBSCRIPTION_MISSING]: 'The canonical subscription map is missing.',
  [ISSUE_CODES.SUBSCRIPTION_INVALID_STRUCTURE]: 'The subscription value is not a supported map.',
  [ISSUE_CODES.SUBSCRIPTION_LEGACY_TIER]: 'A legacy nested subscription tier was mapped for compatibility.',
  [ISSUE_CODES.SUBSCRIPTION_UNSUPPORTED_SCHEMA_VERSION]: 'The subscription schema version is unsupported.',
  [ISSUE_CODES.SUBSCRIPTION_UNKNOWN_PLAN]: 'The subscription references an unknown plan identifier.',
  [ISSUE_CODES.SUBSCRIPTION_UNKNOWN_PLAN_REVISION]: 'The subscription references an unsupported plan revision.',
  [ISSUE_CODES.SUBSCRIPTION_INVALID_ACCESS_STATUS]: 'The subscription access status is unsupported.',
  [ISSUE_CODES.SUBSCRIPTION_INVALID_ASSIGNMENT_SOURCE]: 'The subscription assignment source is unsupported.',
  [ISSUE_CODES.LANGUAGE_UNKNOWN_CUSTOM]: 'An unknown language was preserved as a deterministic custom value.',
  [ISSUE_CODES.LANGUAGE_DUPLICATE_REMOVED]: 'A duplicate language identifier was removed.',
  [ISSUE_CODES.LANGUAGE_PRIMARY_REPAIRED]: 'primaryLanguage was repaired to the first preserved language.',
  [ISSUE_CODES.LANGUAGE_INVALID_VALUE]: 'A language value had an unsupported type or was empty.',
  [ISSUE_CODES.SERVICE_AREA_UNKNOWN_CUSTOM]: 'An unknown area was preserved as a deterministic custom value.',
  [ISSUE_CODES.SERVICE_AREA_DUPLICATE_REMOVED]: 'A duplicate service-area identifier was removed.',
  [ISSUE_CODES.SERVICE_AREA_INVALID_VALUE]: 'A service-area value had an unsupported type or was empty.',
  [ISSUE_CODES.CONTACT_INVALID_PREFERRED_METHOD]: 'The preferred contact method is unsupported.',
  [ISSUE_CODES.CONTACT_PREFERRED_METHOD_NOT_PUBLIC]: 'The preferred external method is not publicly enabled.',
  [ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE]: 'The contact map contains an unknown or invalid structure.',
  [ISSUE_CODES.CONTACT_HIDDEN_VALUE_PRESENT]: 'A hidden nested contact value is present in a public document.',
  [ISSUE_CODES.CONTACT_TOP_LEVEL_PRIVATE_FIELD]: 'A legacy top-level private contact field is public.',
  [ISSUE_CODES.LOOKUP_MULTIPLE_CANDIDATES]: 'More than one business candidate remains.',
  [ISSUE_CODES.LOOKUP_INVALID_MAPPING]: 'The owner mapping is missing required valid identifiers.',
  [ISSUE_CODES.LOOKUP_MAPPING_OWNER_MISMATCH]: 'A mapped business is owned by another user.',
  [ISSUE_CODES.COMPATIBILITY_MISSING_REQUIRED_FIELD]: 'A required target field is missing from the compatibility source.',
  [ISSUE_CODES.VALIDATION_INVALID_TYPE]: 'A field has an invalid type.',
  [ISSUE_CODES.VALIDATION_INVALID_VALUE]: 'A field has an unsupported value.',
  [ISSUE_CODES.VALIDATION_ARRAY_TOO_LARGE]: 'A bounded array exceeds its limit.',
  [ISSUE_CODES.VALIDATION_ARRAY_DUPLICATE]: 'An array contains duplicate values.',
  [ISSUE_CODES.VALIDATION_PRIMARY_NOT_IN_LANGUAGES]: 'primaryLanguage is not a member of languages.',
  [ISSUE_CODES.VALIDATION_OWNER_NOT_MANAGER]: 'managerIds does not contain ownerId.',
  [ISSUE_CODES.VALIDATION_TRUSTED_FIELD_IN_OWNER_PAYLOAD]: 'An owner payload contains a trusted-only field.',
})

const REPAIR_CODES = new Set([ISSUE_CODES.LANGUAGE_PRIMARY_REPAIRED])
const PRIVACY_CODES = new Set([
  ISSUE_CODES.BUSINESS_CONTACT_REQUIRES_PRIVATE_MIGRATION,
  ISSUE_CODES.BUSINESS_PUBLIC_CONTACT_UNSAFE,
  ISSUE_CODES.CONTACT_HIDDEN_VALUE_PRESENT,
  ISSUE_CODES.CONTACT_TOP_LEVEL_PRIVATE_FIELD,
  ISSUE_CODES.CONTACT_UNKNOWN_STRUCTURE,
])
const TRUST_CODES = new Set([
  ISSUE_CODES.USER_AMBIGUOUS_VERIFICATION,
  ISSUE_CODES.USER_AMBIGUOUS_DELETION,
  ISSUE_CODES.USER_LEGACY_PREMIUM_NOT_PROMOTED,
  ISSUE_CODES.BUSINESS_TRUST_STATUS_NOT_PROMOTED,
  ISSUE_CODES.VALIDATION_TRUSTED_FIELD_IN_OWNER_PAYLOAD,
])

export const ISSUE_CODE_METADATA = /* @__PURE__ */ Object.freeze(Object.fromEntries(
  Object.values(ISSUE_CODES).map((code) => [code, Object.freeze({
    description: ISSUE_CODE_DESCRIPTIONS[code],
    category: REPAIR_CODES.has(code) ? 'repair'
      : PRIVACY_CODES.has(code) ? 'privacy'
        : TRUST_CODES.has(code) ? 'trust'
          : code.startsWith('VALIDATION_') ? 'validation'
            : code.startsWith('LOOKUP_') ? 'lookup'
              : code.startsWith('LANGUAGE_') ? 'language'
                : code.startsWith('SERVICE_AREA_') ? 'service_area'
                  : code.startsWith('CONTACT_') ? 'contact'
                    : code.startsWith('SUBSCRIPTION_') ? 'subscription'
                      : code.startsWith('USER_') ? 'user_compatibility'
                      : code.startsWith('BUSINESS_') ? 'business_compatibility'
                        : 'compatibility',
    severity: PRIVACY_CODES.has(code) || code.startsWith('VALIDATION_') ||
      code.startsWith('LOOKUP_') || code === ISSUE_CODES.COMPATIBILITY_MISSING_REQUIRED_FIELD
      ? 'error' : 'warning',
  })]),
))

export function issue(code, details = {}) {
  if (!KNOWN_ISSUE_CODES.has(code)) throw new TypeError(`Undefined contract issue code: ${code}`)
  return { code, ...details }
}
