import { deletionDisclosureEnglishTranslations } from './deletionDisclosureEnglishTranslations.js'

export const accountDeletionEnglishTranslations = {
  accountDeletion: {
    request: {
      eyebrow: 'Account deletion',
      title: 'Delete your account',
      description: 'Request administrator-assisted account deletion.',
      open: 'Request account deletion',
      dialogTitle: 'Request account deletion',
      warning: 'Your normal account access will be restricted while the request is pending. Nothing is deleted by this request.',
      retainedRecords: deletionDisclosureEnglishTranslations.request,
      password: 'Current password',
      confirm: 'I understand that my account access will be restricted pending review.',
      confirmationRequired: 'Enter your password and confirm before continuing.',
      submit: 'Submit deletion request',
      submitting: 'Submitting…',
      ownedBusinessBlock: 'Resolve your {{count}} owned business profile(s) before requesting account deletion.',
    },
    status: {
      title: 'Account deletion requested',
      description: 'Your request has been received and normal account access is restricted pending administrator processing.',
      noDeletionYet: 'No account data has necessarily been deleted yet.',
      cancel: 'Cancel deletion request',
      cancelling: 'Cancelling…',
    },
    errors: {
      recentAuth: 'Sign in again with your password and retry.',
      ownershipConflict: 'Your business ownership records need administrator review before deletion can be requested.',
      request: 'The deletion request could not be submitted. No account data was deleted.',
      cancel: 'The deletion request could not be cancelled.',
      load: 'The request status could not be loaded.',
      logout: 'You could not be signed out.',
    },
  },
}
