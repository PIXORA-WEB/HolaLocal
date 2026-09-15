const keys = [
  'backToResults',
  'categoryNotSpecified',
  'serviceAreaNotSpecified',
  'activeProfile',
  'verificationComingSoon',
  'subscriptionPlan',
  'reviewCount_one',
  'reviewCount_other',
  'noReviews',
  'sectionsLabel',
  'overview',
  'services',
  'photos',
  'reviews',
  'about',
  'openingConversation',
  'messageBusiness',
  'reportBusiness',
  'aboutBusiness',
  'noDescription',
  'serviceArea',
  'languages',
  'notSpecified',
  'servicesOffered',
  'noServices',
  'workGallery',
  'workImageAlt',
  'noPhotos',
  'customerFeedback',
  'reviewsUnavailable',
  'noReceivedReviews',
  'contactInformation',
  'phone',
  'email',
  'website',
  'openWhatsApp',
  'callback',
  'callbackAvailable',
  'noContact',
  'messageError',
  'reportError',
  'unavailableTitle',
  'unavailableDescription',
]

export function translation(values) {
  if (values.length !== keys.length) {
    throw new Error(`Expected ${keys.length} public business-detail translations, received ${values.length}.`)
  }
  return Object.fromEntries(keys.map((key, index) => [key, values[index]]))
}

