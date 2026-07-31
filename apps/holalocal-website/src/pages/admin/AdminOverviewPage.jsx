import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ADMIN_BUSINESS_STATUSES, getBusinessStatusCounts } from '../../services/adminService.js'

function AdminOverviewPage() {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', counts: {}, attempt: 0 })

  useEffect(() => {
    let active = true
    getBusinessStatusCounts()
      .then((counts) => active && setState((current) => ({ ...current, counts, status: 'loaded' })))
      .catch((error) => active && setState((current) => ({
        ...current,
        error: error?.code === 'permission-denied' ? 'permission' : 'load',
        status: 'error',
      })))
    return () => { active = false }
  }, [state.attempt])

  return (
    <section className="admin-page" aria-labelledby="admin-overview-title">
      <header className="admin-page__heading">
        <p>{t('admin.overview.eyebrow')}</p>
        <h1 id="admin-overview-title">{t('admin.overview.title')}</h1>
        <p>{t('admin.overview.description')}</p>
      </header>
      {state.status === 'loading' && <p role="status">{t('admin.overview.loading')}</p>}
      {state.status === 'error' && (
        <div className="admin-alert" role="alert">
          <p>{t(state.error === 'permission' ? 'admin.errors.permission' : 'admin.errors.load')}</p>
          <button className="button button--secondary" onClick={() => setState((current) => ({ ...current, status: 'loading', attempt: current.attempt + 1 }))} type="button">
            {t('common.retry')}
          </button>
        </div>
      )}
      {state.status === 'loaded' && (
        <div className="admin-summary-grid">
          {ADMIN_BUSINESS_STATUSES.map((status) => (
            <article className="admin-summary-card" key={status}>
              <h2>{t(`admin.status.${status}`)}</h2>
              <strong>{state.counts[status] ?? 0}</strong>
              <Link to={`/admin/businesses?status=${status}`}>
                {t('admin.overview.viewStatus', { status: t(`admin.status.${status}`) })}
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default AdminOverviewPage
