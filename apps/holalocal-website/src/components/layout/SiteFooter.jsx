import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLockup from '../common/BrandLockup.jsx'
import LanguageSwitcher from '../common/LanguageSwitcher.jsx'

function SiteFooter() {
  const { t } = useTranslation()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <BrandLockup />
          <p>{t('earlyAccess.footer.description')}</p>
        </div>
        <div className="site-footer__navigation">
          <nav className="site-footer__links" aria-label="Footer links">
            <Link to="/privacy">{t('footer.privacy')}</Link>
            <Link to="/terms">{t('footer.terms')}</Link>
            <Link to="/contact">{t('footer.contact')}</Link>
          </nav>
          <div className="site-footer__language">
            <LanguageSwitcher />
            <p className="site-footer__language-note">{t('earlyAccess.languageNotice.selectorNote')}</p>
          </div>
        </div>
      </div>
      <div className="site-footer__legal">
        <p>{t('footer.copyright', { year: 2026 })}</p>
      </div>
    </footer>
  )
}

export default SiteFooter
