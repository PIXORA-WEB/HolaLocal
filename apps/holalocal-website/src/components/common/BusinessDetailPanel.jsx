import { ImageAvatar } from './PublicBusinessCard.jsx'
import { useTranslation } from 'react-i18next'
import { formatLanguageList } from '../../utils/languages.js'
import { getBusinessCategoryLabel } from '../../utils/business.js'

function externalUrl(value) {
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function BusinessDetailPanel({ business, messaging, onBack, onContactAction, onMessage, onReport }) {
  const { i18n, t } = useTranslation()
  const hasRating = business.ratingAverage > 0 && business.ratingCount > 0
  const categoryLabel = business.category
    ? getBusinessCategoryLabel(business.category, t)
    : t('publicBusinessDetail.categoryNotSpecified')
  const services = business.services.length > 0
    ? business.services
    : business.category ? [categoryLabel] : []
  const hasContact = Boolean(
    business.contact.phone ||
    business.contact.email ||
    business.contact.website ||
    business.contact.whatsappNumber ||
    business.contact.allowCallbackRequests,
  )

  return (
    <article className="business-detail" aria-labelledby="business-detail-title">
      <button className="business-detail__back" onClick={onBack} type="button">
        <span aria-hidden="true">←</span> {t('publicBusinessDetail.backToResults')}
      </button>

      <header className="business-detail__hero">
        <ImageAvatar
          className="image-avatar--business-detail"
          name={business.name}
          src={business.logoUrl}
        />
        <div className="business-detail__identity">
          <p>{categoryLabel}</p>
          <h1 id="business-detail-title">{business.name}</h1>
          <span>{business.serviceArea || t('publicBusinessDetail.serviceAreaNotSpecified')}</span>
        </div>
        <div className="business-detail__badges">
          <span className="is-active">{t('publicBusinessDetail.activeProfile')}</span>
          <span>{t('publicBusinessDetail.verificationComingSoon')}</span>
          <span>
            {t('publicBusinessDetail.subscriptionPlan', {
              plan: t(`subscription.plans.${business.subscriptionTier}`, {
                defaultValue: business.subscriptionTier,
              }),
            })}
          </span>
        </div>
      </header>

      <div className="business-detail__rating">
        {hasRating ? (
          <p>
            <span aria-hidden="true">★</span> {business.ratingAverage.toFixed(1)} ·{' '}
            {t('publicBusinessDetail.reviewCount', { count: business.ratingCount })}
          </p>
        ) : (
          <p><span aria-hidden="true">☆</span> {t('publicBusinessDetail.noReviews')}</p>
        )}
      </div>

      <nav className="business-detail__navigation" aria-label={t('publicBusinessDetail.sectionsLabel')}>
        <a href="#business-overview">{t('publicBusinessDetail.overview')}</a>
        <a href="#business-services">{t('publicBusinessDetail.services')}</a>
        <a href="#business-photos">{t('publicBusinessDetail.photos')}</a>
        <a href="#business-reviews">{t('publicBusinessDetail.reviews')}</a>
        <a href="#business-about">{t('publicBusinessDetail.about')}</a>
      </nav>

      <div className="business-detail__actions">
        <button
          className="button button--primary"
          disabled={messaging}
          onClick={onMessage}
          type="button"
        >
          {messaging
            ? t('publicBusinessDetail.openingConversation')
            : t('publicBusinessDetail.messageBusiness')}
        </button>
        <button
          className="button button--secondary"
          disabled
          title={t('publicBusinessDetail.favouritesComingSoon')}
          type="button"
        >
          ♡ {t('publicBusinessDetail.save')}
        </button>
        <button className="business-detail__report" onClick={onReport} type="button">
          {t('publicBusinessDetail.reportBusiness')}
        </button>
      </div>

      <section className="business-detail__section" id="business-overview">
        <p className="account-card__eyebrow">{t('publicBusinessDetail.overview')}</p>
        <h2>{t('publicBusinessDetail.aboutBusiness')}</h2>
        <p>{business.description || t('publicBusinessDetail.noDescription')}</p>
        <dl className="business-detail__facts">
          <div>
            <dt>{t('publicBusinessDetail.serviceArea')}</dt>
            <dd>
              {business.serviceAreas.length > 0
                ? business.serviceAreas.join(' · ')
                : business.serviceArea || t('publicBusinessDetail.notSpecified')}
            </dd>
          </div>
          <div>
            <dt>{t('publicBusinessDetail.languages')}</dt>
            <dd>
              {business.languages.length > 0
                ? formatLanguageList(
                    business.languages,
                    i18n.resolvedLanguage ?? i18n.language,
                  ).replaceAll(' • ', ' · ')
                : t('publicBusinessDetail.notSpecified')}
            </dd>
          </div>
        </dl>
      </section>

      <section className="business-detail__section" id="business-services">
        <p className="account-card__eyebrow">{t('publicBusinessDetail.services')}</p>
        <h2>{t('publicBusinessDetail.servicesOffered')}</h2>
        {services.length > 0 ? (
          <ul className="business-detail__service-list">
            {services.map((service) => <li key={service}>{service}</li>)}
          </ul>
        ) : (
          <p className="business-detail__empty">{t('publicBusinessDetail.noServices')}</p>
        )}
      </section>

      <section className="business-detail__section" id="business-photos">
        <p className="account-card__eyebrow">{t('publicBusinessDetail.photos')}</p>
        <h2>{t('publicBusinessDetail.workGallery')}</h2>
        {business.galleryUrls.length > 0 ? (
          <div className="business-detail__gallery">
            {business.galleryUrls.map((url, index) => (
              <img
                alt={t('publicBusinessDetail.workImageAlt', {
                  index: index + 1,
                  name: business.name,
                })}
                decoding="async"
                key={url}
                loading="lazy"
                src={url}
              />
            ))}
          </div>
        ) : (
          <div className="business-detail__empty business-detail__empty--panel">
            <span aria-hidden="true">▧</span>
            <p>{t('publicBusinessDetail.noPhotos')}</p>
          </div>
        )}
      </section>

      <section className="business-detail__section" id="business-reviews">
        <p className="account-card__eyebrow">{t('publicBusinessDetail.reviews')}</p>
        <h2>{t('publicBusinessDetail.customerFeedback')}</h2>
        <div className="business-detail__empty business-detail__empty--panel">
          <span aria-hidden="true">☆</span>
          <p>
            {hasRating
              ? t('publicBusinessDetail.reviewsUnavailable')
              : t('publicBusinessDetail.noReceivedReviews')}
          </p>
        </div>
      </section>

      <section className="business-detail__section" id="business-about">
        <p className="account-card__eyebrow">{t('publicBusinessDetail.about')}</p>
        <h2>{t('publicBusinessDetail.contactInformation')}</h2>
        {hasContact ? (
          <dl className="business-detail__contact">
            {business.contact.phone && <div><dt>{t('publicBusinessDetail.phone')}</dt><dd><a href={`tel:${business.contact.phone}`} onClick={() => onContactAction?.('phone')}>{business.contact.phone}</a></dd></div>}
            {business.contact.email && <div><dt>{t('publicBusinessDetail.email')}</dt><dd><a href={`mailto:${business.contact.email}`} onClick={() => onContactAction?.('email')}>{business.contact.email}</a></dd></div>}
            {business.contact.website && <div><dt>{t('publicBusinessDetail.website')}</dt><dd><a href={externalUrl(business.contact.website)} onClick={() => onContactAction?.('website')} rel="noreferrer" target="_blank">{business.contact.website}</a></dd></div>}
            {business.contact.whatsappNumber && <div><dt>WhatsApp</dt><dd><a href={`https://wa.me/${business.contact.whatsappNumber.replace(/\D/g, '')}`} onClick={() => onContactAction?.('whatsapp')} rel="noreferrer" target="_blank">{t('publicBusinessDetail.openWhatsApp')}</a></dd></div>}
            {business.contact.allowCallbackRequests && <div><dt>{t('publicBusinessDetail.callback')}</dt><dd>{t('publicBusinessDetail.callbackAvailable')}</dd></div>}
          </dl>
        ) : (
          <p className="business-detail__empty">{t('publicBusinessDetail.noContact')}</p>
        )}
      </section>
    </article>
  )
}

export default BusinessDetailPanel
