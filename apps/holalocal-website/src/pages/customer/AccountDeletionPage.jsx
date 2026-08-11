import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'
import {
  cancelAccountDeletion,
  getAccountDeletionRequest,
} from '../../services/accountDeletionService.js'

function AccountDeletionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshUserProfile, signOutUser, user } = useAuthentication()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void getAccountDeletionRequest(user?.uid)
      .then((request) => active && setStatus(request?.state === 'requested' ? 'requested' : 'unavailable'))
      .catch(() => active && setStatus('unavailable'))
    return () => { active = false }
  }, [user?.uid])

  async function handleCancel() {
    setError('')
    setStatus('cancelling')
    try {
      await cancelAccountDeletion()
      await refreshUserProfile(user)
      navigate('/profile', { replace: true })
    } catch {
      setError(t('accountDeletion.errors.cancel'))
      setStatus('requested')
    }
  }

  async function handleLogout() {
    setError('')
    try {
      await signOutUser()
    } catch {
      setError(t('accountDeletion.errors.logout'))
    }
  }

  return (
    <main className="application-error" id="main-content">
      <section className="auth-card" aria-labelledby="account-deletion-title">
        <div className="auth-card__heading">
          <p className="auth-card__eyebrow">HolaLocal</p>
          <h1 id="account-deletion-title">{t('accountDeletion.status.title')}</h1>
          <p>{t('accountDeletion.status.description')}</p>
          <p>{t('accountDeletion.status.noDeletionYet')}</p>
        </div>
        {status === 'loading' && <p aria-live="polite">{t('common.loading')}</p>}
        {status === 'unavailable' && <p role="alert">{t('accountDeletion.errors.load')}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="auth-actions">
          <button className="button button--primary" disabled={status !== 'requested'} onClick={() => void handleCancel()} type="button">
            {status === 'cancelling' ? t('accountDeletion.status.cancelling') : t('accountDeletion.status.cancel')}
          </button>
          <button className="button button--secondary" onClick={() => void handleLogout()} type="button">{t('auth.logout')}</button>
        </div>
        <p><Link to="/privacy">{t('footer.privacy')}</Link> · <Link to="/contact">{t('footer.contact')}</Link></p>
      </section>
    </main>
  )
}

export default AccountDeletionPage
