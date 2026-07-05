import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loginUser,
  logoutUser,
  observeAuthentication,
  registerUser,
  sendPasswordReset,
} from '../firebase/auth.js'
import {
  ensureUserProfile,
  getUserProfile,
  updateLastActive,
  updateUserProfile as updateUserProfileDocument,
} from '../services/userService.js'
import AuthenticationContext from './AuthenticationContext.js'

function AuthenticationProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  const refreshUserProfile = useCallback(async (firebaseUser = user) => {
    if (!firebaseUser) {
      setUserProfile(null)
      return null
    }

    setProfileLoading(true)

    try {
      const profile = await getUserProfile(firebaseUser.uid)
      setUserProfile(profile)
      return profile
    } finally {
      setProfileLoading(false)
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
        setSessionError('')

        try {
          if (user) {
            const profile = await ensureUserProfile(user)
            await updateLastActive(user.uid)
            if (active) setUserProfile(profile)
          } else {
            setUserProfile(null)
          }
        } catch {
          if (active) {
            setUserProfile(null)
            setSessionError('We could not load your account profile. Please try again.')
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
          setSessionError('We could not restore your login session. Please refresh and try again.')
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

  const signUp = useCallback((email, password) => registerUser(email, password), [])
  const signIn = useCallback((email, password) => loginUser(email, password), [])
  const signOutUser = useCallback(() => logoutUser(), [])
  const resetPassword = useCallback((email) => sendPasswordReset(email), [])

  const updateUserProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error('You must be logged in to update your profile.')

      const profile = await updateUserProfileDocument(user.uid, updates)
      setUserProfile(profile)
      return profile
    },
    [user],
  )

  const value = useMemo(
    () => ({
      loading,
      profileLoading,
      refreshUserProfile,
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
      loading,
      profileLoading,
      refreshUserProfile,
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
