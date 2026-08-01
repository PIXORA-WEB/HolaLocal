import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ADMIN_BUSINESS_STATUSES,
  getAdminBusinessesPage,
  getBusinessStatusCounts,
} from '../../services/adminService.js'
import { getBusinessCategoryLabel } from '../../utils/business.js'

function dateText(value, language) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null)
  return date && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—'
}

function BusinessLogo({ business }) {
  return (
    <span className="admin-business-logo">
      {business.profilePhoto?.downloadUrl
        ? <img alt="" src={business.profilePhoto.downloadUrl} />
        : <span aria-hidden="true">{business.name?.charAt(0) || '?'}</span>}
    </span>
  )
}

function StatusBadge({ status, t }) {
  return <span className={`admin-status admin-status--${status}`}>{t(`admin.status.${status}`, { defaultValue: status })}</span>
}

function AdminBusinessesPage() {
  const { i18n, t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStatus = searchParams.get('status')
  const status = ADMIN_BUSINESS_STATUSES.includes(requestedStatus) ? requestedStatus : 'pending_review'
  const [state, setState] = useState({
    status: 'loading', businesses: [], cursor: null, hasMore: false, attempt: 0,
  })
  const [counts, setCounts] = useState(null)
  const [localSearch, setLocalSearch] = useState('')

  useEffect(() => {
    let active = true
    getBusinessStatusCounts()
      .then((result) => active && setCounts(result))
      .catch(() => active && setCounts(null))
    return () => { active = false }
  }, [state.attempt])

  useEffect(() => {
    let active = true
    getAdminBusinessesPage({ status })
      .then((page) => active && setState((current) => ({ ...current, ...page, status: 'loaded' })))
      .catch((error) => active && setState((current) => ({
        ...current,
        error: error?.code === 'permission-denied' ? 'permission' : 'load',
        status: 'error',
      })))
    return () => { active = false }
  }, [state.attempt, status])

  const visibleBusinesses = useMemo(() => {
    const needle = localSearch.trim().toLocaleLowerCase()
    return needle
      ? state.businesses.filter((business) => business.name?.toLocaleLowerCase().includes(needle))
      : state.businesses
  }, [localSearch, state.businesses])

  function selectStatus(nextStatus) {
    setLocalSearch('')
    setState((current) => ({
      ...current, status: 'loading', businesses: [], cursor: null, hasMore: false,
    }))
    setSearchParams({ status: nextStatus })
  }

  function retry() {
    setState((current) => ({ ...current, status: 'loading', attempt: current.attempt + 1 }))
  }

  async function loadMore() {
    if (!state.cursor || state.status === 'loading-more') return
    setState((current) => ({ ...current, status: 'loading-more' }))
    try {
      const page = await getAdminBusinessesPage({ cursor: state.cursor, status })
      setState((current) => ({
        ...current,
        businesses: [...current.businesses, ...page.businesses],
        cursor: page.cursor,
        hasMore: page.hasMore,
        status: 'loaded',
      }))
    } catch {
      setState((current) => ({ ...current, error: 'load-more', status: 'error' }))
    }
  }

  const dateKey = status === 'pending_review' ? 'submittedAt' : 'updatedAt'

  return (
    <section className="admin-page" aria-labelledby="admin-businesses-title">
      <header className="admin-page__heading admin-page__heading--split">
        <div>
          <p className="admin-eyebrow">{t('admin.businesses.eyebrow')}</p>
          <h1 id="admin-businesses-title">{t('admin.businesses.title')}</h1>
          <p>{t('admin.businesses.description')}</p>
        </div>
      </header>

      <div aria-label={t('admin.businesses.statusFilter')} className="admin-status-tabs" role="group">
        {ADMIN_BUSINESS_STATUSES.map((item) => (
          <button
            aria-pressed={status === item}
            key={item}
            onClick={() => selectStatus(item)}
            type="button"
          >
            <span>{t(`admin.status.${item}`)}</span>
            {counts && <strong aria-label={t('admin.businesses.statusCount', { count: counts[item], status: t(`admin.status.${item}`) })}>{counts[item] ?? 0}</strong>}
          </button>
        ))}
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <label htmlFor="admin-business-search">{t('admin.businesses.pageSearch')}</label>
          <span className="admin-search__control">
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
            <input aria-describedby="admin-business-search-help" id="admin-business-search" onChange={(event) => setLocalSearch(event.target.value)} placeholder={t('admin.businesses.searchPlaceholder')} type="search" value={localSearch} />
            {localSearch && <button aria-label={t('admin.businesses.clearSearch')} onClick={() => setLocalSearch('')} type="button"><span aria-hidden="true">×</span></button>}
          </span>
          <p className="admin-search__help" id="admin-business-search-help">{t('admin.businesses.pageSearchHelp')}</p>
        </div>
        <p>{t('admin.businesses.pageLimit', { count: 24 })}</p>
      </div>

      {state.status === 'loading' && (
        <div aria-live="polite" className="admin-list-loading" role="status">
          <span className="visually-hidden">{t('admin.businesses.loading')}</span>
          {[0, 1, 2, 3].map((item) => <span className="admin-list-loading__row" key={item} />)}
        </div>
      )}

      {state.status === 'error' && (
        <div className="admin-alert" role="alert">
          <div><strong>{t('admin.errors.loadTitle')}</strong><p>{t(state.error === 'permission' ? 'admin.errors.permission' : 'admin.errors.load')}</p></div>
          <button className="button button--secondary" onClick={retry} type="button">{t('common.retry')}</button>
        </div>
      )}

      {state.status !== 'loading' && state.businesses.length === 0 && (
        <div className="admin-empty">
          <span aria-hidden="true">✓</span>
          <strong>{t('admin.businesses.emptyTitle')}</strong>
          <p>{t('admin.businesses.empty')}</p>
        </div>
      )}

      {state.businesses.length > 0 && visibleBusinesses.length === 0 && (
        <div className="admin-empty">
          <strong>{t('admin.businesses.noSearchTitle')}</strong>
          <p>{t('admin.businesses.noSearch')}</p>
          <button className="button button--secondary" onClick={() => setLocalSearch('')} type="button">{t('admin.businesses.clearSearch')}</button>
        </div>
      )}

      {visibleBusinesses.length > 0 && (
        <>
          <div className="admin-table-panel">
            <table className="admin-table">
              <caption className="visually-hidden">{t('admin.businesses.caption')}</caption>
              <thead><tr>
                <th scope="col">{t('admin.businesses.name')}</th>
                <th scope="col">{t('admin.businesses.category')}</th>
                <th scope="col">{t('admin.businesses.location')}</th>
                <th scope="col">{t('admin.businesses.submitted')}</th>
                <th scope="col">{t('admin.businesses.status')}</th>
                <th scope="col"><span className="visually-hidden">{t('admin.businesses.actions')}</span></th>
              </tr></thead>
              <tbody>
                {visibleBusinesses.map((business) => (
                  <tr key={business.businessId}>
                    <td><span className="admin-business-name"><BusinessLogo business={business} /><strong>{business.name || t('admin.common.notProvided')}</strong></span></td>
                    <td>{getBusinessCategoryLabel(business.primaryCategoryId, t) || t('admin.common.notProvided')}</td>
                    <td>{business.location?.locality || t('admin.common.notProvided')}</td>
                    <td>{dateText(business[dateKey], i18n.resolvedLanguage)}</td>
                    <td><StatusBadge status={business.status} t={t} /></td>
                    <td><Link className="admin-row-action" aria-label={t('admin.businesses.reviewNamed', { name: business.name })} to={`/admin/businesses/${business.businessId}`}>{t(status === 'pending_review' ? 'admin.businesses.review' : 'admin.businesses.view')} <span aria-hidden="true">→</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="admin-business-cards">
            {visibleBusinesses.map((business) => (
              <li key={business.businessId}>
                <div className="admin-business-card__heading">
                  <BusinessLogo business={business} />
                  <div><strong>{business.name || t('admin.common.notProvided')}</strong><span>{getBusinessCategoryLabel(business.primaryCategoryId, t) || t('admin.common.notProvided')}</span></div>
                  <StatusBadge status={business.status} t={t} />
                </div>
                <dl>
                  <div><dt>{t('admin.businesses.location')}</dt><dd>{business.location?.locality || t('admin.common.notProvided')}</dd></div>
                  <div><dt>{t('admin.businesses.submitted')}</dt><dd>{dateText(business[dateKey], i18n.resolvedLanguage)}</dd></div>
                </dl>
                <Link aria-label={t('admin.businesses.reviewNamed', { name: business.name })} to={`/admin/businesses/${business.businessId}`}>{t(status === 'pending_review' ? 'admin.businesses.review' : 'admin.businesses.view')} <span aria-hidden="true">→</span></Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {state.hasMore && (
        <div className="admin-pagination">
          <p>{t('admin.businesses.loadedCount', { count: state.businesses.length })}</p>
          <button className="button button--secondary" disabled={state.status === 'loading-more'} onClick={() => void loadMore()} type="button">
            {t(state.status === 'loading-more' ? 'common.loading' : 'admin.businesses.loadMore')}
          </button>
        </div>
      )}
    </section>
  )
}

export default AdminBusinessesPage
