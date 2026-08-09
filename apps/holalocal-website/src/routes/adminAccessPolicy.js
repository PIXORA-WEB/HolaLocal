export function hasAdminAccessClaim(claims) {
  return claims?.admin === true || claims?.moderator === true
}
