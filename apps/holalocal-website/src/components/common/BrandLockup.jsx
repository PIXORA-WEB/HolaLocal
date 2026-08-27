import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoIcon from '../../assets/logos/logo-icon.png'
import logoText from '../../assets/logos/logo-text.png'
import { brand } from '../../utils/brand.js'

function BrandLockup({ className = '', label, linked = true, to = '/', variant = 'full' }) {
  const { t } = useTranslation()
  const classes = [
    'brand-lockup',
    variant === 'icon' ? 'brand-lockup--icon' : '',
    className,
  ].filter(Boolean).join(' ')
  const accessibleLabel = label ?? `${brand.name} ${t('nav.home')}`
  const content = (
    <>
      <img className="brand-lockup__icon" decoding="async" height="768" src={logoIcon} alt="" width="768" />
      {variant !== 'icon' && (
        <img className="brand-lockup__text" decoding="async" height="384" src={logoText} alt="" width="1024" />
      )}
    </>
  )

  if (!linked) {
    return <span className={classes} role="img" aria-label={accessibleLabel}>{content}</span>
  }

  return <Link className={classes} to={to} aria-label={accessibleLabel}>{content}</Link>
}

export default BrandLockup
