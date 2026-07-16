import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BusinessDetailPanel from '../components/common/BusinessDetailPanel.jsx'
import AccessibleDialog from '../components/common/AccessibleDialog.jsx'
import BusinessReportDialog from '../components/common/BusinessReportDialog.jsx'
import PublicBusinessCard from '../components/common/PublicBusinessCard.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { getActivePublicBusinesses } from '../services/businessService.js'
import { getOrCreateConversationForBusiness } from '../services/conversationService.js'
import { createBusinessReport } from '../services/reportService.js'
import { getLanguageNameFromCode } from '../utils/languages.js'
import SelectField from '../components/common/SelectField.jsx'

const popularCategories = [
  { key: 'cleaning', value: 'Cleaning' },
  { key: 'plumbing', value: 'Plumbing' },
  { key: 'gardening', value: 'Gardening' },
  { key: 'handyman', value: 'Handyman' },
  { key: 'airConditioning', value: 'Air Conditioning' },
  { key: 'petServices', value: 'Pet Services' },
]

let resultsScrollPosition = null

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function ServicesPage() {
  const { t } = useTranslation()
  const { user } = useAuthentication()
  const currentLocation = useLocation()
  const navigate = useNavigate()
  const { businessId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authPromptReason, setAuthPromptReason] = useState(null)
  const [messaging, setMessaging] = useState(false)
  const [messagingError, setMessagingError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportSuccess, setReportSuccess] = useState(false)
  const searchTerm = searchParams.get('q') ?? ''
  const locationFilter = searchParams.get('area') ?? ''
  const category = searchParams.get('category') ?? ''
  const language = searchParams.get('language') ?? ''

  useEffect(() => {
    let isCurrent = true

    getActivePublicBusinesses()
      .then((activeBusinesses) => {
        if (isCurrent) setBusinesses(activeBusinesses)
      })
      .catch(() => {
        if (isCurrent) setError(t('services.loadError'))
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [t])

  const categoryOptions = useMemo(
    () => [...new Set(businesses.map((business) => business.category).filter(Boolean))].sort(),
    [businesses],
  )
  const languageOptions = useMemo(
    () => [...new Set(businesses.flatMap((business) => business.languages))].sort(),
    [businesses],
  )
  const filteredBusinesses = useMemo(() => {
    const normalizedSearch = normalize(searchTerm)
    const normalizedLocation = normalize(locationFilter)

    return businesses.filter((business) => {
      const matchesSearch = !normalizedSearch ||
        normalize(business.name).includes(normalizedSearch) ||
        normalize(business.category).includes(normalizedSearch)
      const matchesLocation = !normalizedLocation ||
        normalize(business.serviceArea).includes(normalizedLocation)
      const matchesCategory = !category || normalize(business.category) === normalize(category)
      const matchesLanguage = !language || business.languages.some(
        (businessLanguage) => normalize(businessLanguage) === normalize(language),
      )

      return matchesSearch && matchesLocation && matchesCategory && matchesLanguage
    })
  }, [businesses, category, language, locationFilter, searchTerm])
  const selectedBusiness = businesses.find(
    (business) => business.businessId === businessId,
  ) ?? null

  useEffect(() => {
    if (businessId || loading || resultsScrollPosition === null) return undefined

    const scrollPosition = resultsScrollPosition
    resultsScrollPosition = null
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollPosition }))
    return () => cancelAnimationFrame(frame)
  }, [businessId, loading])

  useEffect(() => {
    if (!authPromptReason) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') setAuthPromptReason(null)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [authPromptReason])

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  function updateFilter(name, value) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      if (value) nextParams.set(name, value)
      else nextParams.delete(name)
      return nextParams
    }, { replace: true })
  }

  function selectBusiness() {
    setMessagingError('')
    resultsScrollPosition = window.scrollY
  }

  function closeBusiness() {
    setMessagingError('')
    if (currentLocation.state?.fromServices && window.history.state?.idx > 0) navigate(-1)
    else navigate(`/services${currentLocation.search}`)
  }

  async function handleMessageBusiness() {
    if (!selectedBusiness) return
    if (!user) {
      setAuthPromptReason('message')
      return
    }

    setMessaging(true)
    setMessagingError('')
    try {
      const conversationId = await getOrCreateConversationForBusiness(user.uid, selectedBusiness)
      navigate(`/messages/${conversationId}`)
    } catch (conversationError) {
      setMessagingError(conversationError.message || 'Unable to open this conversation.')
    } finally {
      setMessaging(false)
    }
  }

  function handleReportBusiness() {
    if (!selectedBusiness) return
    if (!user) {
      setAuthPromptReason('report')
      return
    }

    setReportError('')
    setReportSuccess(false)
    setReportOpen(true)
  }

  async function handleReportSubmit({ details, reason }) {
    if (!user || !selectedBusiness) return

    setReporting(true)
    setReportError('')
    try {
      await createBusinessReport({
        businessId: selectedBusiness.businessId,
        details,
        reason,
        reporterId: user.uid,
      })
      setReportSuccess(true)
    } catch (reportSubmissionError) {
      setReportError(reportSubmissionError.message || 'Unable to submit this report. Please try again.')
    } finally {
      setReporting(false)
    }
  }

  function closeReport() {
    if (reporting) return
    setReportOpen(false)
    setReportError('')
    setReportSuccess(false)
  }

  const authPrompt = (
    <AccessibleDialog
      ariaLabelledBy="messaging-auth-title"
      className="profile-edit-dialog messaging-auth-dialog"
      onClose={() => setAuthPromptReason(null)}
      open={Boolean(authPromptReason)}
    >
      <section className="profile-edit-dialog__panel">
        <button
          aria-label={t('services.authPrompt.close')}
          className="messaging-auth-prompt__close"
          onClick={() => setAuthPromptReason(null)}
          type="button"
        >
          ×
        </button>
        <p className="account-card__eyebrow">
          {t(authPromptReason === 'report' ? 'reports.eyebrow' : 'services.authPrompt.messagingEyebrow')}
        </p>
        <h2 id="messaging-auth-title">
          {t(authPromptReason === 'report' ? 'services.authPrompt.reportTitle' : 'services.authPrompt.messageTitle')}
        </h2>
        <p>
          {authPromptReason === 'report'
            ? t('services.authPrompt.reportDescription')
            : t('services.authPrompt.messageDescription')}
        </p>
        <div>
          <Link className="button button--primary" state={{ from: currentLocation }} to="/login">{t('auth.login')}</Link>
          <Link className="button button--secondary" state={{ from: currentLocation }} to="/register">{t('auth.register')}</Link>
        </div>
      </section>
    </AccessibleDialog>
  )

  if (businessId) {
    return (
      <div className="services-page services-detail-page">
        {loading && <p className="services-state">{t('common.loading')}</p>}
        {error && (
          <div className="services-state services-state--error" role="alert">
            <p>{error}</p>
            <Link className="button button--secondary" to={`/services${currentLocation.search}`}>
              Back to results
            </Link>
          </div>
        )}
        {!loading && !error && !selectedBusiness && (
          <div className="services-state">
            <h1>Business unavailable</h1>
            <p>This business profile could not be found or is no longer active.</p>
            <Link className="button button--secondary" to={`/services${currentLocation.search}`}>
              Back to results
            </Link>
          </div>
        )}
        {selectedBusiness && (
          <>
            {messagingError && <p className="form-message form-message--error" role="alert">{messagingError}</p>}
            <BusinessDetailPanel
              business={selectedBusiness}
              messaging={messaging}
              onBack={closeBusiness}
              onMessage={() => void handleMessageBusiness()}
              onReport={handleReportBusiness}
            />
            <BusinessReportDialog
              business={selectedBusiness}
              error={reportError}
              onClose={closeReport}
              onSubmit={(values) => void handleReportSubmit(values)}
              open={reportOpen}
              submitting={reporting}
              success={reportSuccess}
            />
          </>
        )}
        {authPrompt}
      </div>
    )
  }

  return (
    <div className="services-page">
      <header className="services-page__header">
        <p className="marketing-eyebrow">{t('services.eyebrow')}</p>
        <h1>{t('services.title')}</h1>
        <p>{t('services.description')}</p>
      </header>

      <section className="services-filters" aria-label={t('services.filtersLabel')}>
        <label className="services-filters__search">
          <span>{t('services.searchLabel')}</span>
          <input
            onChange={(event) => updateFilter('q', event.target.value)}
            placeholder={t('services.searchPlaceholder')}
            type="search"
            value={searchTerm}
          />
        </label>
        <label>
          <span>{t('services.locationLabel')}</span>
          <input
            onChange={(event) => updateFilter('area', event.target.value)}
            placeholder={t('services.locationPlaceholder')}
            type="search"
            value={locationFilter}
          />
        </label>
        <div className="services-filters__select">
          <span>{t('services.categoryLabel')}</span>
          <SelectField
            ariaLabel={t('services.categoryLabel')}
            className="select-field--form"
            onChange={(value) => updateFilter('category', value)}
            options={[{ label: t('services.allCategories'), value: '' }, ...categoryOptions.map((option) => ({ label: option, value: option }))]}
            value={category}
          />
        </div>
        <div className="services-filters__select">
          <span>{t('services.languageLabel')}</span>
          <SelectField
            ariaLabel={t('services.languageLabel')}
            className="select-field--form"
            onChange={(value) => updateFilter('language', value)}
            options={[{ label: t('services.allLanguages'), value: '' }, ...languageOptions.map((option) => ({ label: getLanguageNameFromCode(option), value: option }))]}
            value={language}
          />
        </div>
      </section>

      <section className="popular-categories" aria-labelledby="popular-categories-title">
        <div>
          <h2 id="popular-categories-title">{t('services.popularCategories')}</h2>
          <p>{t('services.popularDescription')}</p>
        </div>
        <div className="popular-categories__list">
          {popularCategories.map((option) => (
            <button
              className={category === option.value ? 'is-active' : ''}
              key={option.key}
              onClick={() => updateFilter('category', category === option.value ? '' : option.value)}
              type="button"
            >
              {t(`services.categories.${option.key}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="services-results" aria-labelledby="services-results-title">
        <div className="services-results__heading">
          <div>
            <h2 id="services-results-title">{t('services.results')}</h2>
            {!loading && !error && businesses.length > 0 && (
              <p>{t('services.resultCount', { count: filteredBusinesses.length })}</p>
            )}
          </div>
          {(searchTerm || locationFilter || category || language) && (
            <button onClick={clearFilters} type="button">{t('services.clearFilters')}</button>
          )}
        </div>

        {loading && <p className="services-state">{t('common.loading')}</p>}
        {error && <p className="services-state services-state--error" role="alert">{error}</p>}
        {!loading && !error && businesses.length === 0 && (
          <div className="services-state">
            <h3>{t('services.emptyTitle')}</h3>
            <p>{t('services.emptyDescription')}</p>
            <Link className="button button--secondary" to="/register?intent=business">
              {t('services.emptyAction')}
            </Link>
          </div>
        )}
        {!loading && !error && businesses.length > 0 && filteredBusinesses.length === 0 && (
          <div className="services-state">
            <h3>{t('services.noMatchesTitle')}</h3>
            <p>{t('services.noMatchesDescription')}</p>
            <button className="button button--secondary" onClick={clearFilters} type="button">
              {t('services.clearFilters')}
            </button>
          </div>
        )}
        {filteredBusinesses.length > 0 && (
          <div className="services-results__grid">
            {filteredBusinesses.map((business) => (
              <PublicBusinessCard
                business={business}
                key={business.businessId}
                linkState={{ fromServices: true }}
                onSelect={selectBusiness}
                to={`/services/${business.businessId}${currentLocation.search}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default ServicesPage
