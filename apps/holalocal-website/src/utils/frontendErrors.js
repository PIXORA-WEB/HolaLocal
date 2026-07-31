const presentations = Object.freeze({
  AUTH_SESSION_EXPIRED: Object.freeze({
    translationKey: 'messages.errors.sessionExpired',
    recovery: 'sign-in',
  }),
  PERMISSION_DENIED: Object.freeze({
    translationKey: 'messages.errors.permissionDenied',
    recovery: 'back',
  }),
  NETWORK_UNAVAILABLE: Object.freeze({
    translationKey: 'messages.errors.networkUnavailable',
    recovery: 'retry',
  }),
  MESSAGE_NOT_FOUND: Object.freeze({
    translationKey: 'messages.errors.notFound',
    recovery: 'back',
  }),
  MESSAGE_INVALID: Object.freeze({
    translationKey: 'messages.errors.invalid',
    recovery: 'edit',
  }),
  MESSAGE_CONFLICT: Object.freeze({
    translationKey: 'messages.errors.conflict',
    recovery: 'refresh',
  }),
  MESSAGE_LOAD_FAILED: Object.freeze({
    translationKey: 'messages.errors.loadMessages',
    recovery: 'retry',
  }),
  MESSAGE_SEND_FAILED: Object.freeze({
    translationKey: 'messages.errors.send',
    recovery: 'retry',
  }),
  CONVERSATION_REMOVE_FAILED: Object.freeze({
    translationKey: 'messages.errors.remove',
    recovery: 'retry',
  }),
  MEDIA_INVALID_TYPE: Object.freeze({
    translationKey: 'media.errors.invalidType',
    recovery: 'choose-file',
  }),
  MEDIA_TOO_LARGE: Object.freeze({
    translationKey: 'media.errors.tooLarge',
    recovery: 'choose-file',
  }),
  MEDIA_UNAUTHENTICATED: Object.freeze({
    translationKey: 'media.errors.sessionExpired',
    recovery: 'sign-in',
  }),
  MEDIA_PERMISSION_DENIED: Object.freeze({
    translationKey: 'media.errors.permissionDenied',
    recovery: 'back',
  }),
  MEDIA_NETWORK_UNAVAILABLE: Object.freeze({
    translationKey: 'media.errors.networkUnavailable',
    recovery: 'retry',
  }),
  MEDIA_OBJECT_NOT_FOUND: Object.freeze({
    translationKey: 'media.errors.objectNotFound',
    recovery: 'refresh',
  }),
  MEDIA_UPLOAD_FAILED: Object.freeze({
    translationKey: 'media.errors.uploadFailed',
    recovery: 'retry',
  }),
  MEDIA_DELETE_FAILED: Object.freeze({
    translationKey: 'media.errors.deleteFailed',
    recovery: 'retry',
  }),
  MEDIA_SAVE_FAILED: Object.freeze({
    translationKey: 'media.errors.saveFailed',
    recovery: 'retry',
  }),
  AUTH_EMAIL_NOT_VERIFIED: Object.freeze({
    translationKey: 'workflow.errors.emailNotVerified',
    recovery: 'verify-email',
  }),
  ACCOUNT_NOT_ACTIVE: Object.freeze({
    translationKey: 'workflow.errors.accountNotActive',
    recovery: 'sign-out',
  }),
  ACCOUNT_PROFILE_INCOMPLETE: Object.freeze({
    translationKey: 'workflow.errors.profileIncomplete',
    recovery: 'complete-profile',
  }),
  ACCOUNT_PROFILE_NOT_FOUND: Object.freeze({
    translationKey: 'workflow.errors.profileNotFound',
    recovery: 'refresh-account',
  }),
  ACCOUNT_TRANSITION_FAILED: Object.freeze({
    translationKey: 'workflow.errors.accountTransitionFailed',
    recovery: 'retry',
  }),
  BUSINESS_ROLE_CONFLICT: Object.freeze({
    translationKey: 'workflow.errors.roleConflict',
    recovery: 'refresh-account',
  }),
  BUSINESS_OWNERSHIP_CONFLICT: Object.freeze({
    translationKey: 'workflow.errors.ownershipConflict',
    recovery: 'contact-support',
  }),
  BUSINESS_CREATE_FAILED: Object.freeze({
    translationKey: 'workflow.errors.businessCreateFailed',
    recovery: 'retry',
  }),
  BUSINESS_SUBMIT_INCOMPLETE: Object.freeze({
    translationKey: 'workflow.errors.submitIncomplete',
    recovery: 'edit-business',
  }),
  BUSINESS_SUBMIT_INVALID_STATE: Object.freeze({
    translationKey: 'workflow.errors.submitInvalidState',
    recovery: 'refresh-business',
  }),
  BUSINESS_SUBMIT_PERMISSION_DENIED: Object.freeze({
    translationKey: 'workflow.errors.submitPermissionDenied',
    recovery: 'refresh-account',
  }),
  BUSINESS_SUBMIT_FAILED: Object.freeze({
    translationKey: 'workflow.errors.submitFailed',
    recovery: 'retry',
  }),
  PROFILE_SAVE_PERMISSION_DENIED: Object.freeze({
    translationKey: 'profile.errors.savePermissionDenied',
    recovery: 'edit-draft',
  }),
  PROFILE_SAVE_NETWORK_UNAVAILABLE: Object.freeze({
    translationKey: 'profile.errors.saveNetworkUnavailable',
    recovery: 'edit-draft',
  }),
  PROFILE_SAVE_FAILED: Object.freeze({
    translationKey: 'profile.errors.saveFailed',
    recovery: 'edit-draft',
  }),
  BUSINESS_SAVE_PERMISSION_DENIED: Object.freeze({
    translationKey: 'business.form.errors.savePermissionDenied',
    recovery: 'edit-draft',
  }),
  BUSINESS_SAVE_NETWORK_UNAVAILABLE: Object.freeze({
    translationKey: 'business.form.errors.saveNetworkUnavailable',
    recovery: 'edit-draft',
  }),
  BUSINESS_SAVE_FAILED: Object.freeze({
    translationKey: 'business.form.errors.saveFailed',
    recovery: 'edit-draft',
  }),
  UNKNOWN_APPLICATION_ERROR: Object.freeze({
    translationKey: 'errors.application.description',
    recovery: 'retry',
  }),
})

const recoveryActionTranslationKeys = Object.freeze({
  back: 'messages.backToInbox',
  'complete-profile': 'profile.completion.title',
  'contact-support': 'workflow.actions.contactSupport',
  'edit-business': 'business.edit',
  'refresh-account': 'workflow.actions.refreshAccount',
  retry: 'common.retry',
  'sign-in': 'account.signIn',
  'sign-out': 'auth.logout',
  'verify-email': 'auth.verification.title',
})

const reasonTypes = new Map([
  ['auth-required', 'AUTH_SESSION_EXPIRED'],
  ['conversation-access-denied', 'PERMISSION_DENIED'],
  ['manager-messaging-not-supported', 'PERMISSION_DENIED'],
  ['conversation-not-found', 'MESSAGE_NOT_FOUND'],
  ['conversation-business-not-found', 'MESSAGE_NOT_FOUND'],
  ['conversation-not-active', 'MESSAGE_NOT_FOUND'],
  ['message-text-required', 'MESSAGE_INVALID'],
  ['message-text-too-long', 'MESSAGE_INVALID'],
  ['invalid-message-request-id', 'MESSAGE_INVALID'],
  ['invalid-conversation-id', 'MESSAGE_INVALID'],
  ['message-request-id-conflict', 'MESSAGE_CONFLICT'],
  ['conversation-business-owner-mismatch', 'MESSAGE_CONFLICT'],
])

const codeTypes = new Map([
  ['unauthenticated', 'AUTH_SESSION_EXPIRED'],
  ['permission-denied', 'PERMISSION_DENIED'],
  ['unavailable', 'NETWORK_UNAVAILABLE'],
  ['network-request-failed', 'NETWORK_UNAVAILABLE'],
  ['not-found', 'MESSAGE_NOT_FOUND'],
  ['invalid-argument', 'MESSAGE_INVALID'],
  ['already-exists', 'MESSAGE_CONFLICT'],
])

const mediaReasonTypes = new Map([
  ['media-invalid-type', 'MEDIA_INVALID_TYPE'],
  ['media-too-large', 'MEDIA_TOO_LARGE'],
  ['media-save-failed', 'MEDIA_SAVE_FAILED'],
  ['auth-required', 'MEDIA_UNAUTHENTICATED'],
])

const mediaCodeTypes = new Map([
  ['invalid-format', 'MEDIA_INVALID_TYPE'],
  ['unauthenticated', 'MEDIA_UNAUTHENTICATED'],
  ['unauthorized', 'MEDIA_PERMISSION_DENIED'],
  ['permission-denied', 'MEDIA_PERMISSION_DENIED'],
  ['retry-limit-exceeded', 'MEDIA_NETWORK_UNAVAILABLE'],
  ['server-file-wrong-size', 'MEDIA_NETWORK_UNAVAILABLE'],
  ['unavailable', 'MEDIA_NETWORK_UNAVAILABLE'],
  ['network-request-failed', 'MEDIA_NETWORK_UNAVAILABLE'],
  ['object-not-found', 'MEDIA_OBJECT_NOT_FOUND'],
])

const workflowReasonTypes = new Map([
  ['auth-required', 'AUTH_SESSION_EXPIRED'],
  ['email-verification-required', 'AUTH_EMAIL_NOT_VERIFIED'],
  ['account-not-active', 'ACCOUNT_NOT_ACTIVE'],
  ['profile-incomplete', 'ACCOUNT_PROFILE_INCOMPLETE'],
  ['profile-not-found', 'ACCOUNT_PROFILE_NOT_FOUND'],
  ['invalid-account-type', 'BUSINESS_ROLE_CONFLICT'],
  ['business-account-active', 'BUSINESS_ROLE_CONFLICT'],
  ['business-role-required', 'BUSINESS_ROLE_CONFLICT'],
  ['uid-mismatch', 'BUSINESS_ROLE_CONFLICT'],
  ['ambiguous-business-ownership', 'BUSINESS_OWNERSHIP_CONFLICT'],
  ['business-pointer-conflict', 'BUSINESS_OWNERSHIP_CONFLICT'],
  ['manager-only-owner-creation-denied', 'BUSINESS_OWNERSHIP_CONFLICT'],
  ['business-id-conflict', 'BUSINESS_OWNERSHIP_CONFLICT'],
  ['business-ambiguous-ownership', 'BUSINESS_OWNERSHIP_CONFLICT'],
  ['business-invalid-ownership', 'BUSINESS_OWNERSHIP_CONFLICT'],
  ['business-create-failed', 'BUSINESS_CREATE_FAILED'],
  ['business-submit-not-found', 'BUSINESS_SUBMIT_INVALID_STATE'],
  ['business-submit-invalid-state', 'BUSINESS_SUBMIT_INVALID_STATE'],
  ['business-submit-incomplete', 'BUSINESS_SUBMIT_INCOMPLETE'],
])

const knownReasons = new Set([
  ...reasonTypes.keys(),
  ...mediaReasonTypes.keys(),
  ...workflowReasonTypes.keys(),
])

function normalizedToken(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function normalizedCode(value) {
  const code = normalizedToken(value)
  const separator = code.indexOf('/')
  return separator === -1 ? code : code.slice(separator + 1)
}

function reasonFrom(error) {
  if (!error || typeof error !== 'object') return ''

  const candidates = [
    error.reason,
    error.details?.reason,
    typeof error.details === 'string' ? error.details : '',
    error.message,
  ]

  return candidates
    .map(normalizedToken)
    .find((candidate) => knownReasons.has(candidate)) ?? ''
}

function presentation(type, translationKey) {
  const selected = presentations[type] ?? presentations.UNKNOWN_APPLICATION_ERROR
  return Object.freeze({
    type: presentations[type] ? type : 'UNKNOWN_APPLICATION_ERROR',
    translationKey: translationKey ?? selected.translationKey,
    recovery: selected.recovery,
  })
}

export function createApplicationError(reason) {
  const error = new Error('Application operation failed.')
  error.reason = normalizedToken(reason)
  return error
}

export function getRecoveryActionTranslationKey(recovery) {
  return recoveryActionTranslationKeys[recovery] ?? null
}

export function classifyFrontendError(error, options = {}) {
  const fallbackType = presentations[options.fallbackType]
    ? options.fallbackType
    : 'UNKNOWN_APPLICATION_ERROR'
  const reason = reasonFrom(error)
  if (options.operation === 'load-inbox') {
    const code = normalizedCode(error?.code)
    if (code === 'unauthenticated') return presentation('AUTH_SESSION_EXPIRED')
    if (code === 'unavailable' || code === 'network-request-failed') {
      return presentation('NETWORK_UNAVAILABLE')
    }
    return presentation(fallbackType, options.fallbackTranslationKey)
  }
  if (options.domain === 'profile-save' || options.domain === 'business-save') {
    const context = options.domain === 'profile-save' ? 'PROFILE' : 'BUSINESS'
    const code = normalizedCode(error?.code)
    if (code === 'unauthenticated') return presentation('AUTH_SESSION_EXPIRED')
    if (code === 'permission-denied') {
      return presentation(`${context}_SAVE_PERMISSION_DENIED`)
    }
    if (code === 'unavailable' || code === 'network-request-failed') {
      return presentation(`${context}_SAVE_NETWORK_UNAVAILABLE`)
    }
    return presentation(`${context}_SAVE_FAILED`)
  }
  if (options.domain === 'media') {
    const mediaReasonType = mediaReasonTypes.get(reason)
    if (mediaReasonType) return presentation(mediaReasonType)

    const mediaCodeType = mediaCodeTypes.get(normalizedCode(error?.code))
    if (mediaCodeType) return presentation(mediaCodeType)

    return presentation(fallbackType, options.fallbackTranslationKey)
  }
  if (options.domain === 'workflow') {
    const workflowReasonType = workflowReasonTypes.get(reason)
    if (workflowReasonType) return presentation(workflowReasonType)

    const code = normalizedCode(error?.code)
    if (code === 'unauthenticated') return presentation('AUTH_SESSION_EXPIRED')
    if (code === 'permission-denied') {
      return options.operation === 'submit-business'
        ? presentation('BUSINESS_SUBMIT_PERMISSION_DENIED')
        : presentation('BUSINESS_ROLE_CONFLICT')
    }
    if (code === 'unavailable' || code === 'network-request-failed') {
      return presentation('NETWORK_UNAVAILABLE', 'workflow.errors.networkUnavailable')
    }
    if (code === 'ambiguous-ownership' || code === 'invalid-ownership') {
      return presentation('BUSINESS_OWNERSHIP_CONFLICT')
    }

    return presentation(fallbackType, options.fallbackTranslationKey)
  }

  const reasonType = reasonTypes.get(reason)
  if (reasonType) return presentation(reasonType)

  const codeType = codeTypes.get(normalizedCode(error?.code))
  if (codeType) return presentation(codeType)

  return presentation(fallbackType, options.fallbackTranslationKey)
}
