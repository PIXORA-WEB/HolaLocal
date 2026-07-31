import { useCallback, useEffect, useRef, useState } from 'react'
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
  { key: 'customers', icon: 'people', to: '/services' },
  { key: 'businesses', icon: 'briefcase', to: '/register?intent=business' },
]

const trustCards = [
  { key: 'verified', icon: 'shield', statusKey: 'comingSoon' },
  { key: 'identities', icon: 'identity' },
  { key: 'messaging', icon: 'message' },
  { key: 'multilingual', icon: 'language' },
]

const HERO_DESKTOP_MEDIA_QUERY = '(min-width: 72rem)'
const trustStripItems = ['local', 'multilingual', 'private', 'marketplace']
const fallbackBusinessExamples = [
  {
    businessId: 'example-0',
    nameKey: 'marketing.hero.exampleCleaningName',
    category: 'Cleaning',
    serviceArea: '',
    languages: ['en', 'es'],
  },
  {
    businessId: 'example-1',
    nameKey: 'marketing.hero.exampleGardenName',
    category: 'Gardening',
    serviceArea: '',
    languages: ['es', 'en'],
  },
  {
    businessId: 'example-2',
    nameKey: 'marketing.hero.exampleRepairsName',
    category: 'Handyman',
    serviceArea: '',
    languages: ['en', 'es'],
  },
]

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

function getScrollBehavior() {
  if (typeof window === 'undefined') return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function isHeroDesktopLayout() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(HERO_DESKTOP_MEDIA_QUERY).matches
}

function getCardScrollLeft(track, card) {
  const trackBounds = track.getBoundingClientRect()
  const cardBounds = card.getBoundingClientRect()
  return cardBounds.left - trackBounds.left + track.scrollLeft
}

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
  const heroTrackRef = useRef(null)
  const [featuredBusinesses, setFeaturedBusinesses] = useState([])
  const [directoryStatus, setDirectoryStatus] = useState('loading')
  const [directoryLoadAttempt, setDirectoryLoadAttempt] = useState(0)
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0)

  useEffect(() => {
    if (!location.hash) return
    document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [location.hash])

  useEffect(() => {
    let isCurrent = true

    getFeaturedActiveBusinesses(60)
      .then((businesses) => {
        if (isCurrent) {
          setFeaturedBusinesses(selectFeaturedBusinesses(businesses))
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

  const fallbackBusinesses = fallbackBusinessExamples.map((business) => ({
    ...business,
    name: t(business.nameKey),
    verificationStatus: 'unverified',
    ratingAverage: null,
    ratingCount: 0,
    isDemo: true,
  }))
  const businesses = directoryStatus === 'success'
    ? [
        ...featuredBusinesses,
        ...fallbackBusinesses.slice(0, Math.max(0, 3 - featuredBusinesses.length)),
      ].slice(0, 3)
    : []
  const hasMultipleHeroCards = businesses.length > 1
  const displayedHeroIndex = Math.min(currentHeroIndex, Math.max(0, businesses.length - 1))

  const updateCurrentHeroIndex = useCallback(function updateCurrentHeroIndex() {
    const track = heroTrackRef.current
    if (!track) return

    const cards = Array.from(track.children)
    if (cards.length === 0) return

    const trackBounds = track.getBoundingClientRect()
    const trackCenter = trackBounds.left + trackBounds.width / 2
    let closestIndex = 0
    let closestDistance = Infinity

    cards.forEach((card, index) => {
      const cardBounds = card.getBoundingClientRect()
      const cardCenter = cardBounds.left + cardBounds.width / 2
      const distance = Math.abs(trackCenter - cardCenter)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    setCurrentHeroIndex((current) => (current === closestIndex ? current : closestIndex))
  }, [])

  const scrollHeroPreviewTo = useCallback(function scrollHeroPreviewTo(index, behavior = getScrollBehavior()) {
    const track = heroTrackRef.current
    const card = track?.children[index]
    if (!card) return

    track.scrollTo({ left: getCardScrollLeft(track, card), behavior })
    setCurrentHeroIndex(index)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia(HERO_DESKTOP_MEDIA_QUERY)

    function handleHeroModeChange(event) {
      const track = heroTrackRef.current
      if (!track) return

      if (event.matches) {
        track.scrollTo({ left: 0, behavior: 'auto' })
        setCurrentHeroIndex(0)
        return
      }

      scrollHeroPreviewTo(displayedHeroIndex, 'auto')
    }

    mediaQuery.addEventListener('change', handleHeroModeChange)
    return () => mediaQuery.removeEventListener('change', handleHeroModeChange)
  }, [displayedHeroIndex, scrollHeroPreviewTo])

  useEffect(() => {
    const track = heroTrackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(() => {
      if (isHeroDesktopLayout()) return
      scrollHeroPreviewTo(displayedHeroIndex, 'auto')
    })

    observer.observe(track)
    return () => observer.disconnect()
  }, [displayedHeroIndex, scrollHeroPreviewTo])

  useEffect(() => {
    const track = heroTrackRef.current
    if (!track || !isHeroDesktopLayout()) return

    if (track.scrollLeft !== 0) {
      track.scrollTo({ left: 0, behavior: 'auto' })
    }
  }, [businesses.length])

  return (
    <div className="marketing-home">
      <section className="marketing-hero">
        <div className="marketing-hero__content">
          <p className="marketing-eyebrow">{t('marketing.hero.eyebrow')}</p>
          <h1>{t('marketing.hero.title')}</h1>
          <p className="marketing-hero__lead">{t('marketing.hero.description')}</p>
          <div className="marketing-actions">
            <Link className="button button--primary" to="/register?intent=customer">{t('marketing.hero.primaryAction')}</Link>
            <Link className="button button--secondary" to="/services">{t('marketing.hero.secondaryAction')}</Link>
          </div>
        </div>
        <div
          className="marketing-hero__visual"
          aria-describedby="marketing-hero-preview-position"
          aria-label={t('marketing.hero.businessesLabel')}
          role="region"
        >
          {directoryStatus === 'error' ? (
            <div className="marketing-hero__load-error" role="alert">
              <p>{t('marketing.hero.loadFailure')}</p>
              <button
                aria-busy={directoryStatus === 'loading' || undefined}
                className="button button--secondary"
                disabled={directoryStatus === 'loading'}
                onClick={retryDirectoryLoad}
                type="button"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : (
            <div className="marketing-hero__viewport">
              <div className="marketing-hero__track" onScroll={updateCurrentHeroIndex} ref={heroTrackRef}>
                {businesses.map((business) => (
                  <PublicBusinessCard
                    ariaLabel={business.isDemo ? undefined : `View ${business.name} profile`}
                    business={business}
                    key={business.businessId}
                    to={business.isDemo ? undefined : `/services/${business.businessId}`}
                    variant="hero"
                  />
                ))}
              </div>
            </div>
          )}
          {hasMultipleHeroCards && (
            <div className="marketing-hero__carousel-controls">
              <button
                aria-label={t('marketing.hero.previousBusiness')}
                disabled={displayedHeroIndex === 0}
                onClick={() => scrollHeroPreviewTo(displayedHeroIndex - 1)}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <span id="marketing-hero-preview-position" aria-live="polite">
                {t('marketing.hero.businessPosition', {
                  current: displayedHeroIndex + 1,
                  total: businesses.length,
                })}
              </span>
              <button
                aria-label={t('marketing.hero.nextBusiness')}
                disabled={displayedHeroIndex >= businesses.length - 1}
                onClick={() => scrollHeroPreviewTo(displayedHeroIndex + 1)}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          )}
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
          {trustCards.map(({ icon, key, statusKey }) => (
            <article className="trust-card" key={key}>
              <span className="marketing-card__icon"><MarketingIcon name={icon} /></span>
              <div className="trust-card__heading">
                <h3>{t(`marketing.trust.${key}.title`)}</h3>
                {statusKey && <span>{t(`marketing.trust.${key}.${statusKey}`)}</span>}
              </div>
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
        <Link className="button button--light" to="/register?intent=customer">{t('marketing.cta.action')}</Link>
      </section>
    </div>
  )
}

export default HomePage
