import { createApplicationError } from '../utils/frontendErrors.js'
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
  const registrationPromiseRef = useRef(null)
  const registrationAttemptRef = useRef(null)
  const registrationSequenceRef = useRef(0)
  const providerActiveRef = useRef(true)
  const [registrationAttempt, setRegistrationAttempt] = useState(null)
  const publishRegistration = useCallback((attempt) => {
    if (providerActiveRef.current && registrationAttemptRef.current === attempt) {
      setRegistrationAttempt(attempt ? { ...attempt } : null)
    }
  }, [])
  const releaseRegistration = useCallback((owner) => {
    const attempt = registrationAttemptRef.current
    if (!attempt || (owner && attempt.uiOwner !== owner)) return
    attempt.uiOwner = null
    if (attempt.status === 'pending' || attempt.status === 'ready') attempt.status = 'superseded'
    publishRegistration(attempt)
  }, [publishRegistration])
  const ownsRegistration = useCallback((owner) => {
    const attempt = registrationAttemptRef.current
    return Boolean(providerActiveRef.current && attempt?.uiOwner === owner
      && attempt.status !== 'superseded'
      && (!attempt.createdUser || sessionRef.current.user?.uid === attempt.createdUser.uid))
  }, [])
  // undefined means unknown/unavailable; null is a successful absence result.
  const settledProfileRef = useRef(undefined)
  const isCurrent = useCallback((owner) => owner.active && sessionRef.current === owner, [])

  // Invalidate synchronously, and publish every new owner through React state:
  // identical repeated errors must still replace consumers' captured callbacks.
  const replaceSession = useCallback((firebaseUser) => {
    const attempt = registrationAttemptRef.current
    const previousUid = sessionRef.current.user?.uid
    if (attempt?.status === 'pending' && !attempt.createdUser && firebaseUser) {
      attempt.observedUids.add(firebaseUser.uid)
    }
    if (attempt?.createdUser && firebaseUser?.uid !== attempt.createdUser.uid) {
      attempt.status = 'superseded'
      attempt.uiOwner = null
      publishRegistration(attempt)
    } else if (attempt?.status === 'unknown' && previousUid !== firebaseUser?.uid) {
      attempt.uiOwner = null
      publishRegistration(attempt)
    }
    sessionRef.current.active = false
    const owner = { active: true, user: firebaseUser }
    sessionRef.current = owner
    setSession(owner)
    return owner
  }, [publishRegistration])

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
    providerActiveRef.current = true
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
      providerActiveRef.current = false
      releaseRegistration()
      sessionRef.current.active = false
      profileRetryPromiseRef.current = null
      unsubscribe()
    }
  }, [applyProfile, finishProfileLoading, isCurrent, replaceSession, releaseRegistration])

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

  const signUp = useCallback((email, password, policyConsent, uiOwner = null) => {
    if (registrationPromiseRef.current) return registrationPromiseRef.current
    const previous = registrationAttemptRef.current
    if (sessionRef.current.user || (previous?.status === 'unknown' && previous.uiOwner)) {
      return Promise.reject(createApplicationError('registration-recovery-required'))
    }
    const attempt = {
      id: ++registrationSequenceRef.current, uiOwner, status: 'pending', createdUser: null,
      observedUids: new Set(),
    }
    if (uiOwner) uiOwner.attemptId = attempt.id
    registrationAttemptRef.current = attempt
    publishRegistration(attempt)
    const onUserCreated = (createdUser) => {
      attempt.createdUser = createdUser
      // Observer timing is not credential provenance. Only this callback binds the UID.
      if (attempt.status !== 'superseded'
        && ((sessionRef.current.user && sessionRef.current.user.uid !== createdUser.uid)
          || [...attempt.observedUids].some(uid => uid !== createdUser.uid))) {
        attempt.status = 'superseded'
        attempt.uiOwner = null
      }
      publishRegistration(attempt)
    }
    const registrationPromise = Promise.resolve()
      .then(() => registerUser(email, password, policyConsent, { onUserCreated }))
      .then((result) => {
        if (attempt.status !== 'superseded') {
          attempt.status = 'ready'
          attempt.verificationEmailSent = result?.verificationEmailSent
        }
        publishRegistration(attempt)
        return result
      }, (error) => {
        if (attempt.status !== 'superseded') {
          attempt.status = attempt.createdUser ? 'partial'
            : sessionRef.current.user || error?.code === 'auth/network-request-failed' ? 'unknown' : 'failed'
        }
        publishRegistration(attempt)
        throw error
      })
      .finally(() => {
        if (registrationPromiseRef.current === registrationPromise) registrationPromiseRef.current = null
      })
    registrationPromiseRef.current = registrationPromise
    return registrationPromise
  }, [publishRegistration])
  const signIn = useCallback((email, password) => {
    releaseRegistration()
    return loginUser(email, password)
  }, [releaseRegistration])
  const signOutUser = useCallback(async () => {
    releaseRegistration()
    await logoutUser()
    registrationAttemptRef.current = null
    publishRegistration(null)
  }, [publishRegistration, releaseRegistration])
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
      registrationAttempt,
      ownsRegistration,
      releaseRegistration,
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
      registrationAttempt,
      ownsRegistration,
      releaseRegistration,
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
