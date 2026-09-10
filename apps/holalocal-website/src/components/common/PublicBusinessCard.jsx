import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatLanguageList } from '../../utils/languages.js'
import { getBusinessCategoryLabel } from '../../utils/business.js'
import BusinessMetadataIcon from './BusinessMetadataIcon.jsx'

function getInitials(name) {
  const initials = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase()

  return initials || 'HL'
}

export function ImageAvatar({ alt = '', className = '', name, src }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const isInformative = Boolean(alt)

  return (
    <div
      aria-hidden={isInformative ? undefined : true}
      aria-label={isInformative && (!src || failedSrc === src) ? alt : undefined}
      className={`image-avatar${className ? ` ${className}` : ''}`}
      role={isInformative && (!src || failedSrc === src) ? 'img' : undefined}
    >
      <span aria-hidden={isInformative ? true : undefined}>{getInitials(name)}</span>
      {src && failedSrc !== src && (
        <img alt={alt} onError={() => setFailedSrc(src)} src={src} />
      )}
    </div>
  )
}

export function EditableImageAvatar({
  actionLabel,
  className = '',
  disabled = false,
  iconOnly = false,
  inputLabel,
  imageAlt = '',
  name,
  onChange,
  src,
  uploading = false,
}) {
  const { t } = useTranslation()
  return (
    <label className={`editable-image-avatar${iconOnly ? ' editable-image-avatar--icon-only' : ''}${disabled ? ' is-disabled' : ''}`}>
      <ImageAvatar alt={imageAlt} className={className} name={name} src={src} />
      <span className="editable-image-avatar__overlay" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" />
          <circle cx="12" cy="13.5" r="3" />
        </svg>
        {!iconOnly && <span>{uploading ? t('common.uploading') : actionLabel ?? t('common.change')}</span>}
      </span>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label={inputLabel ?? t('common.changeImage')}
        disabled={disabled}
        onChange={onChange}
        type="file"
      />
    </label>
  )
}

function PublicBusinessCard({
  ariaLabel,
  business,
  linkState,
  onSelect,
  selected = false,
  to,
  variant = 'directory',
  ratingSummary = null,
}) {
  const { i18n, t } = useTranslation()
  const isHero = variant === 'hero'
  const languages = Array.isArray(business.languages) ? business.languages : []
  const categoryLabel = business.category
    ? getBusinessCategoryLabel(business.category, t)
    : t('services.notSpecified')
  const languagesLabel = languages.length > 0
    ? formatLanguageList(languages, i18n.resolvedLanguage ?? i18n.language)
    : t('services.notSpecified')
  const isCardLink = Boolean(to)
  const CardElement = isCardLink ? Link : 'article'
  const selectionProps = isCardLink
    ? {
        'aria-label': ariaLabel,
        onClick: () => onSelect?.(business),
        state: linkState,
        to,
      }
    : !isHero && onSelect
    ? {
        'aria-pressed': selected,
        onClick: () => onSelect(business),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(business)
          }
        },
        role: 'button',
        tabIndex: 0,
      }
    : {}

  if (!isHero) {
    const remaining = Math.max(0, languages.length - 2)
    const locale = i18n.resolvedLanguage ?? i18n.language
    const number = new Intl.NumberFormat(locale).format(remaining)
    return <CardElement className={`directory-business-card${selected ? ' is-selected' : ''}`} {...selectionProps}>
      <div className="directory-business-card__identity">
        <ImageAvatar name={business.name} src={business.logoUrl} />
        <div><h3>{business.name}</h3>{ratingSummary}<p className="directory-business-card__category">{categoryLabel}</p></div>
      </div>
      <p className="directory-business-card__excerpt">{business.description || t('publicBusinessDetail.noDescription')}</p>
      <dl className="directory-business-card__facts">
        <div><dt><BusinessMetadataIcon kind="location" /><span className="visually-hidden">{t('marketing.hero.locationLabel')}</span></dt><dd>{business.serviceArea || t('services.notSpecified')}</dd></div>
        <div><dt><BusinessMetadataIcon kind="languages" /><span className="visually-hidden">{t('marketing.hero.languagesLabel')}</span></dt><dd>{languages.length ? formatLanguageList(languages.slice(0, 2), locale) : t('services.notSpecified')}{remaining > 0 && <span className="directory-business-card__remainder"><span aria-hidden="true">+{number}</span><span className="visually-hidden">{t('services.additionalLanguages', { number })}</span></span>}</dd></div>
      </dl>
      <span className="directory-business-card__status is-active">{t(business.isDemo ? 'marketing.hero.exampleProfile' : 'marketing.hero.activeProfile')}</span>
      <span className="directory-business-card__footer">{t('services.viewBusiness')}<span aria-hidden="true">→</span></span>
    </CardElement>
  }

  return (
    <CardElement className="public-business-card public-business-card--hero" {...selectionProps}>
      {isHero && (
        <ImageAvatar
          className="image-avatar--hero"
          name={business.name}
          src={business.logoUrl}
        />
      )}
      <div className="public-business-card__heading">
        <div>
          <h3>{business.name}</h3>
          <p>{categoryLabel}</p>
        </div>
        <span className="is-active">
          {t(business.isDemo ? 'marketing.hero.exampleProfile' : 'marketing.hero.activeProfile')}
        </span>
      </div>


        <div className="public-business-card__hero-body">
          <dl className="public-business-card__hero-meta">
            <div>
              <dt>
                <span aria-hidden="true">📍</span>
                <span className="visually-hidden">{t('marketing.hero.locationLabel')}</span>
              </dt>
              <dd>{business.serviceArea || t('services.notSpecified')}</dd>
            </div>
            <div>
              <dt>
                <span aria-hidden="true">🌐</span>
                <span className="visually-hidden">{t('marketing.hero.languagesLabel')}</span>
              </dt>
              <dd>{languagesLabel}</dd>
            </div>
          </dl>
        </div>


    </CardElement>
  )
}

export default PublicBusinessCard
