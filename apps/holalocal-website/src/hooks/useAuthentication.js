import { use } from 'react'
import AuthenticationContext from '../context/AuthenticationContext.js'

function useAuthentication() {
  const context = use(AuthenticationContext)

  if (!context) {
    throw new Error('useAuthentication must be used within AuthenticationProvider.')
  }

  return context
}

export default useAuthentication
