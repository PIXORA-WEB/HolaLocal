export const englishAuthenticatedResidual = Object.freeze({
  account: {
    profileUnavailable: {
      description: 'This may be a temporary problem. Retry now, or sign out and try again later.',
    },
  },
  workflow: {
    actions: {
      refreshAccount: 'Refresh account',
      contactSupport: 'Contact support',
    },
  },
  profile: {
    errors: {
      savePermissionDenied: 'Your profile changes were not saved because account access is unavailable.',
      saveNetworkUnavailable: 'Your profile changes were not saved because of a temporary connection problem.',
      saveFailed: 'Your profile changes were not saved. Your entries are still available.',
    },
  },
  business: {
    form: {
      location: {
        selectedContext: '{{region}} · {{country}}',
      },
      errors: {
        savePermissionDenied: 'Your business changes were not saved because account access is unavailable.',
        saveNetworkUnavailable: 'Your business changes were not saved because of a temporary connection problem.',
        saveFailed: 'Your business changes were not saved. Your entries are still available.',
      },
    },
  },
  common: {
    change: 'Edit profile',
    changeImage: 'Change image',
    loadingAccount: 'Loading…',
  },
  language: {
    saveError: 'We could not complete that request. Please try again.',
  },
})
