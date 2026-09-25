import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n/index.js'
import { emailActionTranslations } from '../../i18n/emailActionTranslations.js'
import { emailActionSDK } from '../../firebase/emailActions.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { actionLocale, createEmailActionController, parseEmailAction } from '../../utils/emailActionModel.js'

for (const [locale, copy] of Object.entries(emailActionTranslations)) i18n.addResourceBundle(locale, 'emailAction', copy)

function ActionRequest({ search }) {
  const { i18n: instance } = useTranslation()
  const { refreshEmailVerification } = useAuthentication()
  const [request] = useState(() => parseEmailAction(search, import.meta.env.VITE_FIREBASE_API_KEY))
  const [controller] = useState(() => createEmailActionController(request, emailActionSDK))
  const [state, setState] = useState({ phase: request.error ? 'error' : 'loading', error: request.error })
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const locale = request.locale ?? actionLocale(instance.resolvedLanguage) ?? 'en'
  const t = instance.getFixedT(locale, 'emailAction')
  useLayoutEffect(() => { controller.setRefresh(refreshEmailVerification) }, [controller, refreshEmailVerification])
  useEffect(() => {
    const stop = controller.subscribe(next => {
      setState(next)
      if (next.phase !== 'form') { setPassword(''); setConfirmation('') }
    })
    void controller.start()
    return stop
  }, [controller])
  useLayoutEffect(() => {
    let meta = document.head.querySelector('meta[name="referrer"]')
    const previous = meta?.getAttribute('content')
    const created = !meta
    if (!meta) { meta = document.createElement('meta'); meta.name = 'referrer'; document.head.append(meta) }
    meta.content = 'no-referrer'
    return () => { if (created) meta.remove(); else if (previous === null) meta.removeAttribute('content'); else meta.content = previous }
  }, [])
  const successKey = { verifyEmail: 'verified', resetPassword: 'resetDone', recoverEmail: 'recovered' }[request.mode]
  const title = state.phase === 'success' ? successKey : state.phase === 'form' ? 'resetTitle' : 'title'
  async function submit(event) {
    event.preventDefault()
    if (password.length < 8) document.getElementById('action-password')?.focus()
    else if (password !== confirmation) document.getElementById('action-confirmation')?.focus()
    await controller.confirm(password, confirmation)
  }
  return <section className="auth-card" lang={locale} aria-labelledby="action-title" aria-busy={state.phase === 'loading' || Boolean(state.busy)}>
    <div className="auth-card__heading"><h1 id="action-title">{t(title)}</h1></div>
    {state.phase === 'loading' && <p role="status">{t('loading')}</p>}
    {state.phase === 'success' && <p className="form-message form-message--success" role="status">{t(successKey)}</p>}
    {state.refreshWarning && <p role="status">{t('refresh')}</p>}
    {state.error && <p id="action-error" className="form-message form-message--error" role="alert">{t(state.error)}</p>}
    {state.phase === 'form' && <form className="auth-form" onSubmit={submit}>
      <label htmlFor="action-password">{t('password')}</label>
      <input id="action-password" type="password" autoComplete="new-password" required disabled={state.busy} value={password} onChange={event => setPassword(event.target.value)} aria-invalid={state.error === 'weak'} aria-describedby={state.error ? 'action-error' : undefined} />
      <label htmlFor="action-confirmation">{t('confirmation')}</label>
      <input id="action-confirmation" type="password" autoComplete="new-password" required disabled={state.busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-invalid={state.error === 'mismatch'} aria-describedby={state.error ? 'action-error' : undefined} />
      <button className="button button--primary" disabled={state.busy} type="submit">{t('save')}</button>
    </form>}
    {(state.phase === 'success' || state.phase === 'error') && <Link className="button button--primary" to={state.phase === 'success' && request.mode !== 'resetPassword' ? request.destination : '/login'}>{t(state.phase === 'success' && request.mode !== 'resetPassword' && request.destination !== '/login' ? 'continue' : 'login')}</Link>}
  </section>
}
export default function EmailActionPage() {
  const { search } = useLocation()
  return <ActionRequest key={search} search={search} />
}
