import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoIcon from '../../assets/logos/logo-icon.png'
import logoText from '../../assets/logos/logo-text.png'
import { brand } from '../../utils/brand.js'

function BrandLockup({ to = '/' }) {
  const { t } = useTranslation()

  return (
    <Link className="brand-lockup" to={to} aria-label={`${brand.name} ${t('nav.home')}`}>
      <img className="brand-lockup__icon" decoding="async" height="824" src={logoIcon} alt="" width="758" />
      <img className="brand-lockup__text" decoding="async" height="228" src={logoText} alt={brand.name} width="950" />
    </Link>
  )
}

export default BrandLockup
