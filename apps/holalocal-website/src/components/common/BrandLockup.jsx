import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoIcon from '../../assets/logos/logo-icon-display.png'
import logoText from '../../assets/logos/logo-text-display.png'
import { brand } from '../../utils/brand.js'

function BrandLockup({ to = '/' }) {
  const { t } = useTranslation()

  return (
    <Link className="brand-lockup" to={to} aria-label={`${brand.name} ${t('nav.home')}`}>
      <img className="brand-lockup__icon" decoding="async" height="200" src={logoIcon} alt="" width="184" />
      <img className="brand-lockup__text" decoding="async" height="72" src={logoText} alt={brand.name} width="300" />
    </Link>
  )
}

export default BrandLockup
