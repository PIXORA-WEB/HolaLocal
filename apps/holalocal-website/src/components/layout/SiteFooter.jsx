import { openAnalyticsSettings } from '../../services/analyticsConsent.js'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLockup from '../common/BrandLockup.jsx'
import LanguageSwitcher from '../common/LanguageSwitcher.jsx'

const exploreLinks = [
  { product: 'services', labelKey: 'nav.services', to: '/services' },
  { product: 'events', labelKey: 'nav.events', to: '/events' },
  { product: 'community', labelKey: 'nav.community', to: '/community' },
]

const accountLinks = [
  { labelKey: 'account.signIn', to: '/login' },
  { labelKey: 'nav.join', to: '/register' },
]

const helpLegalLinks = [
  { labelKey: 'footer.contact', to: '/contact' },
  { labelKey: 'footer.privacy', to: '/privacy' },
  { labelKey: 'footer.terms', to: '/terms' },
]

function SiteFooter() {
  const { t } = useTranslation()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <BrandLockup />
          <p>{t('footer.description')}</p>
        </div>
        <div className="site-footer__navigation">
          <nav className="site-footer__group" aria-label={t('footer.exploreLabel')}>
            <h2>{t('footer.explore')}</h2>
            <div className="site-footer__links">
              {exploreLinks.map((link) => (
                <Link className={`site-footer__link site-footer__link--${link.product}`} key={link.to} to={link.to}>
                  {t(link.labelKey)}
                </Link>
              ))}
            </div>
          </nav>
          <nav className="site-footer__group" aria-label={t('footer.accountLabel')}>
            <h2>{t('footer.account')}</h2>
            <div className="site-footer__links">
              {accountLinks.map((link) => <Link key={link.to} to={link.to}>{t(link.labelKey)}</Link>)}
            </div>
          </nav>
          <nav className="site-footer__group" aria-label={t('footer.helpLegalLabel')}>
            <h2>{t('footer.helpLegal')}</h2>
            <div className="site-footer__links">
              {helpLegalLinks.map((link) => <Link key={link.to} to={link.to}>{t(link.labelKey)}</Link>)}
              <button type="button" onClick={openAnalyticsSettings}>{t('analytics.settings')}</button>
            </div>
          </nav>
          <div className="site-footer__language">
            <h2>{t('footer.language')}</h2>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
      <div className="site-footer__legal">
        <p>{t('footer.copyright', { year: 2026 })}</p>
        <p>{t('footer.poweredBy')}</p>
      </div>
    </footer>
  )
}

export default SiteFooter
