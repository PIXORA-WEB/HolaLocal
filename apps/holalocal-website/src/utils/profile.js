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
