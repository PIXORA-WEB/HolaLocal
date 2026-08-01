export async function completeRegistration({
  createAuthenticationUser,
  createProfile,
  deleteAuthenticationUser,
  email,
  password,
  policyConsent,
  sendVerification,
}) {
  const credential = await createAuthenticationUser(email, password)
  const { user } = credential

  try {
    await createProfile(user, policyConsent)
  } catch (error) {
    await deleteAuthenticationUser(user).catch(() => undefined)
    throw error
  }

  let verificationEmailSent = true
  try {
    await sendVerification(user)
  } catch {
    verificationEmailSent = false
  }

  return { user, verificationEmailSent }
}
