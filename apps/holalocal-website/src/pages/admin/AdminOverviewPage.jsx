import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date)
    : '—'
}

function AdminOverviewPage() {
  const { i18n, t } = useTranslation()
  const [state, setState] = useState({
    status: 'loading', counts: {}, recent: [], attempt: 0,
  })

  useEffect(() => {
    let active = true
    Promise.all([
      getBusinessStatusCounts(),
      getAdminBusinessesPage({ status: 'pending_review', pageSize: 5 }),
    ])
      .then(([counts, recentPage]) => active && setState((current) => ({
        ...current,
        counts,
        recent: recentPage.businesses,
        status: 'loaded',
      })))
      .catch((error) => active && setState((current) => ({
        ...current,
        error: error?.code === 'permission-denied' ? 'permission' : 'load',
        status: 'error',
      })))
    return () => { active = false }
  }, [state.attempt])

  function retry() {
    setState((current) => ({ ...current, status: 'loading', attempt: current.attempt + 1 }))
  }

  return (
    <section className="admin-page" aria-labelledby="admin-overview-title">
      <header className="admin-page__heading">
        <div>
          <p className="admin-eyebrow">{t('admin.overview.eyebrow')}</p>
          <h1 id="admin-overview-title">{t('admin.overview.title')}</h1>
          <p>{t('admin.overview.description')}</p>
        </div>
      </header>

      {state.status === 'loading' && (
        <div aria-live="polite" className="admin-summary-grid" role="status">
          <span className="visually-hidden">{t('admin.overview.loading')}</span>
          {ADMIN_BUSINESS_STATUSES.map((status) => <div className="admin-summary-card admin-skeleton" key={status} />)}
        </div>
      )}

      {state.status === 'error' && (
        <div className="admin-alert" role="alert">
          <div><strong>{t('admin.errors.loadTitle')}</strong><p>{t(state.error === 'permission' ? 'admin.errors.permission' : 'admin.errors.load')}</p></div>
          <button className="button button--secondary" onClick={retry} type="button">{t('common.retry')}</button>
        </div>
      )}

      {state.status === 'loaded' && (
        <>
          <div className="admin-summary-grid">
            {ADMIN_BUSINESS_STATUSES.map((status) => (
              <article className={`admin-summary-card admin-summary-card--${status}`} key={status}>
                <div className="admin-summary-card__heading">
                  <span aria-hidden="true" className="admin-summary-card__indicator" />
                  <h2>{t(`admin.status.${status}`)}</h2>
                </div>
                <strong>{state.counts[status] ?? 0}</strong>
                <p>{t(`admin.overview.support.${status}`)}</p>
                <Link to={`/admin/businesses?status=${status}`}>
                  {t('admin.overview.viewStatus', { status: t(`admin.status.${status}`) })} <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>

          <section className="admin-panel admin-recent" aria-labelledby="recent-submissions-title">
            <div className="admin-panel__heading">
              <div>
                <p className="admin-eyebrow">{t('admin.overview.queueEyebrow')}</p>
                <h2 id="recent-submissions-title">{t('admin.overview.recentTitle')}</h2>
                <p>{t('admin.overview.recentDescription')}</p>
              </div>
              <Link to="/admin/businesses?status=pending_review">{t('admin.overview.viewQueue')} <span aria-hidden="true">→</span></Link>
            </div>
            {state.recent.length === 0 ? (
              <div className="admin-empty admin-empty--compact">
                <strong>{t('admin.overview.recentEmptyTitle')}</strong>
                <p>{t('admin.overview.recentEmpty')}</p>
              </div>
            ) : (
              <ul className="admin-recent-list">
                {state.recent.map((business) => (
                  <li key={business.businessId}>
                    <span className="admin-business-logo">
                      {business.profilePhoto?.downloadUrl
                        ? <img alt="" src={business.profilePhoto.downloadUrl} />
                        : <span aria-hidden="true">{business.name?.charAt(0) || '?'}</span>}
                    </span>
                    <div>
                      <strong>{business.name || t('admin.common.notProvided')}</strong>
                      <span>{getBusinessCategoryLabel(business.primaryCategoryId, t) || t('admin.common.notProvided')} · {business.location?.locality || t('admin.common.notProvided')}</span>
                    </div>
                    <time>{dateText(business.submittedAt, i18n.resolvedLanguage)}</time>
                    <Link aria-label={t('admin.businesses.reviewNamed', { name: business.name })} to={`/admin/businesses/${business.businessId}`}>{t('admin.businesses.review')} <span aria-hidden="true">→</span></Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export default AdminOverviewPage
