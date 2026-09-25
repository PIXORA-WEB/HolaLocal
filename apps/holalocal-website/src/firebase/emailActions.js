import { applyActionCode, checkActionCode, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth'
import { getFirebaseAuth, reloadAuthenticationUser } from './auth.js'

// Reuses the existing configured project; never initializes Auth from URL parameters.
export const emailActionSDK = {
  currentUser: () => getFirebaseAuth().currentUser,
  check: code => checkActionCode(getFirebaseAuth(), code),
  apply: code => applyActionCode(getFirebaseAuth(), code),
  verifyReset: code => verifyPasswordResetCode(getFirebaseAuth(), code),
  confirm: (code, password) => confirmPasswordReset(getFirebaseAuth(), code, password),
  refresh: user => reloadAuthenticationUser(user),
}
