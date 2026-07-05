import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatLanguageList } from '../../utils/languages.js'

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
  inputLabel,
  imageAlt = '',
  name,
  onChange,
  src,
  uploading = false,
}) {
  const { t } = useTranslation()
  return (
    <label className={`editable-image-avatar${disabled ? ' is-disabled' : ''}`}>
      <ImageAvatar alt={imageAlt} className={className} name={name} src={src} />
      <span className="editable-image-avatar__overlay" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" />
          <circle cx="12" cy="13.5" r="3" />
        </svg>
        <span>{uploading ? t('common.uploading') : actionLabel ?? t('common.change')}</span>
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
  variant = 'result',
}) {
  const { t } = useTranslation()
  const isHero = variant === 'hero'
  const isVerified = business.verificationStatus === 'verified'
  const hasRating = business.ratingAverage > 0 && business.ratingCount > 0
  const variantClass = isHero
    ? ' public-business-card--hero'
    : ` public-business-card--result${selected ? ' is-selected' : ''}`
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

  return (
    <CardElement className={`public-business-card${variantClass}`} {...selectionProps}>
      {isHero && (
        <ImageAvatar
          className="image-avatar--hero"
          name={business.name}
          src={business.logoUrl}
        />
      )}
      {!isHero && (
        <ImageAvatar
          className="image-avatar--result"
          name={business.name}
          src={business.logoUrl}
        />
      )}
      <div className="public-business-card__heading">
        <div>
          <h3>{business.name}</h3>
          <p>{business.category || t('services.notSpecified')}</p>
        </div>
        <span className={isHero && isVerified ? 'is-verified' : 'is-active'}>
          {isHero && isVerified && <span aria-hidden="true">✓</span>}
          {t(isHero && isVerified ? 'marketing.hero.verifiedProfile' : 'marketing.hero.activeProfile')}
        </span>
      </div>

      {isHero ? (
        <div className="public-business-card__hero-body">
          {hasRating ? (
            <p
              className="public-business-card__rating"
              aria-label={`${business.ratingAverage.toFixed(1)}, ${t('marketing.hero.ratingCount', { count: business.ratingCount })}`}
            >
              <span aria-hidden="true">★</span>
              <strong>{business.ratingAverage.toFixed(1)}</strong>
              <span>({t('marketing.hero.ratingCount', { count: business.ratingCount })})</span>
            </p>
          ) : (
            <p className="public-business-card__rating public-business-card__rating--empty">
              <span aria-hidden="true">☆</span>
              <span>{t('services.noReviews')}</span>
            </p>
          )}
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
              <dd>{business.languages.length > 0 ? formatLanguageList(business.languages) : t('services.notSpecified')}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="public-business-card__result-details">
          <dl className="public-business-card__result-meta">
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
              <dd>{business.languages.length > 0 ? formatLanguageList(business.languages) : t('services.notSpecified')}</dd>
            </div>
          </dl>
          <div className="public-business-card__result-footer">
            {hasRating ? (
              <p className="public-business-card__rating">
                ★ {business.ratingAverage.toFixed(1)}
                <span>({t('marketing.hero.ratingCount', { count: business.ratingCount })})</span>
              </p>
            ) : (
              <p className="public-business-card__rating public-business-card__rating--empty">
                ☆ <span>{t('services.noReviews')}</span>
              </p>
            )}
            {isVerified && <span className="public-business-card__verified">✓ {t('services.verified')}</span>}
            <span className="public-business-card__result-arrow" aria-hidden="true">→</span>
          </div>
        </div>
      )}
    </CardElement>
  )
}

export default PublicBusinessCard
