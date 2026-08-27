import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getServiceTaxonomyService,
  SERVICE_TAXONOMY_GROUPS,
} from '@holalocal/firebase-contract'
import PublicBusinessCard from '../components/common/PublicBusinessCard.jsx'
import { getFeaturedActiveBusinesses } from '../services/businessService.js'
import { getPublicBusinessPrimaryServiceLabel } from '../utils/serviceDiscovery.js'
import { getHomepageServiceHref } from '../utils/homepageServices.js'

const howItWorksCards = [
  { key: 'browse', icon: 'search' },
  { key: 'connect', icon: 'message' },
  { key: 'choose', icon: 'check' },
]

const journeyCards = [
  { key: 'customers', icon: 'people', to: '/services' },
  { key: 'businesses', icon: 'briefcase', to: '/register?intent=business' },
]

const FEATURED_SERVICE_IDS = Object.freeze([
  'plumber', 'cleaner', 'lawyer', 'personal-trainer', 'dog-walker',
])

const platformPillars = Object.freeze([
  { key: 'services', live: true },
  { key: 'events', live: false },
  { key: 'community', live: false },
])

const whyCards = Object.freeze([
  { key: 'local', icon: 'identity' },
  { key: 'multilingual', icon: 'language' },
  { key: 'real', icon: 'briefcase' },
])

function MarketingIcon({ name }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 19c.6-3.4 2.5-5 5.5-5s4.9 1.6 5.5 5M14 14c3.5-.5 5.5 1.2 6 4" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5h6v2M3 12h18M10 12v2h4v-2" /></>,
    message: <><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 10h8M8 13h5" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16.5 9" /></>,
    shield: <><path d="M12 3.5 19 6v5.6c0 4.2-2.6 7.4-7 8.9-4.4-1.5-7-4.7-7-8.9V6l7-2.5Z" /><path d="M9 12h6" /></>,
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
  const [directoryStatus, setDirectoryStatus] = useState('loading')
  const [directoryLoadAttempt, setDirectoryLoadAttempt] = useState(0)
  const taxonomyLabel = useCallback(
    (definition) => t(definition.translationKey, { defaultValue: definition.defaultLabel }),
    [t],
  )

  useEffect(() => {
    if (!location.hash) return
    document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [location.hash])

  useEffect(() => {
    let isCurrent = true

    getFeaturedActiveBusinesses(60)
      .then((businesses) => {
        if (isCurrent) {
          setFeaturedBusinesses(businesses.slice(0, 3))
          setDirectoryStatus('success')
        }
      })
      .catch(() => {
        if (isCurrent) {
          setFeaturedBusinesses([])
          setDirectoryStatus('error')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [directoryLoadAttempt])

  function retryDirectoryLoad() {
    if (directoryStatus === 'loading') return
    setFeaturedBusinesses([])
    setDirectoryStatus('loading')
    setDirectoryLoadAttempt((attempt) => attempt + 1)
  }

  return (
    <div className="marketing-home">
      <section className="marketing-hero">
        <div className="marketing-hero__content">
          <p className="marketing-eyebrow">{t('marketing.homepage.hero.eyebrow')}</p>
          <h1>{t('marketing.homepage.hero.title')}</h1>
          <p className="marketing-hero__lead">{t('marketing.homepage.hero.description')}</p>
          <div className="marketing-actions">
            <Link className="button button--primary" to="/services">{t('marketing.homepage.hero.customerAction')}</Link>
            <Link className="button button--secondary" to="/register?intent=business">{t('marketing.homepage.hero.businessAction')}</Link>
          </div>
        </div>
      </section>

      <section className="marketing-section homepage-services" id="services">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.homepage.services.eyebrow')}</p>
          <h2>{t('marketing.homepage.services.title')}</h2>
          <p>{t('marketing.homepage.services.description')}</p>
        </div>
        <nav className="homepage-service-groups" aria-label={t('marketing.homepage.services.title')}>
          {SERVICE_TAXONOMY_GROUPS.map((group) => (
            <Link key={group.id} to="/services">
              {taxonomyLabel(group)} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
        <div className="homepage-featured-services">
          {FEATURED_SERVICE_IDS.map((serviceId) => {
            const service = getServiceTaxonomyService(serviceId)
            return (
              <Link key={serviceId} to={getHomepageServiceHref(serviceId)}>
                {taxonomyLabel(service)}
              </Link>
            )
          })}
        </div>
        <Link className="homepage-section-link" to="/services">
          {t('marketing.homepage.services.action')} <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="marketing-section homepage-platform">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.homepage.platform.eyebrow')}</p>
          <h2>{t('marketing.homepage.platform.title')}</h2>
        </div>
        <div className="homepage-platform__grid">
          {platformPillars.map(({ key, live }) => (
            <article className={`homepage-platform__card${live ? ' is-live' : ''}`} key={key}>
              <div>
                <h3>{t(`marketing.homepage.platform.${key}.title`)}</h3>
                {!live && <span>{t('marketing.homepage.platform.comingSoon')}</span>}
              </div>
              <p>{t(`marketing.homepage.platform.${key}.description`)}</p>
              {live && (
                <Link to="/services">{t('marketing.homepage.platform.services.action')} <span aria-hidden="true">→</span></Link>
              )}
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

      <section className="marketing-section homepage-why">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.homepage.why.eyebrow')}</p>
          <h2>{t('marketing.homepage.why.title')}</h2>
        </div>
        <div className="homepage-why__grid">
          {whyCards.map(({ icon, key }) => (
            <article key={key}>
              <span className="marketing-card__icon"><MarketingIcon name={icon} /></span>
              <h3>{t(`marketing.homepage.why.${key}.title`)}</h3>
              <p>{t(`marketing.homepage.why.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section homepage-how">
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

      {(featuredBusinesses.length > 0 || directoryStatus === 'error') && (
        <section className="marketing-section homepage-business-preview">
          <div className="section-heading">
            <p className="marketing-eyebrow">{t('marketing.homepage.preview.eyebrow')}</p>
            <h2>{t('marketing.homepage.preview.title')}</h2>
          </div>
          {directoryStatus === 'error' ? (
            <div className="homepage-business-preview__error" role="alert">
              <p>{t('marketing.hero.loadFailure')}</p>
              <button className="button button--secondary" onClick={retryDirectoryLoad} type="button">
                {t('common.retry')}
              </button>
            </div>
          ) : (
            <div className="homepage-business-preview__grid">
              {featuredBusinesses.map((business) => (
                <PublicBusinessCard
                  business={{
                    ...business,
                    category: getPublicBusinessPrimaryServiceLabel(business, taxonomyLabel),
                  }}
                  key={business.businessId}
                  to={`/services/${business.businessId}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="marketing-cta">
        <div>
          <p className="marketing-eyebrow">{t('marketing.homepage.cta.eyebrow')}</p>
          <h2>{t('marketing.homepage.cta.title')}</h2>
          <p>{t('marketing.homepage.cta.description')}</p>
        </div>
        <Link className="button button--light" to="/register?intent=business">{t('marketing.homepage.cta.action')}</Link>
      </section>
    </div>
  )
}

export default HomePage
