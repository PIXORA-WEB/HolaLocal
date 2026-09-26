import { useEffect, useRef, useState } from 'react'
import { normalizeMessageTranslationPreference } from '@holalocal/firebase-contract'
import { saveMessageTranslationPreference } from '../../services/userService.js'

export default function MessageTranslationPreference({ uid, profile, t, onSaved }) {
  const available = Boolean(uid && profile && profile.uid === uid && (!profile.accountStatus || profile.accountStatus === 'active'))
  const effective = normalizeMessageTranslationPreference(profile, { exists: available }).enabled
  const [selected, setSelected] = useState(effective)
  const [saved, setSaved] = useState(effective)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const dirty = selected !== saved
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!inFlight.current && !dirty) { setSelected(effective); setSaved(effective) }
  }, [effective, available])

  async function save(event) {
    event.preventDefault()
    if (!available || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setFeedback(null)
    try {
      const result = await saveMessageTranslationPreference(uid, selected)
      if (!mounted.current) return
      setSaved(result.enabled)
      setFeedback('success')
      // Persistence already succeeded; a background refresh must not report a false save failure.
      if (onSaved) void Promise.resolve().then(onSaved).catch(() => undefined)
    } catch {
      if (mounted.current) setFeedback('error')
    } finally {
      inFlight.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return <form className="profile-translation-preference" onSubmit={save} aria-busy={saving || undefined}>
    <label className="profile-translation-preference__label" htmlFor="message-translation-enabled">
      <input id="message-translation-enabled" type="checkbox" checked={selected && available}
        disabled={!available || saving} aria-describedby="message-translation-description message-translation-privacy"
        onChange={event => { setSelected(event.target.checked); setFeedback(null) }} />
      <span>{t('profile.messageTranslation.title')}</span>
    </label>
    <p id="message-translation-description">{t('profile.messageTranslation.description')}</p>
    <p id="message-translation-privacy">{t('profile.messageTranslation.privacy')}</p>
    {(!available || feedback === 'error') && <p className="form-message form-message--error" role="alert">{t('common.requestFailed')}</p>}
    {feedback === 'success' && <p className="form-message form-message--success" role="status">{t('profile.updateSuccess')}</p>}
    <button className="button button--primary" type="submit" disabled={!available || saving}>
      {t(saving ? 'common.loading' : 'common.save')}
    </button>
  </form>
}
