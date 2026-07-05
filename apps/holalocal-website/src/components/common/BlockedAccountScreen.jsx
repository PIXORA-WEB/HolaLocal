import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'

function BlockedAccountScreen({ accountStatus }) {
  const { t } = useTranslation()
  const { signOutUser } = useAuthentication()
  const statusKey = ['suspended', 'deletion_pending', 'deleted'].includes(accountStatus)
    ? accountStatus
    : 'unavailable'

  return (
    <main className="application-error" role="main">
      <section className="auth-card" aria-labelledby="blocked-account-title">
        <div className="auth-card__heading">
          <p className="auth-card__eyebrow">HolaLocal</p>
          <h1 id="blocked-account-title">{t('account.blocked.title')}</h1>
          <p>{t(`account.blocked.status.${statusKey}`)}</p>
          <p>{t('account.blocked.help')}</p>
        </div>
        <button className="button button--primary" onClick={() => void signOutUser()} type="button">
          {t('auth.logout')}
        </button>
      </section>
    </main>
  )
}

export default BlockedAccountScreen
