import { useState } from 'react'
import useAuthentication from '../../hooks/useAuthentication.js'
import { CURRENT_TERMS_EFFECTIVE_DATE, CURRENT_PRIVACY_EFFECTIVE_DATE, hasCurrentLegalConsent, hasValidLegalConsent } from '../../utils/policies.js'
import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SiteFooter from './SiteFooter.jsx'
import SiteHeader from './SiteHeader.jsx'

function SiteLayout() {
  const { t } = useTranslation()
  const { userProfile } = useAuthentication()
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const showPolicyNotice = CURRENT_TERMS_EFFECTIVE_DATE && CURRENT_PRIVACY_EFFECTIVE_DATE
    && hasValidLegalConsent(userProfile) && !hasCurrentLegalConsent(userProfile) && !noticeDismissed

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">{t('common.skipToContent')}</a>
      <SiteHeader />

      <main className="site-content" id="main-content">
        {showPolicyNotice && (
          <aside className="form-message form-message--info" aria-label={t('legalConsent.currentDocuments')}>
            <p>{t('legalConsent.updateNotice')}</p>
            <Link to="/terms">{t('legalConsent.termsLink')}</Link>{' · '}
            <Link to="/privacy">{t('legalConsent.privacyLink')}</Link>{' '}
            <button className="button button--secondary" type="button" onClick={() => setNoticeDismissed(true)}>{t('common.close')}</button>
          </aside>
        )}
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

export default SiteLayout
