import { useEffect, useRef, useState } from 'react'
import { legalNoticeContract } from '../firebase-contract/legalNotice.js'
import './notice.css'

export function noticeRouteEligible(pathname) {
  return !['/login', '/sign-in', '/register', '/forgot-password', '/verify-email', '/auth/action',
    '/legal-consent', '/account-deletion', '/privacy', '/terms'].some(path => pathname === path || pathname.startsWith(path + '/'))
}

// Kept mounted across routes, keyed by UID by each application. No persistent deferral.
export default function NoticeCoordinator({ uid, eligible, client, copy, locale, pathname,
  contract = legalNoticeContract }) {
  const [data, setData] = useState(null)
  const [deferred, setDeferred] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const dialog = useRef(null)
  const busy = useRef(false)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    const stop = client.subscribe(uid, value => { if (alive.current) setData(value) })
    return () => { alive.current = false; stop() }
  }, [uid, client])
  const published = contract.publication(data?.publication)
  const due = contract.pending(data?.profile, published)
  const kinds = ['privacy', 'terms'].filter(kind => due?.[kind])
  const key = published ? kinds.map(kind => kind + ':' + published[kind + 'Version']).join('|') : ''
  const open = Boolean(eligible && noticeRouteEligible(pathname) && data?.profile?.accountStatus === 'active' && key && key !== deferred)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement
    if (open && !element.open) element.showModal()
    else if (!open && element.open) element.close()
    return () => { if (element.open) element.close(); previous?.focus?.() }
  }, [open])
  function defer() { setDeferred(key); setError(false) }
  async function acknowledge() {
    if (busy.current || !open) return
    busy.current = true; setSaving(true); setError(false)
    const displayed = Object.fromEntries(kinds.map(kind => [kind, published[kind + 'Version']]))
    try {
      const update = await client.acknowledge(uid, displayed)
      if (alive.current) setData(current => ({ ...current, profile: { ...current.profile, ...update } }))
    } catch {
      if (alive.current) setError(true)
    } finally {
      busy.current = false
      if (alive.current) setSaving(false)
    }
  }
  function date(kind) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })
      .format(new Date(published[kind + 'EffectiveDate'] + 'T00:00:00Z'))
  }
  return <dialog className="legal-update-notice" ref={dialog} aria-labelledby="legal-update-title"
    aria-describedby="legal-update-description" onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll('a[href], button:not(:disabled)')]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }} onCancel={event => { event.preventDefault(); defer() }}
    onClick={event => { if (event.target === event.currentTarget) defer() }}>
    <h2 id="legal-update-title">{kinds.length === 2 ? copy.both : copy[kinds[0]]}</h2>
    <p id="legal-update-description">{copy.body}</p>
    {published && kinds.map(kind => <p key={kind}>
      <a href={`https://www.holalocal.es/${kind}`} target="_blank" rel="noreferrer">{copy['view' + kind]}</a>
      <span className="legal-update-date">{copy.effective}: {date(kind)}</span>
    </p>)}
    {error && <p role="alert">{copy.error}</p>}
    <div className="legal-update-actions">
      <button type="button" onClick={acknowledge} disabled={saving}>{saving ? copy.saving : copy.acknowledge}</button>
      <button type="button" onClick={defer}>{copy.later}</button>
    </div>
  </dialog>
}
