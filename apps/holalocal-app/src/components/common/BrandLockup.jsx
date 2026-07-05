import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoIcon from '../../assets/images/logo-icon.png'
import logoText from '../../assets/images/logo-text.png'
import { brand } from '../../utils/brand.js'

function BrandLockup({ to = '/' }) {
  const { t } = useTranslation()

  return (
    <Link className="brand-lockup" to={to} aria-label={`${brand.name} ${t('nav.home')}`}>
      <img className="brand-lockup__icon" src={logoIcon} alt="" />
      <img className="brand-lockup__text" src={logoText} alt={brand.name} />
    </Link>
  )
}

export default BrandLockup
