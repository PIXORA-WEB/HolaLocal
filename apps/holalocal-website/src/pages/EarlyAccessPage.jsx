import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function EarlyAccessPage() {
  const { t } = useTranslation()

  return (
    <div className="early-access-page">
      <section className="early-access-hero">
        <div className="early-access-hero__content">
          <p className="marketing-eyebrow">{t('earlyAccess.hero.eyebrow')}</p>
          <h1>{t('earlyAccess.hero.title')}</h1>
          <p className="early-access-hero__lead">{t('earlyAccess.hero.description')}</p>
          <div className="marketing-actions">
            <Link className="button button--primary" to="/register?intent=customer">
              {t('earlyAccess.hero.customerAction')}
            </Link>
            <Link className="button button--secondary" to="/register?intent=business">
              {t('earlyAccess.hero.businessAction')}
            </Link>
          </div>
          <p className="early-access-hero__note">{t('earlyAccess.hero.note')}</p>
        </div>
        <aside className="early-access-preview" aria-label={t('earlyAccess.preview.label')}>
          <span className="early-access-preview__badge">{t('earlyAccess.preview.badge')}</span>
          <h2>{t('earlyAccess.preview.title')}</h2>
          <div>
            <strong>{t('earlyAccess.preview.customerTitle')}</strong>
            <p>{t('earlyAccess.preview.customerDescription')}</p>
          </div>
          <div>
            <strong>{t('earlyAccess.preview.businessTitle')}</strong>
            <p>{t('earlyAccess.preview.businessDescription')}</p>
          </div>
        </aside>
      </section>

      <section className="trust-strip" aria-label={t('earlyAccess.principles.label')}>
        <p><span>✓</span>{t('earlyAccess.principles.local')}</p>
        <p><span>✓</span>{t('earlyAccess.principles.multilingual')}</p>
        <p><span>✓</span>{t('earlyAccess.principles.privacy')}</p>
        <p><span>✓</span>{t('earlyAccess.principles.messaging')}</p>
      </section>

      <section className="marketing-section early-access-audiences" id="early-access">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('earlyAccess.info.eyebrow')}</p>
          <h2>{t('earlyAccess.info.title')}</h2>
          <p>{t('earlyAccess.info.description')}</p>
        </div>
        <div className="journey-grid">
          <article className="journey-card">
            <span className="early-access-card__number">01</span>
            <h3>{t('earlyAccess.info.customers.title')}</h3>
            <p>{t('earlyAccess.info.customers.description')}</p>
            <Link to="/register?intent=customer">{t('earlyAccess.info.customers.action')} <span aria-hidden="true">→</span></Link>
          </article>
          <article className="journey-card" id="for-businesses">
            <span className="early-access-card__number">02</span>
            <h3>{t('earlyAccess.info.businesses.title')}</h3>
            <p>{t('earlyAccess.info.businesses.description')}</p>
            <Link to="/register?intent=business">{t('earlyAccess.info.businesses.action')} <span aria-hidden="true">→</span></Link>
          </article>
        </div>
      </section>

      <section className="marketing-section early-access-roadmap" aria-labelledby="early-access-roadmap-title">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('earlyAccess.roadmap.eyebrow')}</p>
          <h2 id="early-access-roadmap-title">{t('earlyAccess.roadmap.title')}</h2>
          <p>{t('earlyAccess.roadmap.description')}</p>
        </div>
        <div className="journey-grid">
          <article className="journey-card">
            <h3>{t('earlyAccess.roadmap.available.title')}</h3>
            <ul className="early-access-feature-list">
              {t('earlyAccess.roadmap.available.items', { returnObjects: true }).map((item) => <li key={item}><span aria-hidden="true">✅</span>{item}</li>)}
            </ul>
          </article>
          <article className="journey-card">
            <h3>{t('earlyAccess.roadmap.coming.title')}</h3>
            <ul className="early-access-feature-list">
              {t('earlyAccess.roadmap.coming.items', { returnObjects: true }).map((item) => <li key={item}><span aria-hidden="true">🚧</span>{item}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <article className="early-access-language-notice">
        <h2>{t('earlyAccess.languageNotice.title')}</h2>
        <p>{t('earlyAccess.languageNotice.intro')}</p>
        <p>{t('earlyAccess.languageNotice.refining')}</p>
        <p>{t('earlyAccess.languageNotice.feedback')}</p>
      </article>

      <section className="marketing-cta early-access-cta">
        <div>
          <p className="marketing-eyebrow">{t('earlyAccess.cta.eyebrow')}</p>
          <h2>{t('earlyAccess.cta.title')}</h2>
          <p>{t('earlyAccess.cta.description')}</p>
        </div>
        <Link className="button button--light" to="/register">{t('earlyAccess.cta.action')}</Link>
      </section>
    </div>
  )
}

export default EarlyAccessPage
