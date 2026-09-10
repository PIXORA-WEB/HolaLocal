import CustomerReviews, { ReviewRatingSummary } from '../components/reviews/CustomerReviews.jsx'
import { customerReviewsEnabled } from '../utils/customerReviewsFlag.js'
import { customerReviewService } from '../services/customerReviewService.js'
import useReviewSummaries from '../hooks/useReviewSummaries.js'
import '../styles/servicesPresentation.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getServiceIdsForGroup,
  getServiceTaxonomyService,
  SERVICE_TAXONOMY_GROUPS,
  SERVICE_TAXONOMY_SERVICES,
} from '@holalocal/firebase-contract'
import BusinessDetailPanel from '../components/common/BusinessDetailPanel.jsx'
import AuthenticationChoiceDialog from '../components/common/AuthenticationChoiceDialog.jsx'
import BusinessReportDialog from '../components/common/BusinessReportDialog.jsx'
import PublicBusinessCard from '../components/common/PublicBusinessCard.jsx'
import ServiceCategoryIcon from '../components/common/ServiceCategoryIcon.jsx'
import useAuthentication from '../hooks/useAuthentication.js'
import { getActivePublicBusinesses, getPublicBusinessById } from '../services/businessService.js'
import { getOrCreateConversationForBusiness } from '../services/conversationService.js'
import { createBusinessReport } from '../services/reportService.js'
import { getLanguageNameFromCode } from '../utils/languages.js'
import SelectField from '../components/common/SelectField.jsx'
import { recordPublicContactAction, recordPublicProfileView } from '../services/businessInsightsService.js'
import {
  getSavedBusinessState,
  removeSavedBusiness,
  saveBusiness,
} from '../services/savedBusinessService.js'
import { normalizeInternalLocation } from '../utils/internalNavigation.js'
import {
  filterPublicBusinesses,
  getPublicBusinessPrimaryServiceLabel,
  parseServiceDiscoveryQuery,
  SERVICE_DISCOVERY_QUERY_TYPES,
} from '../utils/serviceDiscovery.js'
import {
  buildServiceSelectionSearchParams,
  deriveServiceBrowseSelection,
} from '../utils/serviceBrowse.js'

let resultsScrollPosition = null

function ServicesPage() {
  const { t } = useTranslation()
  const { profileLoading, user, userProfile } = useAuthentication()
  const currentLocation = useLocation()
  const navigate = useNavigate()
  const { businessId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [businesses, setBusinesses] = useState([])
  const [summaryAttempt, setSummaryAttempt] = useState(0)
  const refreshSummaries = useCallback(() => setSummaryAttempt(value => value + 1), [])
  const summaries = useReviewSummaries(businessId ? [businessId] : businesses.map(row => row.businessId), summaryAttempt)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [detail, setDetail] = useState({ key: null, business: null, status: 'loading' })
  const detailKey = `${businessId ?? ''}:${loadAttempt}`
  const detailStatus = detail.key === detailKey ? detail.status : 'loading'
  const [authPromptReason, setAuthPromptReason] = useState(null)
  const [savedBusinessState, setSavedBusinessState] = useState({
    businessId: null,
    error: '',
    status: 'idle',
  })
  const [savedBusinessLoadAttempt, setSavedBusinessLoadAttempt] = useState(0)
  const savedBusinessRequestRef = useRef(0)
  const [messaging, setMessaging] = useState(false)
  const [messagingError, setMessagingError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportSuccess, setReportSuccess] = useState(false)
  const [browseGroupOverride, setBrowseGroupOverride] = useState({ groupId: null, taxonomyStateToken: null })
  const searchTerm = searchParams.get('q') ?? ''
  const locationFilter = searchParams.get('area') ?? ''
  const language = searchParams.get('language') ?? ''
  const searchParamsKey = searchParams.toString()
  const taxonomyQueryKey = [
    searchParams.has('service'), searchParams.get('service'),
    searchParams.has('category'), searchParams.get('category'),
  ].join('|')
  const taxonomyStateToken = useMemo(() => ({ taxonomyQueryKey }), [taxonomyQueryKey])
  const serviceQuery = useMemo(
    () => parseServiceDiscoveryQuery(searchParamsKey),
    [searchParamsKey],
  )
  const taxonomyLabel = useCallback(
    (definition) => t(definition.translationKey, { defaultValue: definition.defaultLabel }),
    [t],
  )
  const derivedBrowseSelection = useMemo(
    () => deriveServiceBrowseSelection(serviceQuery),
    [serviceQuery],
  )
  const activeBrowseGroupOverride = browseGroupOverride.taxonomyStateToken === taxonomyStateToken
    ? browseGroupOverride.groupId
    : null
  const selectedGroupId = activeBrowseGroupOverride || derivedBrowseSelection.groupId
  const visibleServiceIds = useMemo(
    () => getServiceIdsForGroup(selectedGroupId),
    [selectedGroupId],
  )
  const activeTaxonomyDefinition = useMemo(() => {
    if (derivedBrowseSelection.serviceId) {
      return getServiceTaxonomyService(derivedBrowseSelection.serviceId)
    }
    if (serviceQuery.type === SERVICE_DISCOVERY_QUERY_TYPES.GROUP_COMPATIBILITY) {
      return SERVICE_TAXONOMY_GROUPS.find(({ id }) => id === serviceQuery.groupId) ?? null
    }
    return null
  }, [derivedBrowseSelection.serviceId, serviceQuery])

  useEffect(() => {
    if (businessId) return undefined
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
  }, [businessId, loadAttempt, t])

  useEffect(() => {
    if (!businessId) return undefined
    let isCurrent = true
    getPublicBusinessById(businessId)
      .then((business) => {
        if (isCurrent) setDetail({ key: detailKey, business, status: business ? 'ready' : 'unavailable' })
      })
      .catch(() => {
        if (isCurrent) setDetail({ key: detailKey, business: null, status: 'error' })
      })
    return () => { isCurrent = false }
  }, [businessId, detailKey])

  function retryDirectoryLoad() {
    if (loading) return
    setError('')
    setLoading(true)
    setLoadAttempt((attempt) => attempt + 1)
  }

  const categoryOptions = useMemo(() => {
    const groupLabels = new Map(SERVICE_TAXONOMY_GROUPS.map((group) => [group.id, taxonomyLabel(group)]))
    return SERVICE_TAXONOMY_SERVICES.map((definition) => ({
      label: `${groupLabels.get(definition.groupId)} — ${taxonomyLabel(definition)}`,
      value: definition.id,
    }))
  }, [taxonomyLabel])
  const languageOptions = useMemo(
    () => [...new Set(businesses.flatMap((business) => business.languages))].sort(),
    [businesses],
  )
  const filteredBusinesses = useMemo(() => filterPublicBusinesses(businesses, {
    area: locationFilter,
    labelResolver: taxonomyLabel,
    language,
    query: serviceQuery,
    searchTerm,
  }), [businesses, language, locationFilter, searchTerm, serviceQuery, taxonomyLabel])
  const selectedBusiness = useMemo(() => {
    const business = detail.key === detailKey ? detail.business : null
    return business ? {
      ...business,
      category: getPublicBusinessPrimaryServiceLabel(business, taxonomyLabel),
    } : null
  }, [detail, detailKey, taxonomyLabel])
  const canSaveBusinesses = Boolean(
    user
    && !profileLoading
    && userProfile?.accountStatus === 'active'
    && userProfile?.deletionRequestedAt == null
    && Array.isArray(userProfile?.roles)
    && userProfile.roles.includes('customer'),
  )

  useEffect(() => {
    if (selectedBusiness?.businessId) recordPublicProfileView(selectedBusiness.businessId)
  }, [selectedBusiness?.businessId])

  useEffect(() => {
    const requestId = ++savedBusinessRequestRef.current
    const selectedBusinessId = selectedBusiness?.businessId ?? null

    if (!selectedBusinessId || !canSaveBusinesses || !user?.uid) {
      return undefined
    }

    getSavedBusinessState(user.uid, selectedBusinessId)
      .then(({ saved }) => {
        if (requestId !== savedBusinessRequestRef.current) return
        setSavedBusinessState({
          businessId: selectedBusinessId,
          error: '',
          status: saved ? 'saved' : 'not-saved',
        })
      })
      .catch(() => {
        if (requestId !== savedBusinessRequestRef.current) return
        setSavedBusinessState({
          businessId: selectedBusinessId,
          error: t('savedBusinesses.loadFailed'),
          status: 'load-failed',
        })
      })

    return () => {
      if (requestId === savedBusinessRequestRef.current) savedBusinessRequestRef.current += 1
    }
  }, [canSaveBusinesses, savedBusinessLoadAttempt, selectedBusiness?.businessId, t, user?.uid])

  useEffect(() => {
    if (businessId || loading || resultsScrollPosition === null) return undefined

    const scrollPosition = resultsScrollPosition
    resultsScrollPosition = null
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollPosition }))
    return () => cancelAnimationFrame(frame)
  }, [businessId, loading])

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

  function updateServiceFilter(serviceId) {
    setSearchParams((currentParams) => {
      return buildServiceSelectionSearchParams(currentParams, serviceId)
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
    recordPublicContactAction(selectedBusiness.businessId, 'holalocal')
    if (!user) {
      setAuthPromptReason('message')
      return
    }

    setMessaging(true)
    setMessagingError('')
    try {
      const conversationId = await getOrCreateConversationForBusiness(user.uid, selectedBusiness.businessId)
      navigate(`/messages/${conversationId}`)
    } catch {
      setMessagingError(t('publicBusinessDetail.messageError'))
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

  async function handleSavedBusinessToggle() {
    if (!selectedBusiness) return
    if (!user) {
      setAuthPromptReason('save')
      return
    }
    if (!canSaveBusinesses || savedBusinessState.businessId !== selectedBusiness.businessId) return
    if (savedBusinessState.status === 'load-failed') {
      setSavedBusinessState({
        businessId: selectedBusiness.businessId,
        error: '',
        status: 'loading',
      })
      setSavedBusinessLoadAttempt((attempt) => attempt + 1)
      return
    }
    if (!['not-saved', 'saved'].includes(savedBusinessState.status)) return

    const selectedBusinessId = selectedBusiness.businessId
    const previousStatus = savedBusinessState.status
    const requestId = ++savedBusinessRequestRef.current
    setSavedBusinessState({
      businessId: selectedBusinessId,
      error: '',
      status: previousStatus === 'saved' ? 'removing' : 'saving',
    })
    try {
      if (previousStatus === 'saved') await removeSavedBusiness(user.uid, selectedBusinessId)
      else await saveBusiness(user.uid, selectedBusinessId)
      if (requestId !== savedBusinessRequestRef.current) return
      setSavedBusinessState({
        businessId: selectedBusinessId,
        error: '',
        status: previousStatus === 'saved' ? 'not-saved' : 'saved',
      })
    } catch {
      if (requestId !== savedBusinessRequestRef.current) return
      setSavedBusinessState({
        businessId: selectedBusinessId,
        error: t(previousStatus === 'saved' ? 'savedBusinesses.removeFailed' : 'savedBusinesses.saveFailed'),
        status: previousStatus,
      })
    }
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
    } catch {
      setReportError(t('publicBusinessDetail.reportError'))
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

  const authPromptCopy = authPromptReason === 'report'
    ? {
        eyebrow: 'reports.eyebrow',
        title: 'services.authPrompt.reportTitle',
        description: 'services.authPrompt.reportDescription',
      }
    : authPromptReason === 'save'
      ? {
          eyebrow: 'savedBusinesses.authPrompt.eyebrow',
          title: 'savedBusinesses.authPrompt.title',
          description: 'savedBusinesses.authPrompt.description',
        }
      : {
          eyebrow: 'services.authPrompt.messagingEyebrow',
          title: 'services.authPrompt.messageTitle',
          description: 'services.authPrompt.messageDescription',
        }

  const authPrompt = (
    <AuthenticationChoiceDialog
      copy={authPromptCopy}
      onClose={() => setAuthPromptReason(null)}
      open={Boolean(authPromptReason)}
      returnLocation={normalizeInternalLocation(currentLocation)}
    />
  )

  if (businessId) {
    return (
      <div className="services-page services-detail-page">
        {detailStatus === 'loading' && <p className="services-state">{t('common.loading')}</p>}
        {detailStatus === 'error' && (
          <div className="services-state services-state--error" role="alert">
            <p>{t('services.loadError')}</p>
            <div>
              <button
                aria-busy={detailStatus === 'loading' || undefined}
                className="button button--primary"
                disabled={detailStatus === 'loading'}
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                type="button"
              >
                {t('common.retry')}
              </button>
              <Link className="button button--secondary" to={`/services${currentLocation.search}`}>
                {t('publicBusinessDetail.backToResults')}
              </Link>
            </div>
          </div>
        )}
        {detailStatus === 'unavailable' && (
          <div className="services-state">
            <h1>{t('publicBusinessDetail.unavailableTitle')}</h1>
            <p>{t('publicBusinessDetail.unavailableDescription')}</p>
            <Link className="button button--secondary" to={`/services${currentLocation.search}`}>
              {t('publicBusinessDetail.backToResults')}
            </Link>
          </div>
        )}
        {selectedBusiness && (
          <>
            {messagingError && <p className="form-message form-message--error" role="alert">{messagingError}</p>}
            <BusinessDetailPanel
              ratingSummary={customerReviewsEnabled ? <ReviewRatingSummary summary={summaries[businessId]} /> : null}
              reviews={customerReviewsEnabled ? <CustomerReviews key={`${businessId}:${user?.uid ?? "anonymous"}:${currentLocation.key}`} api={customerReviewService} businessId={businessId} user={user} profile={userProfile} onMutation={refreshSummaries} /> : null}
              business={selectedBusiness}
              messaging={messaging}
              onBack={closeBusiness}
              onMessage={() => void handleMessageBusiness()}
              onContactAction={(action) => recordPublicContactAction(selectedBusiness.businessId, action)}
              onReport={handleReportBusiness}
              onSavedToggle={() => void handleSavedBusinessToggle()}
              saveError={savedBusinessState.businessId === selectedBusiness.businessId
                ? savedBusinessState.error
                : ''}
              saveState={!user
                ? 'not-saved'
                : canSaveBusinesses
                  ? savedBusinessState.businessId === selectedBusiness.businessId
                    ? savedBusinessState.status
                    : 'loading'
                  : null}
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

      <section className="service-browser" aria-labelledby="service-browser-title">
        <div className="service-browser__heading">
          <div>
            <h2 id="service-browser-title">{t('services.browseTitle')}</h2>
            <p>{t('services.browseDescription')}</p>
          </div>
          <div className="service-browser__select">
            <span>{t('services.categoryLabel')}</span>
            <SelectField
              ariaLabel={t('services.categoryLabel')}
              className="select-field--form"
              onChange={updateServiceFilter}
              options={[{ label: t('services.allCategories'), value: '' }, ...categoryOptions]}
              value={derivedBrowseSelection.serviceId}
            />
          </div>
        </div>

        <div className="service-browser__groups">
          {SERVICE_TAXONOMY_GROUPS.map((group) => (
            <button
              aria-pressed={selectedGroupId === group.id}
              className={selectedGroupId === group.id ? 'is-active' : ''}
              data-service-group={group.id}
              key={group.id}
              onClick={() => setBrowseGroupOverride({ groupId: group.id, taxonomyStateToken })}
              type="button"
            >
              <span className="service-browser__group-icon">
                <ServiceCategoryIcon groupId={group.id} />
              </span>
              <span>{taxonomyLabel(group)}</span>
            </button>
          ))}
        </div>

        {selectedGroupId && (
          <div className="service-browser__services" aria-live="polite">
            {visibleServiceIds.map((serviceId) => {
              const definition = getServiceTaxonomyService(serviceId)
              const selected = derivedBrowseSelection.serviceId === serviceId
              return (
                <button
                  aria-pressed={selected}
                  className={selected ? 'is-active' : ''}
                  key={serviceId}
                  onClick={() => updateServiceFilter(selected ? '' : serviceId)}
                  type="button"
                >
                  {taxonomyLabel(definition)}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="services-results" aria-labelledby="services-results-title">
        <div className="services-results__heading">
          <div>
            <h2 id="services-results-title">{t('services.results')}</h2>
            {activeTaxonomyDefinition && (
              <p className="services-results__active-service">{taxonomyLabel(activeTaxonomyDefinition)}</p>
            )}
            {!loading && !error && businesses.length > 0 && (
              <p>{t('services.resultCount', { count: filteredBusinesses.length })}</p>
            )}
          </div>
          {(
            searchTerm
            || locationFilter
            || language
            || serviceQuery.type !== SERVICE_DISCOVERY_QUERY_TYPES.NONE
          ) && (
            <button onClick={clearFilters} type="button">{t('services.clearFilters')}</button>
          )}
        </div>

        {loading && <p className="services-state">{t('common.loading')}</p>}
        {error && (
          <div className="services-state services-state--error" role="alert">
            <p>{error}</p>
            <button
              aria-busy={loading || undefined}
              className="button button--secondary"
              disabled={loading}
              onClick={retryDirectoryLoad}
              type="button"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
        {!loading && !error && businesses.length === 0 && (
          <div className="services-state services-state--empty">
            <h3>{t('services.emptyTitle')}</h3>
            <p>{t('services.emptyDescription')}</p>
            <Link className="button button--secondary" to="/register?intent=business">
              {t('services.emptyAction')}
            </Link>
          </div>
        )}
        {!loading && !error && businesses.length > 0 && filteredBusinesses.length === 0 && (
          <div className="services-state services-state--empty">
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
                ratingSummary={customerReviewsEnabled ? <ReviewRatingSummary summary={summaries[business.businessId]} /> : null}
                business={{
                  ...business,
                  category: getPublicBusinessPrimaryServiceLabel(business, taxonomyLabel),
                }}
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
