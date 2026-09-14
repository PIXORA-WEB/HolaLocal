import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../utils/policies.js'
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
  const [session, setSession] = useState({ active: false, user: null })
  const sessionRef = useRef(session)
  const profileRequestIdRef = useRef(0)
  const mutationIdRef = useRef(0)
  const acceptedMutationIdRef = useRef(0)
  const verificationIdRef = useRef(0)
  const consentIdRef = useRef(0)
  const profileRetryPromiseRef = useRef(null)
  // undefined means unknown/unavailable; null is a successful absence result.
  const settledProfileRef = useRef(undefined)
  const isCurrent = useCallback((owner) => owner.active && sessionRef.current === owner, [])

  // Invalidate synchronously, and publish every new owner through React state:
  // identical repeated errors must still replace consumers' captured callbacks.
  const replaceSession = useCallback((firebaseUser) => {
    sessionRef.current.active = false
    const owner = { active: true, user: firebaseUser }
    sessionRef.current = owner
    setSession(owner)
    return owner
  }, [])

  // Reads are latest-started. Mutations supersede by successful operation ID,
  // not merely by starting: a failed newer attempt cannot strand a valid result.
  // This is client intent ordering, not an inference about server commit order.
  // An accepted mutation invalidates reads begun before its completion. Already
  // started services still return/reject normally even if state ownership is lost.
  const applyProfile = useCallback((profile) => {
    settledProfileRef.current = profile
    setUserProfile(profile)
    setProfileStatus(profile ? 'loaded' : 'absent')
    setSessionError('')
  }, [])
  const finishProfileLoading = useCallback(() => {
    setLoading(false)
    setProfileLoading(false)
  }, [])

  const readProfile = useCallback(async (firebaseUser, options, owner) => {
    if (!isCurrent(owner) || !firebaseUser || firebaseUser.uid !== owner.user?.uid) return null
    profileRetryPromiseRef.current = null
    const background = options.background === true
    const requestId = ++profileRequestIdRef.current
    const ownsRead = () => isCurrent(owner) && requestId === profileRequestIdRef.current
    if (!background) {
      setProfileLoading(true)
      if (!options.retainUnavailable) setProfileStatus('loading')
    }
    try {
      const { getUserProfile } = await loadUserService()
      if (!ownsRead()) return null
      const profile = await getUserProfile(firebaseUser.uid)
      if (ownsRead()) applyProfile(profile)
      return profile
    } catch (error) {
      if (ownsRead() && (!background || settledProfileRef.current === undefined)) {
        settledProfileRef.current = undefined
        setUserProfile(null)
        setProfileStatus('unavailable')
        setSessionError('auth.errors.profileLoad')
      }
      throw error
    } finally {
      if (ownsRead()) {
        // A background read can supersede a foreground read. It must release
        // that read's loading state while preserving confirmed profile data.
        if (background) setProfileStatus((status) => status === 'loading'
          ? (settledProfileRef.current === undefined ? 'unavailable' : settledProfileRef.current ? 'loaded' : 'absent') : status)
        finishProfileLoading()
      }
    }
  }, [applyProfile, finishProfileLoading, isCurrent])

  const refreshUserProfile = useCallback((firebaseUser = user, options = {}) =>
    readProfile(firebaseUser, options, session), [readProfile, session, user])

  const retryUserProfile = useCallback(() => {
    if (!isCurrent(session) || !user) return Promise.resolve(null)
    if (profileRetryPromiseRef.current) return profileRetryPromiseRef.current
    const retryPromise = refreshUserProfile(user, { retainUnavailable: true })
      .catch(() => null)
      .finally(() => {
        if (profileRetryPromiseRef.current === retryPromise) profileRetryPromiseRef.current = null
      })
    profileRetryPromiseRef.current = retryPromise
    return retryPromise
  }, [isCurrent, refreshUserProfile, session, user])

  useEffect(() => {
    let active = true
    // A subscription callback publishes its own owner, including on effect replay.
    const unsubscribe = observeAuthentication(async (firebaseUser) => {
      if (!active) return
      const owner = replaceSession(firebaseUser)
      profileRetryPromiseRef.current = null
      settledProfileRef.current = undefined
      const requestId = ++profileRequestIdRef.current
      const ownsRead = () => isCurrent(owner) && requestId === profileRequestIdRef.current
      setLoading(true)
      setProfileLoading(true)
      setProfileStatus('loading')
      setUserProfile(null)
      setUser(firebaseUser)
      setEmailVerified(firebaseUser?.emailVerified === true)
      setSessionError('')
      try {
        if (!firebaseUser) {
          applyProfile(null)
          return
        }
        const { ensureUserProfile, getUserProfile, updateLastActive } = await loadUserService()
        if (!ownsRead()) return
        const existingProfile = await getUserProfile(firebaseUser.uid)
        if (!ownsRead()) return
        const profile = firebaseUser.emailVerified
          && existingProfile?.accountStatus === 'active'
          && existingProfile?.deletionRequestedAt == null
          ? await ensureUserProfile(firebaseUser) : existingProfile
        if (!ownsRead()) return
        applyProfile(profile)
        if (profile?.accountStatus === 'active' && profile.deletionRequestedAt == null) {
          void updateLastActive(firebaseUser.uid).catch(() => undefined)
        }
      } catch {
        if (ownsRead()) {
          settledProfileRef.current = undefined
          setUserProfile(null)
          setProfileStatus('unavailable')
          setSessionError('auth.errors.profileLoad')
        }
      } finally {
        if (ownsRead()) finishProfileLoading()
      }
    }, () => {
      if (!active) return
      // Invalidate pending work but retain the existing explicit retry path.
      replaceSession(sessionRef.current.user)
      profileRetryPromiseRef.current = null
      setSessionError('auth.errors.sessionRestore')
      setProfileStatus('unavailable')
      finishProfileLoading()
    })
    return () => {
      active = false
      sessionRef.current.active = false
      profileRetryPromiseRef.current = null
      unsubscribe()
    }
  }, [applyProfile, finishProfileLoading, isCurrent, replaceSession])

  const mutateProfile = useCallback(async (operation) => {
    if (!isCurrent(session)) throw new Error('Authentication session changed.')
    profileRetryPromiseRef.current = null
    const mutationId = ++mutationIdRef.current
    const requestId = ++profileRequestIdRef.current
    const ownsMutation = () => isCurrent(session) && mutationId > acceptedMutationIdRef.current
    try {
      const services = await loadUserService()
      if (!isCurrent(session)) throw new Error('Authentication session changed.')
      const profile = await operation(services)
      if (ownsMutation()) {
        acceptedMutationIdRef.current = mutationId
        profileRequestIdRef.current += 1
        applyProfile(profile)
        finishProfileLoading()
      }
      return profile
    } finally {
      if (ownsMutation() && requestId === profileRequestIdRef.current) {
        setProfileStatus((status) => status === 'loading'
          ? (settledProfileRef.current === undefined ? 'unavailable' : settledProfileRef.current ? 'loaded' : 'absent') : status)
        finishProfileLoading()
      }
    }
  }, [applyProfile, finishProfileLoading, isCurrent, session])

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
    if (!isCurrent(session)) return false
    const verificationId = ++verificationIdRef.current
    const verified = await reloadAuthenticationUser(user)
    if (isCurrent(session) && verificationId === verificationIdRef.current) {
      setEmailVerified(verified)
      if (verified && user) await readProfile(user, {}, session)
    }
    return verified
  }, [isCurrent, readProfile, session, user])

  const updateUserProfile = useCallback(async (updates) => {
    if (!user) throw new Error('You must be logged in to update your profile.')
    return mutateProfile(({ updateUserProfile: update }) => update(user.uid, updates))
  }, [mutateProfile, user])

  const completeUserProfile = useCallback(async (updates) => {
    if (!user) throw new Error('You must be logged in to complete your profile.')
    return mutateProfile(({ completeAbsentUserProfile, updateUserProfile: update }) =>
      profileStatus === 'absent' ? completeAbsentUserProfile(user, updates) : update(user.uid, updates))
  }, [mutateProfile, profileStatus, user])

  const enableBusinessAccess = useCallback(async () => {
    if (!user) throw new Error('You must be logged in to create a business profile.')
    return mutateProfile(({ enableBusinessRole }) => enableBusinessRole(user.uid))
  }, [mutateProfile, user])

  const completeOnboarding = useCallback(async (accountType) => {
    if (!user) throw new Error('You must be logged in to complete onboarding.')
    return mutateProfile(({ configureAccountType }) => configureAccountType(user.uid, accountType))
  }, [mutateProfile, user])

  const acceptLegalConsent = useCallback(async () => {
    if (!user) throw new Error('You must be logged in to accept the legal documents.')
    if (!isCurrent(session)) throw new Error('Authentication session changed.')
    const consentId = ++consentIdRef.current
    const { acceptLegalConsentCallable } = await loadFunctionsClient()
    if (!isCurrent(session)) throw new Error('Authentication session changed.')
    const response = await acceptLegalConsentCallable({
      acceptTerms: true,
      acceptPrivacy: true,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    })
    // Supersession is not a missing profile. Consumers must not navigate from it.
    const superseded = () => ({ status: 'superseded', consent: response.data })
    if (!isCurrent(session) || consentId !== consentIdRef.current) return superseded()
    const pendingProfile = readProfile(user, {}, session)
    const requestId = profileRequestIdRef.current
    const profile = await pendingProfile
    if (!isCurrent(session) || consentId !== consentIdRef.current
      || requestId !== profileRequestIdRef.current) return superseded()
    return { status: 'current', consent: response.data, profile }
  }, [isCurrent, readProfile, session, user])

  const value = useMemo(
    () => ({
      acceptLegalConsent,
      authSession: session,
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
      session,
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
