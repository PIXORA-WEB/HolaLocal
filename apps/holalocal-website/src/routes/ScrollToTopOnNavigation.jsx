import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

function ScrollToTopOnNavigation() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const initialNavigationHandledRef = useRef(false)

  useEffect(() => {
    if (!initialNavigationHandledRef.current) {
      initialNavigationHandledRef.current = true
      const navigationEntry = window.performance.getEntriesByType('navigation')[0]
      const isPlainHomepageReload = navigationEntry?.type === 'reload'
        && location.pathname === '/'
        && !location.hash

      if (isPlainHomepageReload) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        return
      }
    }

    if (navigationType !== 'PUSH' || location.hash) return

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.hash, location.key, location.pathname, navigationType])

  return null
}

export default ScrollToTopOnNavigation
