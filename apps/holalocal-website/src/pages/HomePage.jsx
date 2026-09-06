import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getServiceTaxonomyService,
  SERVICE_TAXONOMY_GROUPS,
} from '@holalocal/firebase-contract'
import PublicBusinessCard from '../components/common/PublicBusinessCard.jsx'
import ServiceCategoryIcon from '../components/common/ServiceCategoryIcon.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { getFeaturedActiveBusinesses } from '../services/businessService.js'
import { getPublicBusinessPrimaryServiceLabel } from '../utils/serviceDiscovery.js'
import homepageCoastalCommunity from '../assets/illustrations/homepage-coastal-community.webp'
import homepageCoastalCommunityMobile from '../assets/illustrations/homepage-coastal-community-mobile.webp'
import homepageCoastalCommunityTablet from '../assets/illustrations/homepage-coastal-community-tablet.webp'
import {
  buildHomepageSearchHref,
  getHomepageServiceHref,
} from '../utils/homepageServices.js'

const howItWorksCards = Object.freeze([
  { key: 'browse', icon: 'search', accent: 'blue' },
  { key: 'review', icon: 'identity', accent: 'purple' },
  { key: 'connect', icon: 'message', accent: 'orange' },
])

const journeyCards = Object.freeze([
  { key: 'customers', audience: 'customer' },
  { key: 'businesses', audience: 'business' },
])

function getHomepageJourneyHref(audience, { user, userProfile }) {
  if (audience === 'customer') return '/services'
  if (!user) return '/register?intent=business'
  if (userProfile?.roles?.includes('business')) return '/business/dashboard'
  return '/profile?intent=business#business-upgrade-title'
}

const FEATURED_SERVICE_IDS = Object.freeze([
  'plumber', 'cleaner', 'lawyer', 'personal-trainer', 'dog-walker',
])

const platformPillars = Object.freeze([
  { key: 'services', icon: 'briefcase', state: 'available', to: '/services' },
  { key: 'events', icon: 'calendar', state: 'upcoming', to: '/events' },
  { key: 'community', icon: 'people', state: 'upcoming', to: '/community' },
])

const whyCards = Object.freeze([
  { key: 'local', icon: 'identity', accent: 'blue' },
  { key: 'multilingual', icon: 'language', accent: 'purple' },
  { key: 'real', icon: 'briefcase', accent: 'green' },
])

function MarketingIcon({ name }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 19c.6-3.4 2.5-5 5.5-5s4.9 1.6 5.5 5M14 14c3.5-.5 5.5 1.2 6 4" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5h6v2M3 12h18M10 12v2h4v-2" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" /></>,
    message: <><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 10h8M8 13h5" /></>,
    identity: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" /></>,
    language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21M12 3c-2.2 2.5-3.3 5.5-3.3 9S9.8 18.5 12 21" /></>,
  }
  const icon = paths[name]
  if (!icon) throw new Error(`Missing marketing icon for ${name}`)

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" focusable="false" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icon}
    </svg>
  )
}

function HomePage() {
  const { t } = useTranslation()
  const { user, userProfile } = useAuthentication()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchArea, setSearchArea] = useState('')
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

  function submitHeroSearch(event) {
    event.preventDefault()
    navigate(buildHomepageSearchHref({ searchTerm, area: searchArea }))
  }

  return (
    <div className="marketing-home">
      <section className="marketing-hero">
        <div className="marketing-hero__scene" aria-hidden="true">
          <picture>
            <source
              height="1672"
              media="(max-width: 47.999rem)"
              srcSet={homepageCoastalCommunityMobile}
              width="941"
            />
            <source
              height="1086"
              media="(max-width: 71.999rem)"
              srcSet={homepageCoastalCommunityTablet}
              width="1448"
            />
            <img
              alt=""
              aria-hidden="true"
              decoding="async"
              fetchPriority="high"
              height="864"
              src={homepageCoastalCommunity}
              width="1821"
            />
          </picture>
        </div>
        <div className="marketing-hero__inner">
          <div className="marketing-hero__content">
            <p className="marketing-eyebrow">{t('marketing.homepage.hero.eyebrow')}</p>
            <h1 className="marketing-hero__title">
              <span className="marketing-hero__title-line">{t('marketing.homepage.hero.titleFirstLine')}</span>
              {' '}
              <span className="marketing-hero__title-line">{t('marketing.homepage.hero.titleSecondLine')}</span>
            </h1>
            <p className="marketing-hero__lead">{t('marketing.homepage.hero.description')}</p>
          </div>
          <form
            aria-label={t('marketing.homepage.hero.searchFormLabel')}
            className="marketing-hero__search"
            onSubmit={submitHeroSearch}
            role="search"
          >
            <div className="marketing-hero__field">
              <label htmlFor="homepage-service-search">{t('services.searchLabel')}</label>
              <input
                id="homepage-service-search"
                name="q"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('services.searchPlaceholder')}
                type="search"
                value={searchTerm}
              />
            </div>
            <div className="marketing-hero__field">
              <label htmlFor="homepage-area-search">{t('services.locationLabel')}</label>
              <input
                id="homepage-area-search"
                name="area"
                onChange={(event) => setSearchArea(event.target.value)}
                placeholder={t('services.locationPlaceholder')}
                type="text"
                value={searchArea}
              />
            </div>
            <button className="button button--primary" type="submit">
              {t('marketing.homepage.hero.searchAction')}
            </button>
          </form>
          <div className="marketing-actions">
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
            <Link data-service-group={group.id} key={group.id} to="/services">
              <span className="homepage-service-group__icon">
                <ServiceCategoryIcon groupId={group.id} />
              </span>
              <span className="homepage-service-group__label">{taxonomyLabel(group)}</span>
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

      <section className="marketing-section homepage-platform">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.homepage.platform.eyebrow')}</p>
          <h2>{t('marketing.homepage.platform.title')}</h2>
        </div>
        <div className="homepage-platform__grid">
          {platformPillars.map(({ icon, key, state, to }) => (
            <article className="homepage-platform__card" data-product={key} data-state={state} key={key}>
              <div className="homepage-platform__meta">
                <span className="homepage-platform__icon"><MarketingIcon name={icon} /></span>
                <span className="homepage-platform__badge">
                  {t(`marketing.homepage.platform.${state === 'available' ? 'availableNow' : 'comingSoon'}`)}
                </span>
              </div>
              <h3>{t(`marketing.homepage.platform.${key}.title`)}</h3>
              <p>{t(`marketing.homepage.platform.${key}.description`)}</p>
              <Link className="homepage-platform__action" to={to}>
                {t(`marketing.homepage.platform.${key}.action`)}
                <span aria-hidden="true">→</span>
              </Link>
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
          {journeyCards.map(({ audience, key }) => (
            <article
              className="journey-card"
              data-audience={audience}
              key={key}
            >
              <div className="journey-card__content">
                <h3>{t(`marketing.journeys.${key}.title`)}</h3>
                <p>{t(`marketing.journeys.${key}.description`)}</p>
                <Link
                  className="journey-card__action"
                  to={getHomepageJourneyHref(audience, { user, userProfile })}
                >
                  {t(`marketing.journeys.${key}.action`)}
                  <span aria-hidden="true" className="journey-card__arrow">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section homepage-why">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.homepage.why.eyebrow')}</p>
          <h2>{t('marketing.homepage.why.title')}</h2>
        </div>
        <ul className="homepage-why__list">
          {whyCards.map(({ accent, icon, key }) => (
            <li className="homepage-why__item" data-accent={accent} key={key}>
              <span className="homepage-why__icon"><MarketingIcon name={icon} /></span>
              <h3>{t(`marketing.homepage.why.${key}.title`)}</h3>
              <p>{t(`marketing.homepage.why.${key}.description`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="marketing-section homepage-how">
        <div className="section-heading">
          <p className="marketing-eyebrow">{t('marketing.how.eyebrow')}</p>
          <h2>{t('marketing.how.title')}</h2>
          <p>{t('marketing.how.description')}</p>
        </div>
        <ol className="homepage-how__list">
          {howItWorksCards.map(({ accent, icon, key }, index) => (
            <li className="homepage-how__item" data-accent={accent} key={key}>
              <div className="homepage-how__marker">
                <span aria-hidden="true" className="homepage-how__number">0{index + 1}</span>
                <span className="homepage-how__icon"><MarketingIcon name={icon} /></span>
              </div>
              <div className="homepage-how__content">
                <h3>{t(`marketing.how.${key}.title`)}</h3>
                <p>{t(`marketing.how.${key}.description`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="marketing-cta">
        <div className="marketing-cta__content">
          <p className="marketing-eyebrow marketing-cta__eyebrow">{t('marketing.homepage.cta.eyebrow')}</p>
          <h2>{t('marketing.homepage.cta.title')}</h2>
          <p className="marketing-cta__description">{t('marketing.homepage.cta.description')}</p>
        </div>
        <Link
          className="marketing-cta__action"
          to={getHomepageJourneyHref('business', { user, userProfile })}
        >
          {t('marketing.homepage.cta.action')}
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  )
}

export default HomePage
