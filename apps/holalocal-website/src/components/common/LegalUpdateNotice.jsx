import { useEffect, useState } from 'react'
import useAuthentication from '../../hooks/useAuthentication.js'

export default function LegalUpdateNotice() {
  const { user, loading } = useAuthentication()
  const [Content, setContent] = useState(null)
  const uid = user?.uid

  useEffect(() => {
    if (loading || !uid || Content) return
    let cancelled = false
    let timer
    let attempts = 0
    const load = async () => {
      try {
        const module = await import('./LegalUpdateNoticeContent.jsx')
        if (!cancelled) setContent(() => module.default)
      } catch {
        // A notice chunk failure must not block routes or acknowledge anything.
        if (!cancelled && ++attempts < 3) timer = setTimeout(load, attempts * 1000)
      }
    }
    void load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [uid, loading, Content])

  // Keep an already mounted coordinator through background auth/profile refresh:
  // unmounting it would discard its session-only "Remind me later" state.
  if (!uid || !Content) return null
  return <Content key={uid} />
}
