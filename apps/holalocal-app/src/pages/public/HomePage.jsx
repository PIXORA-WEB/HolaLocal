import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'

function ActionIcon({ name }) {
  const paths = {
    categories: <><rect x="4" y="4" width="6" height="6" rx="2" /><rect x="14" y="4" width="6" height="6" rx="2" /><rect x="4" y="14" width="6" height="6" rx="2" /><rect x="14" y="14" width="6" height="6" rx="2" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" /></>,
    business: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
    verified: <><path d="m12 3 2.2 1.5 2.7-.1.8 2.6 2.2 1.6-.9 2.5.9 2.5-2.2 1.6-.8 2.6-2.7-.1L12 21l-2.2-1.5-2.7.1-.8-2.6-2.2-1.6.9-2.5-.9-2.5L6.3 7l.8-2.6 2.7.1L12 3Z" /><path d="m8.8 12 2.1 2.1 4.3-4.4" /></>,
    message: <><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 10h8M8 13h5" /></>,
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
  const navigate = useNavigate()
  const { user, userProfile } = useAuthentication()
  const hasBusinessAccess = userProfile?.roles?.includes('business') === true

  function handleSearch(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const searchParams = new URLSearchParams()
    const service = formData.get('service')?.trim()
    const location = formData.get('location')?.trim()

    if (service) searchParams.set('service', service)
    if (location) searchParams.set('location', location)

    const queryString = searchParams.toString()
    navigate(`/search${queryString ? `?${queryString}` : ''}`)
  }

  return (
    <div className="app-home">
      <section className="app-home__hero">
        <div className="app-home__intro">
          <p className="app-home__eyebrow">{t('appHome.eyebrow')}</p>
          <h1>{t('appHome.title')}</h1>
          <p>{t('appHome.description')}</p>
        </div>
        <form className="service-search" onSubmit={handleSearch}>
          <label>
            <span>{t('appHome.serviceLabel')}</span>
            <input
              autoComplete="off"
              enterKeyHint="next"
              name="service"
              placeholder={t('appHome.servicePlaceholder')}
              type="search"
            />
          </label>
          <label>
            <span>{t('appHome.locationLabel')}</span>
            <input
              autoComplete="address-level2"
              enterKeyHint="search"
              name="location"
              placeholder={t('appHome.locationPlaceholder')}
              type="search"
            />
          </label>
          <button className="service-search__button" type="submit">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6" />
              <path d="m15 15 5 5" />
            </svg>
            {t('appHome.browseServices')}
          </button>
        </form>
      </section>

      <section className="app-home__section" aria-labelledby="quick-actions-title">
        <div className="app-section-heading">
          <p>{t('appHome.quickEyebrow')}</p>
          <h2 id="quick-actions-title">{t('appHome.quickTitle')}</h2>
        </div>
        <div className="quick-action-grid">
          <Link className="quick-action-card" to="/categories">
            <ActionIcon name="categories" />
            <div>
              <strong>{t('appHome.categoriesTitle')}</strong>
              <small>{t('appHome.categoriesDescription')}</small>
            </div>
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="quick-action-card" to={user ? '/profile' : '/register'}>
            <ActionIcon name="profile" />
            <div>
              <strong>{user ? t('appHome.profileTitle') : t('appHome.joinTitle')}</strong>
              <small>{user ? t('appHome.profileDescription') : t('appHome.joinDescription')}</small>
            </div>
            <span aria-hidden="true">→</span>
          </Link>
          {hasBusinessAccess && (
            <Link className="quick-action-card quick-action-card--business" to="/business/dashboard">
              <ActionIcon name="business" />
              <div>
                <strong>{t('appHome.businessTitle')}</strong>
                <small>{t('appHome.businessDescription')}</small>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </section>

      <section className="app-home__section app-trust-section" aria-labelledby="trust-title">
        <div className="app-section-heading">
          <p>{t('appHome.trustEyebrow')}</p>
          <h2 id="trust-title">{t('appHome.trustTitle')}</h2>
        </div>
        <div className="app-trust-grid">
          {['verified', 'private', 'multilingual'].map((item) => (
            <article className="app-trust-item" key={item}>
              <ActionIcon name={item === 'private' ? 'message' : item} />
              <div>
                <strong>{t(`appHome.trust.${item}.title`)}</strong>
                <small>{t(`appHome.trust.${item}.description`)}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default HomePage
