import { ImageAvatar } from './PublicBusinessCard.jsx'
import { formatLanguageList } from '../../utils/languages.js'

function externalUrl(value) {
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function BusinessDetailPanel({ business, messaging, onBack, onMessage, onReport }) {
  const isVerified = business.verificationStatus === 'verified'
  const hasRating = business.ratingAverage > 0 && business.ratingCount > 0
  const services = business.services.length > 0
    ? business.services
    : business.category ? [business.category] : []
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
        <span aria-hidden="true">←</span> Back to results
      </button>

      <header className="business-detail__hero">
        <ImageAvatar
          className="image-avatar--business-detail"
          name={business.name}
          src={business.logoUrl}
        />
        <div className="business-detail__identity">
          <p>{business.category || 'Category not specified'}</p>
          <h2 id="business-detail-title">{business.name}</h2>
          <span>{business.serviceArea || 'Service area not specified'}</span>
        </div>
        <div className="business-detail__badges">
          <span className="is-active">Active profile</span>
          <span className={isVerified ? 'is-verified' : ''}>
            {isVerified ? '✓ Verified' : 'Not verified'}
          </span>
          <span>{business.subscriptionTier} plan</span>
        </div>
      </header>

      <div className="business-detail__rating">
        {hasRating ? (
          <p><span aria-hidden="true">★</span> {business.ratingAverage.toFixed(1)} · {business.ratingCount} {business.ratingCount === 1 ? 'review' : 'reviews'}</p>
        ) : (
          <p><span aria-hidden="true">☆</span> No reviews yet</p>
        )}
      </div>

      <nav className="business-detail__navigation" aria-label="Business detail sections">
        <a href="#business-overview">Overview</a>
        <a href="#business-services">Services</a>
        <a href="#business-photos">Photos</a>
        <a href="#business-reviews">Reviews</a>
        <a href="#business-about">About</a>
      </nav>

      <div className="business-detail__actions">
        <button
          className="button button--primary"
          disabled={messaging}
          onClick={onMessage}
          type="button"
        >
          {messaging ? 'Opening conversation…' : 'Message business'}
        </button>
        <button className="button button--secondary" disabled title="Favourites are coming soon" type="button">
          ♡ Save
        </button>
        <button className="business-detail__report" onClick={onReport} type="button">
          Report business
        </button>
      </div>

      <section className="business-detail__section" id="business-overview">
        <p className="account-card__eyebrow">Overview</p>
        <h3>About this business</h3>
        <p>{business.description || 'This business has not added a public description yet.'}</p>
        <dl className="business-detail__facts">
          <div>
            <dt>Service area</dt>
            <dd>{business.serviceAreas.length > 0 ? business.serviceAreas.join(' · ') : business.serviceArea || 'Not specified'}</dd>
          </div>
          <div>
            <dt>Languages</dt>
            <dd>{business.languages.length > 0 ? formatLanguageList(business.languages).replaceAll(' • ', ' · ') : 'Not specified'}</dd>
          </div>
        </dl>
      </section>

      <section className="business-detail__section" id="business-services">
        <p className="account-card__eyebrow">Services</p>
        <h3>Services offered</h3>
        {services.length > 0 ? (
          <ul className="business-detail__service-list">
            {services.map((service) => <li key={service}>{service}</li>)}
          </ul>
        ) : (
          <p className="business-detail__empty">No detailed services have been added yet.</p>
        )}
      </section>

      <section className="business-detail__section" id="business-photos">
        <p className="account-card__eyebrow">Photos</p>
        <h3>Work gallery</h3>
        {business.galleryUrls.length > 0 ? (
          <div className="business-detail__gallery">
            {business.galleryUrls.map((url, index) => (
              <img alt={`${business.name} work example ${index + 1}`} decoding="async" key={url} loading="lazy" src={url} />
            ))}
          </div>
        ) : (
          <div className="business-detail__empty business-detail__empty--panel">
            <span aria-hidden="true">▧</span>
            <p>No work photos have been added yet.</p>
          </div>
        )}
      </section>

      <section className="business-detail__section" id="business-reviews">
        <p className="account-card__eyebrow">Reviews</p>
        <h3>Customer feedback</h3>
        <div className="business-detail__empty business-detail__empty--panel">
          <span aria-hidden="true">☆</span>
          <p>{hasRating ? 'Individual reviews are not available in this first release.' : 'This business has not received any reviews yet.'}</p>
        </div>
      </section>

      <section className="business-detail__section" id="business-about">
        <p className="account-card__eyebrow">About</p>
        <h3>Contact information</h3>
        {hasContact ? (
          <dl className="business-detail__contact">
            {business.contact.phone && <div><dt>Phone</dt><dd><a href={`tel:${business.contact.phone}`}>{business.contact.phone}</a></dd></div>}
            {business.contact.email && <div><dt>Email</dt><dd><a href={`mailto:${business.contact.email}`}>{business.contact.email}</a></dd></div>}
            {business.contact.website && <div><dt>Website</dt><dd><a href={externalUrl(business.contact.website)} rel="noreferrer" target="_blank">{business.contact.website}</a></dd></div>}
            {business.contact.whatsappNumber && <div><dt>WhatsApp</dt><dd><a href={`https://wa.me/${business.contact.whatsappNumber.replace(/\D/g, '')}`} rel="noreferrer" target="_blank">Open WhatsApp</a></dd></div>}
            {business.contact.allowCallbackRequests && <div><dt>Callback</dt><dd>Callback requests available through HolaLocal messaging</dd></div>}
          </dl>
        ) : (
          <p className="business-detail__empty">No public contact details have been added.</p>
        )}
      </section>
    </article>
  )
}

export default BusinessDetailPanel
