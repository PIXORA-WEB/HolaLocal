import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loginUser,
  logoutUser,
  observeAuthentication,
  reloadAuthenticationUser,
  registerUser,
  resendEmailVerification,
  sendPasswordReset,
} from '../firebase/auth.js'
import { getFirebaseApp } from '../firebase/config.js'
import AuthenticationContext from './AuthenticationContext.js'

const loadUserService = () => import('../services/userService.js')

function AuthenticationProvider({ children }) {
  // Validate and initialize inside the error boundary's render tree. This keeps
  // configuration failures from becoming a pre-React white screen.
  getFirebaseApp()

  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)

  const refreshUserProfile = useCallback(async (firebaseUser = user, options = {}) => {
    const background = options.background === true
    if (!firebaseUser) {
      setUserProfile(null)
      return null
    }

    if (!background) setProfileLoading(true)

    try {
      const { getUserProfile } = await loadUserService()
      const profile = await getUserProfile(firebaseUser.uid)
      setUserProfile(profile)
      return profile
    } finally {
      if (!background) setProfileLoading(false)
    }
  }, [user])

  useEffect(() => {
    let active = true

    const unsubscribe = observeAuthentication(
      async (user) => {
        if (!active) return

        setLoading(true)
        setProfileLoading(true)
        setUser(user)
        setEmailVerified(user?.emailVerified === true)
        setSessionError('')

        try {
          if (user) {
            const { ensureUserProfile, getUserProfile, updateLastActive } = await loadUserService()
            const existingProfile = await getUserProfile(user.uid)
            const profile = user.emailVerified && existingProfile?.accountStatus === 'active'
              ? await ensureUserProfile(user)
              : existingProfile
            if (profile?.accountStatus === 'active' && profile.deletionRequestedAt == null) {
              await updateLastActive(user.uid)
            }
            if (active) setUserProfile(profile)
          } else {
            setUserProfile(null)
          }
        } catch {
          if (active) {
            setUserProfile(null)
            setSessionError('auth.errors.profileLoad')
          }
        } finally {
          if (active) {
            setLoading(false)
            setProfileLoading(false)
          }
        }
      },
      () => {
        if (active) {
          setSessionError('auth.errors.sessionRestore')
          setLoading(false)
          setProfileLoading(false)
        }
      },
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const signUp = useCallback(
    (email, password, policyConsent) => registerUser(email, password, policyConsent),
    [],
  )
  const signIn = useCallback((email, password) => loginUser(email, password), [])
  const signOutUser = useCallback(() => logoutUser(), [])
  const resetPassword = useCallback((email) => sendPasswordReset(email), [])
  const resendVerificationEmail = useCallback(async () => {
    await resendEmailVerification(user)
  }, [user])
  const refreshEmailVerification = useCallback(async () => {
    const verified = await reloadAuthenticationUser(user)
    setEmailVerified(verified)
    if (verified && user) {
      const { getUserProfile } = await loadUserService()
      const profile = await getUserProfile(user.uid)
      setUserProfile(profile)
    }
    return verified
  }, [user])

  const updateUserProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error('You must be logged in to update your profile.')

      const { updateUserProfile: updateUserProfileDocument } = await loadUserService()
      const profile = await updateUserProfileDocument(user.uid, updates)
      setUserProfile(profile)
      return profile
    },
    [user],
  )

  const enableBusinessAccess = useCallback(async () => {
    if (!user) throw new Error('You must be logged in to create a business profile.')

    const { enableBusinessRole } = await loadUserService()
    const profile = await enableBusinessRole(user.uid)
    setUserProfile(profile)
    return profile
  }, [user])

  const completeOnboarding = useCallback(async (accountType) => {
    if (!user) throw new Error('You must be logged in to complete onboarding.')

    const { configureAccountType } = await loadUserService()
    const profile = await configureAccountType(user.uid, accountType)
    setUserProfile(profile)
    return profile
  }, [user])

  const value = useMemo(
    () => ({
      enableBusinessAccess,
      completeOnboarding,
      emailVerified,
      loading,
      profileLoading,
      refreshUserProfile,
      refreshEmailVerification,
      resendVerificationEmail,
      resetPassword,
      sessionError,
      signIn,
      signOutUser,
      signUp,
      updateUserProfile,
      user,
      userProfile,
    }),
    [
      completeOnboarding,
      emailVerified,
      loading,
      enableBusinessAccess,
      profileLoading,
      refreshEmailVerification,
      refreshUserProfile,
      resendVerificationEmail,
      resetPassword,
      sessionError,
      signIn,
      signOutUser,
      signUp,
      updateUserProfile,
      user,
      userProfile,
    ],
  )

  return <AuthenticationContext value={value}>{children}</AuthenticationContext>
}

export default AuthenticationProvider
