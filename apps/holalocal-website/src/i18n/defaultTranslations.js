export const ownerEnglishRejectionTranslations = {
  rejection: {
    reason: {
      incomplete_profile: 'Incomplete profile',
      unclear_service_information: 'Unclear service information',
      location_or_service_area: 'Location or service-area issue',
      contact_information: 'Contact-information issue',
      logo_or_gallery: 'Logo or gallery issue',
      unsupported_or_inappropriate_content: 'Unsupported or inappropriate content',
      other: 'Other',
    },
    owner: {
      eyebrow: 'Review feedback',
      title: 'Your business needs changes',
      category: 'Category',
      nextStep: 'Read the guidance below, update your profile, then submit it for review again.',
      edit: 'Edit business',
    },
  },
}

export const adminEnglishTranslations = {
  admin: {
    navigation: { label: 'Admin navigation', overview: 'Overview', businesses: 'Businesses' },
    access: {
      checking: 'Checking administrator access…', deniedTitle: 'Administrator access required',
      denied: 'Your account is signed in but does not have an administrator or moderator claim.',
      expiredTitle: 'Your session has expired', expired: 'Refresh your session and try again.',
      failedTitle: 'Unable to verify access', failed: 'We could not refresh your administrator permissions.',
    },
    overview: {
      eyebrow: 'Administration', title: 'Overview', description: 'A bounded snapshot of business moderation states.',
      loading: 'Loading business totals…', viewStatus: 'View {{status}} businesses',
    },
    businesses: {
      eyebrow: 'Moderation', title: 'Businesses', statusFilter: 'Status', pageSearch: 'Filter this page by business name',
      loading: 'Loading businesses…', empty: 'There are no businesses in this status.',
      caption: 'Businesses in the selected moderation status', name: 'Business', category: 'Primary category',
      location: 'Primary location', submitted: 'Submission or update date', status: 'Status',
      actions: 'Actions', review: 'Review', reviewNamed: 'Review {{name}}', loadMore: 'Load more',
    },
    review: {
      title: 'Business review', loading: 'Loading business review…', notFoundTitle: 'Business not found',
      notFound: 'This business could not be found.', loadErrorTitle: 'Unable to load business review',
      back: 'Back to moderation queue', eyebrow: 'Business review', alreadyReviewed: 'This business is no longer awaiting review. Actions have been disabled.',
      publicProfile: 'Public profile information', moderation: 'Private moderation information',
      tagline: 'Tagline', description: 'Description', category: 'Primary category', services: 'Services',
      location: 'Primary location', serviceAreas: 'Service areas', languages: 'Languages',
      contact: 'Public contact choices', platformOnly: 'HolaLocal messaging only', published: 'Published',
      logoAlt: '{{name}} logo', galleryAlt: '{{name}} gallery image {{index}}',
      businessId: 'Business ID', ownerUid: 'Owner UID', ownerName: 'Owner name',
      ownerEmail: 'Owner email', ownerLocale: 'Owner locale', submitted: 'Submitted',
      previousGuidance: 'Previous rejection guidance', history: 'Recent moderation history',
      noHistory: 'No moderation events yet.', approve: 'Approve and publish', reject: 'Reject',
      processing: 'Processing…', approved: 'Business approved and published.', rejected: 'Business rejected and guidance saved.',
    },
    approve: { title: 'Approve and publish?', description: 'Publish {{name}} after the backend eligibility check succeeds.' },
    reject: {
      title: 'Reject business', description: 'Give the owner clear, actionable guidance.',
      reason: 'Reason category', selectReason: 'Select a reason', reasonRequired: 'Choose a reason category.',
      guidance: 'Owner-facing guidance', guidanceHelp: 'Enter {{min}}–{{max}} characters. This is shown as plain text.',
      guidanceLength: 'Guidance must contain between {{min}} and {{max}} characters.',
    },
    errors: {
      permission: 'You do not have permission to access this administrator resource.',
      session: 'Your session is no longer valid. Sign in again and retry.',
      load: 'Administrator data could not be loaded. Please retry.',
      decision: 'The moderation decision could not be completed. No confirmed change is shown.',
      ineligible: 'This business does not meet the publication requirements. Its status was not changed.',
      stale: 'Another moderator has already reviewed this business. The latest record has been loaded.',
    },
    status: { pending_review: 'Pending review', active: 'Active', rejected: 'Rejected', suspended: 'Suspended' },
    actions: { publish: 'Approved and published', reject: 'Rejected' },
  },
}
