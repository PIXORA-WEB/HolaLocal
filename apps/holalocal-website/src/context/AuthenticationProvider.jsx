import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
const loadFunctionsClient = () => import('../firebase/functionsClient.js')

function AuthenticationProvider({ children }) {
  // Validate and initialize inside the error boundary's render tree. This keeps
  // configuration failures from becoming a pre-React white screen.
  getFirebaseApp()

  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileStatus, setProfileStatus] = useState('loading')
  const [sessionError, setSessionError] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const profileRequestIdRef = useRef(0)
  const profileRetryPromiseRef = useRef(null)

  const refreshUserProfile = useCallback(async (firebaseUser = user, options = {}) => {
    const background = options.background === true
    const retainUnavailable = options.retainUnavailable === true
    if (!firebaseUser) {
      profileRequestIdRef.current += 1
      setUserProfile(null)
      setProfileStatus('absent')
      return null
    }

    const requestId = ++profileRequestIdRef.current
    if (!background) {
      setProfileLoading(true)
      if (!retainUnavailable) setProfileStatus('loading')
    }

    try {
      const { getUserProfile } = await loadUserService()
      const profile = await getUserProfile(firebaseUser.uid)
      if (requestId === profileRequestIdRef.current) {
        setUserProfile(profile)
        setProfileStatus(profile ? 'loaded' : 'absent')
        setSessionError('')
      }
      return profile
    } catch (error) {
      if (!background && requestId === profileRequestIdRef.current) {
        setUserProfile(null)
        setProfileStatus('unavailable')
        setSessionError('auth.errors.profileLoad')
      }
      throw error
    } finally {
      if (!background && requestId === profileRequestIdRef.current) setProfileLoading(false)
    }
  }, [user])

  const retryUserProfile = useCallback(() => {
    if (!user) return Promise.resolve(null)
    if (profileRetryPromiseRef.current) return profileRetryPromiseRef.current

    const retryPromise = refreshUserProfile(user, { retainUnavailable: true })
      .catch(() => null)
      .finally(() => {
        if (profileRetryPromiseRef.current === retryPromise) {
          profileRetryPromiseRef.current = null
        }
      })
    profileRetryPromiseRef.current = retryPromise
    return retryPromise
  }, [refreshUserProfile, user])

  useEffect(() => {
    let active = true

    const unsubscribe = observeAuthentication(
      async (user) => {
        if (!active) return
        const requestId = ++profileRequestIdRef.current

        setLoading(true)
        setProfileLoading(true)
        setProfileStatus('loading')
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
            if (active && requestId === profileRequestIdRef.current) {
              setUserProfile(profile)
              setProfileStatus(profile ? 'loaded' : 'absent')
            }
            if (
              active &&
              requestId === profileRequestIdRef.current &&
              profile?.accountStatus === 'active' &&
              profile.deletionRequestedAt == null
            ) {
              void updateLastActive(user.uid).catch(() => undefined)
            }
          } else {
            if (requestId === profileRequestIdRef.current) {
              setUserProfile(null)
              setProfileStatus('absent')
            }
          }
        } catch {
          if (active && requestId === profileRequestIdRef.current) {
            setUserProfile(null)
            setProfileStatus('unavailable')
            setSessionError('auth.errors.profileLoad')
          }
        } finally {
          if (active && requestId === profileRequestIdRef.current) {
            setLoading(false)
            setProfileLoading(false)
          }
        }
      },
      () => {
        profileRequestIdRef.current += 1
        if (active) {
          setSessionError('auth.errors.sessionRestore')
          setProfileStatus('unavailable')
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
      await refreshUserProfile(user)
    }
    return verified
  }, [refreshUserProfile, user])

  const updateUserProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error('You must be logged in to update your profile.')

      const { updateUserProfile: updateUserProfileDocument } = await loadUserService()
      const profile = await updateUserProfileDocument(user.uid, updates)
      setUserProfile(profile)
      setProfileStatus('loaded')
      return profile
    },
    [user],
  )

  const completeUserProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error('You must be logged in to complete your profile.')

      const {
        completeAbsentUserProfile,
        updateUserProfile: updateUserProfileDocument,
      } = await loadUserService()
      const profile = profileStatus === 'absent'
        ? await completeAbsentUserProfile(user, updates)
        : await updateUserProfileDocument(user.uid, updates)
      setUserProfile(profile)
      setProfileStatus('loaded')
      return profile
    },
    [profileStatus, user],
  )

  const enableBusinessAccess = useCallback(async () => {
    if (!user) throw new Error('You must be logged in to create a business profile.')

    const { enableBusinessRole } = await loadUserService()
    const profile = await enableBusinessRole(user.uid)
    setUserProfile(profile)
    setProfileStatus('loaded')
    return profile
  }, [user])

  const completeOnboarding = useCallback(async (accountType) => {
    if (!user) throw new Error('You must be logged in to complete onboarding.')

    const { configureAccountType } = await loadUserService()
    const profile = await configureAccountType(user.uid, accountType)
    setUserProfile(profile)
    setProfileStatus('loaded')
    return profile
  }, [user])

  const acceptLegalConsent = useCallback(async () => {
    if (!user) throw new Error('You must be logged in to accept the legal documents.')
    const { acceptLegalConsentCallable } = await loadFunctionsClient()
    const response = await acceptLegalConsentCallable({
      acceptTerms: true,
      acceptPrivacy: true,
    })
    const profile = await refreshUserProfile(user)
    return { consent: response.data, profile }
  }, [refreshUserProfile, user])

  const value = useMemo(
    () => ({
      acceptLegalConsent,
      completeUserProfile,
      enableBusinessAccess,
      completeOnboarding,
      emailVerified,
      loading,
      profileLoading,
      profileStatus,
      refreshUserProfile,
      retryUserProfile,
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
      acceptLegalConsent,
      completeUserProfile,
      completeOnboarding,
      emailVerified,
      loading,
      enableBusinessAccess,
      profileLoading,
      profileStatus,
      refreshEmailVerification,
      refreshUserProfile,
      retryUserProfile,
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
