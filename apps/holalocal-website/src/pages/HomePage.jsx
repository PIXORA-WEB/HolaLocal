import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicBusinessCard from '../components/common/PublicBusinessCard.jsx'
import { getFeaturedActiveBusinesses } from '../services/businessService.js'

const howItWorksCards = [
  { key: 'browse', icon: 'search' },
  { key: 'connect', icon: 'message' },
  { key: 'choose', icon: 'check' },
]

const journeyCards = [
  { key: 'customers', icon: 'people', to: '/register' },
  { key: 'businesses', icon: 'briefcase', to: '/business/dashboard' },
]

const trustCards = [
  { key: 'verified', icon: 'verified' },
  { key: 'identities', icon: 'identity' },
  { key: 'messaging', icon: 'message' },
  { key: 'multilingual', icon: 'language' },
]

const trustStripItems = ['local', 'multilingual', 'private', 'marketplace']

function shuffled(items) {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const currentItem = result[index]
    result[index] = result[randomIndex]
    result[randomIndex] = currentItem
  }

  return result
}

function selectFeaturedBusinesses(businesses, count = 3) {
  const verified = shuffled(
    businesses.filter((business) => business.verificationStatus === 'verified'),
  )
  const remaining = shuffled(
    businesses.filter((business) => business.verificationStatus !== 'verified'),
  )

  return [...verified, ...remaining].slice(0, count)
}

function MarketingIcon({ name }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 19c.6-3.4 2.5-5 5.5-5s4.9 1.6 5.5 5M14 14c3.5-.5 5.5 1.2 6 4" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5h6v2M3 12h18M10 12v2h4v-2" /></>,
    message: <><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 10h8M8 13h5" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16.5 9" /></>,
    verified: <><circle cx="12" cy="12" r="8.5" /><path d="m8.4 12.1 2.3 2.3 4.9-5" /></>,
    identity: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" /></>,
    language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21M12 3c-2.2 2.5-3.3 5.5-3.3 9S9.8 18.5 12 21" /></>,
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function HomePage() {
  const { t } = useTranslation()
  const location = useLocation()
  const [featuredBusinesses, setFeaturedBusinesses] = useState([])

  useEffect(() => {
    if (!location.hash) return
    document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [location.hash])

  useEffect(() => {
    let isCurrent = true

    getFeaturedActiveBusinesses(60)
      .then((businesses) => {
        if (isCurrent) setFeaturedBusinesses(selectFeaturedBusinesses(businesses))
      })
      .catch(() => {
        if (isCurrent) setFeaturedBusinesses([])
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const fallbackBusinesses = Array.from({ length: 3 }, (_, index) => ({
    businessId: `example-${index}`,
    name: t(`marketing.hero.examples.${index}.name`),
    category: t(`marketing.hero.examples.${index}.category`),
    serviceArea: t(`marketing.hero.examples.${index}.area`),
    languages: t(`marketing.hero.examples.${index}.languages`, { returnObjects: true }),
    verificationStatus: 'unverified',
    ratingAverage: null,
    ratingCount: 0,
    isDemo: true,
  }))
  const businesses = [
    ...featuredBusinesses,
    ...fallbackBusinesses.slice(0, Math.max(0, 3 - featuredBusinesses.length)),
  ].slice(0, 3)

  return (
    <div className="marketing-home">
      <section className="marketing-hero">
        <div className="marketing-hero__content">
          <p className="marketing-eyebrow">{t('marketing.hero.eyebrow')}</p>
          <h1>{t('marketing.hero.title')}</h1>
          <p className="marketing-hero__lead">{t('marketing.hero.description')}</p>
          <div className="marketing-actions">
            <Link className="button button--primary" to="/register">{t('marketing.hero.primaryAction')}</Link>
            <Link className="button button--secondary" to="/dev-services">{t('marketing.hero.secondaryAction')}</Link>
          </div>
        </div>
        <div className="marketing-hero__visual" aria-label={t('marketing.hero.businessesLabel')}>
          {businesses.map((business) => (
            <PublicBusinessCard
              ariaLabel={business.isDemo ? undefined : `View ${business.name} profile`}
              business={business}
              key={business.businessId}
              to={business.isDemo ? undefined : `/dev-services/${business.businessId}`}
              variant="hero"
            />
          ))}
        </div>
      </section>

      <section className="trust-strip" aria-label={t('marketing.trustStrip.label')}>
        {trustStripItems.map((item) => (
          <p key={item}><span>✓</span>{t(`marketing.trustStrip.${item}`)}</p>
        ))}
      </section>

      <section className="marketing-section" id="services">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.how.eyebrow')}</p>
          <h2>{t('marketing.how.title')}</h2>
          <p>{t('marketing.how.description')}</p>
        </div>
        <div className="marketing-card-grid">
          {howItWorksCards.map(({ icon, key }, index) => (
            <article className="marketing-card" key={key}>
              <span className="marketing-card__step">0{index + 1}</span>
              <span className="marketing-card__icon"><MarketingIcon name={icon} /></span>
              <h3>{t(`marketing.how.${key}.title`)}</h3>
              <p>{t(`marketing.how.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section journey-section" id="for-businesses">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.journeys.eyebrow')}</p>
          <h2>{t('marketing.journeys.title')}</h2>
        </div>
        <div className="journey-grid">
          {journeyCards.map(({ icon, key, to }) => (
            <article className="journey-card" key={key}>
              <span className="marketing-card__icon"><MarketingIcon name={icon} /></span>
              <h3>{t(`marketing.journeys.${key}.title`)}</h3>
              <p>{t(`marketing.journeys.${key}.description`)}</p>
              <Link to={to}>{t(`marketing.journeys.${key}.action`)} <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="region-section">
        <div>
          <p className="marketing-eyebrow">{t('marketing.region.eyebrow')}</p>
          <h2>{t('marketing.region.title')}</h2>
        </div>
        <p>{t('marketing.region.description')}</p>
      </section>

      <section className="marketing-section trust-section">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.trust.eyebrow')}</p>
          <h2>{t('marketing.trust.title')}</h2>
          <p>{t('marketing.trust.description')}</p>
        </div>
        <div className="trust-card-grid">
          {trustCards.map(({ icon, key }) => (
            <article className="trust-card" key={key}>
              <span className="marketing-card__icon"><MarketingIcon name={icon} /></span>
              <h3>{t(`marketing.trust.${key}.title`)}</h3>
              <p>{t(`marketing.trust.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section language-section">
        <div>
          <p className="marketing-eyebrow">{t('marketing.language.eyebrow')}</p>
          <h2>{t('marketing.language.title')}</h2>
        </div>
        <p>{t('marketing.language.description')}</p>
      </section>

      <section className="marketing-cta">
        <div>
          <p className="marketing-eyebrow">{t('marketing.cta.eyebrow')}</p>
          <h2>{t('marketing.cta.title')}</h2>
          <p>{t('marketing.cta.description')}</p>
        </div>
        <Link className="button button--light" to="/register">{t('marketing.cta.action')}</Link>
      </section>
    </div>
  )
}

export default HomePage
