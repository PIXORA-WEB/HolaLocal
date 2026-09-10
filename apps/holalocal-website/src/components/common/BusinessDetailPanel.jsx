import { ImageAvatar } from './PublicBusinessCard.jsx'
import { useTranslation } from 'react-i18next'
import { formatLanguageList } from '../../utils/languages.js'
import { getPublicBusinessPrimaryServiceLabel } from '../../utils/serviceDiscovery.js'
import { getServiceAreaLabel } from '../../utils/locations.js'

function externalUrl(value) {
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function SavedBusinessIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M6.75 4.5h10.5v15l-5.25-3.25-5.25 3.25z" />
    </svg>
  )
}

function BusinessDetailPanel({
  business,
  messaging,
  onBack,
  onContactAction,
  onMessage,
  onReport,
  onSavedToggle,
  saveError = '',
  saveState = null,
}) {
  const { i18n, t } = useTranslation()
  const serviceLabel = (value) => getPublicBusinessPrimaryServiceLabel(
    { category: value },
    (definition) => t(definition.translationKey, { defaultValue: definition.defaultLabel }),
  )
  const categoryLabel = getPublicBusinessPrimaryServiceLabel(business, (definition) => t(definition.translationKey, { defaultValue: definition.defaultLabel })) || t('publicBusinessDetail.categoryNotSpecified')
  const services = business.services.length > 0
    ? business.services.map(serviceLabel)
    : business.category ? [categoryLabel] : []
  const hasContact = Boolean(
    business.contact.phone ||
    business.contact.email ||
    business.contact.website ||
    business.contact.whatsappNumber ||
    business.contact.allowCallbackRequests,
  )
  const savePending = saveState === 'loading' || saveState === 'saving' || saveState === 'removing'
  const savePressed = saveState === 'saved' || saveState === 'removing'
  const saveLabel = saveState === 'loading'
    ? t('savedBusinesses.checking')
    : saveState === 'saving'
      ? t('savedBusinesses.saving')
      : saveState === 'removing'
        ? t('savedBusinesses.removing')
        : saveState === 'saved'
          ? t('savedBusinesses.remove')
          : saveState === 'load-failed'
            ? t('savedBusinesses.retry')
            : t('savedBusinesses.save')

  const navigation = (<nav className="business-detail__navigation" aria-label={t('publicBusinessDetail.sectionsLabel')}>
        <a href="#business-overview">{t('publicBusinessDetail.overview')}</a>
        <a href="#business-services">{t('publicBusinessDetail.services')}</a>
        <a href="#business-photos">{t('publicBusinessDetail.photos')}</a>
        <a href="#business-about">{t('publicBusinessDetail.about')}</a>
      </nav>)
  const actions = (<div className="business-detail__actions">
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
        {saveState && (
          <button
            aria-busy={savePending || undefined}
            aria-pressed={['not-saved', 'saving', 'saved', 'removing'].includes(saveState)
              ? savePressed
              : undefined}
            className={`button business-detail__save${savePressed ? ' is-saved' : ''}`}
            disabled={savePending}
            onClick={onSavedToggle}
            type="button"
          >
            <SavedBusinessIcon />
            <span>{saveLabel}</span>
          </button>
        )}
        <button className="business-detail__report" onClick={onReport} type="button">
          {t('publicBusinessDetail.reportBusiness')}
        </button>
        {saveError && <p className="business-detail__save-error" role="alert">{saveError}</p>}
      </div>)
  const information = (<><section className="business-detail__section" id="business-overview">
        <p className="account-card__eyebrow">{t('publicBusinessDetail.overview')}</p>
        <h2>{t('publicBusinessDetail.aboutBusiness')}</h2>
        <p>{business.description || t('publicBusinessDetail.noDescription')}</p>
        <dl className="business-detail__facts">
          <div>
            <dt>{t('publicBusinessDetail.serviceArea')}</dt>
            <dd>
              {business.serviceAreas.length > 0
                ? business.serviceAreas.map((area) => getServiceAreaLabel(area, t)).join(' · ')
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
      </section></>)
  const contact = (<section className="business-detail__section" id="business-about">
        <h2>{t('publicBusinessDetail.contactThisBusiness')}</h2>
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
        {actions}
      </section>)

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
          <span>
            {t('publicBusinessDetail.subscriptionPlan', {
              plan: t(`subscription.plans.${business.subscriptionTier}`, {
                defaultValue: business.subscriptionTier,
              }),
            })}
          </span>
        </div>
        <p className="business-detail__disclosure">
          {t('publicBusinessDetail.profileInformationProvided')}
        </p>
      </header>

      {<div className="business-detail__columns">
        {contact}
        <div className="business-detail__information">{navigation}{information}</div>
      </div>}
    </article>
  )
}

export default BusinessDetailPanel
