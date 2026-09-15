const keys = {
  marketing: [
    'hero.eyebrow', 'hero.title', 'hero.description', 'hero.primaryAction', 'hero.secondaryAction',
    'hero.businessesLabel', 'hero.verifiedProfile', 'hero.locationLabel', 'hero.languagesLabel',
    'hero.ratingCount_one', 'hero.ratingCount_other', 'trustStrip.label', 'trustStrip.local',
    'trustStrip.multilingual', 'trustStrip.private', 'trustStrip.marketplace', 'how.eyebrow',
    'how.title', 'how.description', 'how.browse.title', 'how.browse.description',
    'how.review.title', 'how.review.description', 'how.connect.title', 'how.connect.description',
    'journeys.eyebrow', 'journeys.title', 'journeys.customers.title',
    'journeys.customers.description', 'journeys.customers.action', 'journeys.businesses.title',
    'journeys.businesses.description', 'journeys.businesses.action', 'region.eyebrow',
    'region.title', 'region.description', 'trust.eyebrow', 'trust.title', 'trust.description',
    'trust.identities.title', 'trust.identities.description', 'trust.messaging.title',
    'trust.messaging.description', 'trust.multilingual.title', 'trust.multilingual.description',
    'language.eyebrow', 'language.title', 'language.description', 'cta.eyebrow', 'cta.title',
    'cta.description', 'cta.action',
  ],
  services: [
    'eyebrow', 'title', 'description', 'filtersLabel', 'searchLabel', 'searchPlaceholder',
    'locationLabel', 'locationPlaceholder', 'categoryLabel', 'allCategories', 'languageLabel',
    'allLanguages', 'popularCategories', 'popularDescription', 'categories.cleaning',
    'categories.plumbing', 'categories.gardening', 'categories.handyman',
    'categories.airConditioning', 'categories.petServices', 'results', 'resultCount_one',
    'resultCount_other', 'clearFilters', 'notSpecified', 'noMatchesTitle',
    'noMatchesDescription', 'loadError', 'verified',
  ],
  auth: [
    'login', 'register', 'forgotPassword', 'welcomeBack', 'loginTitle', 'loginDescription',
    'email', 'password', 'loggingIn', 'newUser', 'createAccount', 'registration.eyebrow',
    'registration.title', 'registration.description', 'registration.passwordHint',
    'registration.confirmPassword', 'registration.passwordMismatch',
    'registration.consentLegend', 'registration.termsPrefix', 'registration.privacyPrefix',
    'registration.consentRequired', 'registration.existingAccount', 'verification.eyebrow',
    'verification.title', 'verification.description', 'verification.sent',
    'verification.initialSendFailed', 'verification.notVerified', 'verification.resent',
    'verification.checkedAction', 'verification.resend', 'verification.resending',
    'registration.ageConfirmation', 'registration.ageRequired',
  ],
  profile: [
    'businessTools', 'businessProfileStatus', 'becomeBusiness', 'startBusiness',
    'completion.title',
  ],
  business: [
    'dashboard', 'save', 'compatibility.ownershipConflict', 'control.loading',
    'control.yourBusiness', 'control.heroContext', 'control.heroContextAreas_one',
    'control.heroContextAreas_other', 'control.heroPrompt', 'control.verification.unverified',
    'control.verification.pending', 'control.verification.verified',
    'control.verification.rejected', 'control.planBadge', 'control.ready',
    'control.needsWork', 'control.completionEyebrow', 'control.missingCount_one',
    'control.missingCount_other', 'control.checklist.name', 'control.checklist.description',
    'control.checklist.category', 'control.checklist.serviceArea',
    'control.checklist.language', 'control.checklist.logo', 'control.checklist.images',
    'control.checklist.contact', 'control.nextEyebrow', 'control.nextTitle',
    'control.coreReady', 'control.nextPrompt', 'control.visibilityEyebrow',
    'control.visibility.draft', 'control.visibility.pending_review',
    'control.visibility.rejected', 'control.visibility.active',
    'control.visibility.suspended', 'control.visibility.archived',
    'control.visibility.deleted', 'control.visibilitySteps.saved',
    'control.visibilitySteps.private', 'control.visibilitySteps.visibleToYou',
    'control.visibilitySteps.notPublic', 'control.visibilitySteps.comingLater',
    'control.coverageEyebrow', 'control.coverageTitle', 'control.primaryArea',
    'control.serviceAreas_one', 'control.serviceAreas_other', 'control.primaryLanguage',
    'control.spokenLanguages', 'control.notSet', 'control.addAreas',
    'control.addLanguages', 'control.accountEyebrow', 'control.accountTitle',
    'control.verificationLabel', 'control.subscriptionLabel', 'control.quickEyebrow',
    'control.quickTitle', 'control.quickDescription', 'control.contactSettings',
    'control.preview', 'control.insightsEyebrow', 'control.insightsTitle',
    'control.insightsDescription', 'control.comingSoon', 'control.insights.views',
    'control.insights.messages', 'control.insights.saved', 'control.insights.reviews',
    'control.insights.contactClicks', 'form.unsavedDialogTitle', 'form.keepEditing',
    'form.leave', 'form.unsavedTitle', 'form.media.logoTitle', 'form.media.deleting',
    'form.identity.tagline', 'form.contact.showPhone', 'form.contact.showWhatsapp',
    'form.contact.emailLabel', 'form.contact.showEmail', 'form.contact.showWebsite',
    'form.errors.galleryRemaining_one', 'form.errors.galleryRemaining_other',
  ],
  common: ['loading', 'continue', 'skipToContent', 'done', 'optional'],
  application: ['title', 'description', 'reload', 'home'],
  subscription: ['eyebrow', 'emptyTitle'],
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
  if (values.length !== keys[name].length) {
    throw new Error(`Expected ${keys[name].length} ${name} translations, received ${values.length}.`)
  }
  const result = {}
  keys[name].forEach((key, index) => setPath(result, key, values[index]))
  return result
}

function pack({ application, auth, business, common, marketing, plural = {}, profile, services, subscription }) {
  const result = {
    marketing: namespace('marketing', marketing),
    services: namespace('services', services),
    auth: namespace('auth', auth),
    profile: namespace('profile', profile),
    business: namespace('business', business),
    common: namespace('common', common),
    errors: { application: namespace('application', application) },
    subscription: namespace('subscription', subscription),
  }
  Object.entries(plural).forEach(([path, value]) => setPath(result, path, value))
  return result
}

export function createCompletionPack(values, residual, footer) {
  const result = pack(values)
  Object.entries(residual).forEach(([path, value]) => setPath(result, path, value))
  setPath(result, 'footer.description', footer)
  return result
}
