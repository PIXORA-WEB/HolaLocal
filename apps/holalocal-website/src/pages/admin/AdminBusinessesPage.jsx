import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ADMIN_BUSINESS_STATUSES,
  getAdminBusinessesPage,
} from '../../services/adminService.js'
import { getBusinessCategoryLabel } from '../../utils/business.js'

function dateText(value, language) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null)
  return date && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—'
}

function AdminBusinessesPage() {
  const { i18n, t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStatus = searchParams.get('status')
  const status = ADMIN_BUSINESS_STATUSES.includes(requestedStatus) ? requestedStatus : 'pending_review'
  const [state, setState] = useState({
    status: 'loading', businesses: [], cursor: null, hasMore: false, attempt: 0,
  })
  const [localSearch, setLocalSearch] = useState('')

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

  return (
    <section className="admin-page" aria-labelledby="admin-businesses-title">
      <header className="admin-page__heading">
        <p>{t('admin.businesses.eyebrow')}</p>
        <h1 id="admin-businesses-title">{t('admin.businesses.title')}</h1>
      </header>
      <div className="admin-filters">
        <label>
          {t('admin.businesses.statusFilter')}
          <select value={status} onChange={(event) => {
            setState((current) => ({ ...current, status: 'loading', businesses: [], cursor: null }))
            setSearchParams({ status: event.target.value })
          }}>
            {ADMIN_BUSINESS_STATUSES.map((item) => <option key={item} value={item}>{t(`admin.status.${item}`)}</option>)}
          </select>
        </label>
        <label>
          {t('admin.businesses.pageSearch')}
          <input onChange={(event) => setLocalSearch(event.target.value)} type="search" value={localSearch} />
        </label>
      </div>
      {state.status === 'loading' && <p role="status">{t('admin.businesses.loading')}</p>}
      {state.status === 'error' && (
        <div className="admin-alert" role="alert">
          <p>{t(state.error === 'permission' ? 'admin.errors.permission' : 'admin.errors.load')}</p>
          <button className="button button--secondary" onClick={() => setState((current) => ({ ...current, status: 'loading', attempt: current.attempt + 1 }))} type="button">{t('common.retry')}</button>
        </div>
      )}
      {state.status !== 'loading' && state.businesses.length === 0 && <p className="admin-empty">{t('admin.businesses.empty')}</p>}
      {state.businesses.length > 0 && (
        <div className="admin-table-scroll">
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
                  <td><span className="admin-business-name">{business.profilePhoto?.downloadUrl && <img alt="" src={business.profilePhoto.downloadUrl} />} {business.name || '—'}</span></td>
                  <td>{getBusinessCategoryLabel(business.primaryCategoryId, t) || '—'}</td>
                  <td>{business.location?.locality || '—'}</td>
                  <td>{dateText(status === 'pending_review' ? business.submittedAt : business.updatedAt, i18n.resolvedLanguage)}</td>
                  <td><span className={`admin-status admin-status--${business.status}`}>{t(`admin.status.${business.status}`, { defaultValue: business.status })}</span></td>
                  <td><Link aria-label={t('admin.businesses.reviewNamed', { name: business.name })} to={`/admin/businesses/${business.businessId}`}>{t('admin.businesses.review')}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state.hasMore && <button className="button button--secondary" disabled={state.status === 'loading-more'} onClick={() => void loadMore()} type="button">{t(state.status === 'loading-more' ? 'common.loading' : 'admin.businesses.loadMore')}</button>}
    </section>
  )
}

export default AdminBusinessesPage
