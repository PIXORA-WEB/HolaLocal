import { adaptUserDocument } from '@holalocal/firebase-contract'

function accountTypeForRoles(roles) {
  if (roles.includes('customer') && roles.includes('business')) return 'both'
  return roles.includes('business') ? 'business' : 'customer'
}

export function toMobileUserProfile(documentId, rawDocument) {
  const adapted = adaptUserDocument(documentId, rawDocument)
  const { profile } = adapted
  const raw = rawDocument && typeof rawDocument === 'object' && !Array.isArray(rawDocument)
    ? rawDocument : {}

  return {
    uid: profile.uid,
    documentId,
    email: profile.email,
    displayName: profile.displayName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    photoURL: profile.photoURL,
    profilePhoto: profile.profilePhoto,
    preferredLocale: profile.preferredLocale,
    accountType: accountTypeForRoles(profile.roles),
    roles: [...profile.roles],
    city: typeof raw.city === 'string' ? raw.city : '',
    country: typeof raw.country === 'string' ? raw.country : '',
    accountStatus: profile.accountStatus,
    profileCompleted: profile.completion.profileCompleted,
    onboardingCompleted: profile.completion.onboardingCompleted,
    businessProfileRequired: profile.completion.businessProfileRequired,
    businessProfileCompleted: profile.completion.businessProfileCompleted,
    businessId: profile.businessId,
    termsAccepted: profile.consent.termsAccepted,
    termsAcceptedAt: profile.consent.termsAcceptedAt,
    termsVersion: profile.consent.termsVersion,
    privacyAccepted: profile.consent.privacyAccepted,
    privacyAcceptedAt: profile.consent.privacyAcceptedAt,
    privacyVersion: profile.consent.privacyVersion,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    lastActiveAt: raw.lastActiveAt ?? null,
    compatibility: Object.freeze({
      issues: Object.freeze(adapted.issues.map(({ code }) => code)),
      writeSafe: false,
    }),
  }
}
