import { spokenLanguageOptions } from './languages.js'

export const languageOptions = spokenLanguageOptions

export function getRolesForAccountType(accountType) {
  const roles = {
    customer: ['customer'],
    business: ['business'],
    both: ['customer', 'business'],
  }

  return roles[accountType] ?? null
}

export function getDisplayName(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

export function getAccountDisplayName(userProfile, firebaseUser, fallback = 'Account') {
  return (
    userProfile?.displayName?.trim() ||
    firebaseUser?.displayName?.trim() ||
    firebaseUser?.email?.split('@')[0] ||
    fallback
  )
}

export function getUserInitials(displayName) {
  return String(displayName)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
