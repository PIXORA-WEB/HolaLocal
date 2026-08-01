import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLockup from '../common/BrandLockup.jsx'
import LanguageSwitcher from '../common/LanguageSwitcher.jsx'

const platformLinks = [
  { labelKey: 'nav.home', to: '/' },
  { labelKey: 'nav.findServices', to: '/services' },
  { labelKey: 'footer.contact', to: '/contact' },
]

const accountLinks = [
  { labelKey: 'account.signIn', to: '/login' },
  { labelKey: 'nav.join', to: '/register' },
]

const legalLinks = [
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
          <nav className="site-footer__group" aria-label={t('footer.platformLabel')}>
            <h2>{t('footer.platform')}</h2>
            <div className="site-footer__links">
              {platformLinks.map((link) => <Link key={link.to} to={link.to}>{t(link.labelKey)}</Link>)}
            </div>
          </nav>
          <nav className="site-footer__group" aria-label={t('footer.accountLabel')}>
            <h2>{t('footer.account')}</h2>
            <div className="site-footer__links">
              {accountLinks.map((link) => <Link key={link.to} to={link.to}>{t(link.labelKey)}</Link>)}
            </div>
          </nav>
          <nav className="site-footer__group" aria-label={t('footer.legalLabel')}>
            <h2>{t('footer.legal')}</h2>
            <div className="site-footer__links">
              {legalLinks.map((link) => <Link key={link.to} to={link.to}>{t(link.labelKey)}</Link>)}
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
