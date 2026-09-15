const namespaceKeys = {
  messages: [
    'title', 'placeholderDescription', 'eyebrow', 'description', 'conversations',
    'loadingConversations', 'openingConversation', 'businessFallback', 'localBusiness',
    'noMessages', 'unreadConversation', 'unreadCount', 'emptyConversations', 'returnHome',
    'privateMessages', 'selectConversation', 'unavailable', 'unavailableDescription', 'back',
    'activeProfile', 'remove', 'removing', 'removeTitle', 'removeDescription', 'removeSuccess',
    'translationNote', 'translation.processing', 'translation.completed', 'translation.failed',
    'translation.viewOriginal', 'translation.viewTranslation', 'startConversation',
    'messageLabel', 'placeholder', 'sending', 'send', 'preferredLanguageFallback',
    'businessLanguageFallback', 'errors.loadConversations', 'errors.loadMessages',
    'errors.openConversation', 'errors.send', 'errors.remove',
  ],
  reports: [
    'eyebrow', 'title', 'close', 'submitted', 'submittedDescription', 'description',
    'reasonLegend', 'reasons.misleading_profile', 'reasons.unqualified_service',
    'reasons.unsafe_behaviour', 'reasons.poor_conduct', 'reasons.spam_or_fake_business',
    'reasons.other', 'details', 'detailsPlaceholder', 'supportPrefix', 'submitting', 'submit',
  ],
  onboarding: [
    'eyebrow', 'title', 'description', 'legend', 'required', 'options.customer.title',
    'options.customer.description', 'options.business.title', 'options.business.description',
    'options.both.title', 'options.both.description',
  ],
  auth: [
    'errors.emailInUse', 'errors.invalidCredential', 'errors.invalidEmail', 'errors.network',
    'errors.tooManyRequests', 'errors.userDisabled', 'errors.weakPassword', 'errors.profileLoad',
    'errors.sessionRestore', 'errors.generic', 'passwordUx.show', 'passwordUx.hide',
    'recovery.eyebrow', 'recovery.description', 'recovery.sent', 'recovery.action',
  ],
  services: [
    'authPrompt.close', 'authPrompt.messagingEyebrow', 'authPrompt.reportTitle',
    'authPrompt.messageTitle', 'authPrompt.reportDescription', 'authPrompt.messageDescription',
  ],
  business: ['control.submitForReview', 'control.submitSuccess', 'control.submitError'],
}

function setPath(target, path, value) {
  const parts = path.split('.')
  const key = parts.pop()
  const parent = parts.reduce((current, part) => {
    current[part] ??= {}
    return current[part]
  }, target)
  parent[key] = value
}

function namespace(name, values) {
  const keys = namespaceKeys[name]
  if (values.length !== keys.length) {
    throw new Error(`Expected ${keys.length} ${name} translations, received ${values.length}.`)
  }
  const result = {}
  keys.forEach((key, index) => setPath(result, key, values[index]))
  return result
}

function pack({ auth, business, logoAlt, messages, onboarding, reports, services }) {
  return {
    messages: namespace('messages', messages),
    reports: namespace('reports', reports),
    onboarding: { ...namespace('onboarding', onboarding), logoAlt },
    auth: namespace('auth', auth),
    services: namespace('services', services),
    business: namespace('business', business),
  }
}

export function createOperational(values, accessibility, lifecycle, errors, customerDescription, reportConfirmation) {
  const result = pack(values)
  Object.assign(result.messages, accessibility)
  Object.assign(result.messages, lifecycle)
  Object.assign(result.messages.errors, errors)
  result.onboarding.options.customer.description = customerDescription
  result.reports.submittedDescription = reportConfirmation
  return result
}
