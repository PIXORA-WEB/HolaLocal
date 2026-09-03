import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'
import {
  listSavedBusinessesPage,
  removeSavedBusiness,
} from '../../services/savedBusinessService.js'
import { getBusinessCategoryLabel } from '../../utils/business.js'

function SavedBusinessItem({ item, onRemove, removal }) {
  const { t } = useTranslation()
  const removing = removal?.status === 'removing'
  const name = item.available ? item.business.name : t('savedBusinesses.page.unavailable')
  const category = item.available && item.business.category
    ? getBusinessCategoryLabel(item.business.category, t)
    : ''

  return (
    <article className={`saved-business-card${item.available ? '' : ' is-unavailable'}`}>
      <div className="saved-business-card__body">
        <p className="saved-business-card__eyebrow">
          {item.available ? category || t('services.notSpecified') : t('savedBusinesses.page.unavailable')}
        </p>
        <h2>{name}</h2>
        <p>
          {item.available
            ? item.business.tagline || item.business.description || item.business.serviceArea
            : t('savedBusinesses.page.unavailableDescription')}
        </p>
      </div>
      <div className="saved-business-card__actions">
        {item.available && (
          <Link to={`/services/${encodeURIComponent(item.businessId)}`}>
            {t('savedBusinesses.page.openBusiness')}
          </Link>
        )}
        <button
          aria-busy={removing || undefined}
          aria-label={t('savedBusinesses.page.removeLabel', { name })}
          disabled={removing}
          onClick={() => onRemove(item.businessId)}
          type="button"
        >
          {removing ? t('savedBusinesses.removing') : t('savedBusinesses.remove')}
        </button>
      </div>
      {removal?.error && <p className="saved-business-card__error" role="alert">{removal.error}</p>}
    </article>
  )
}

function SavedBusinessesSession({ userId }) {
  const { t } = useTranslation()
  const requestRef = useRef(0)
  const [items, setItems] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [removals, setRemovals] = useState({})

  const loadPage = useCallback(async (cursor = null, replace = false) => {
    const requestId = ++requestRef.current
    setError('')
    setStatus(cursor ? 'loading-more' : 'loading')
    try {
      const page = await listSavedBusinessesPage({ cursor })
      if (requestId !== requestRef.current) return
      setItems((current) => {
        const existing = replace ? [] : current
        const seen = new Set(existing.map(({ businessId }) => businessId))
        return [...existing, ...page.items.filter(({ businessId }) => !seen.has(businessId))]
      })
      setNextCursor(page.nextCursor)
      setStatus('ready')
    } catch {
      if (requestId !== requestRef.current) return
      setError(t(cursor ? 'savedBusinesses.page.loadMoreError' : 'savedBusinesses.page.initialError'))
      setStatus(cursor ? 'load-more-failed' : 'error')
    }
  }, [t])

  useEffect(() => {
    const requestId = ++requestRef.current
    listSavedBusinessesPage()
      .then((page) => {
        if (requestId !== requestRef.current) return
        setItems(page.items)
        setNextCursor(page.nextCursor)
        setStatus('ready')
      })
      .catch(() => {
        if (requestId !== requestRef.current) return
        setError(t('savedBusinesses.page.initialError'))
        setStatus('error')
      })
    return () => { if (requestId === requestRef.current) requestRef.current += 1 }
  }, [t, userId])

  async function removeItem(businessId) {
    if (!userId || removals[businessId]?.status === 'removing') return
    setRemovals((current) => ({ ...current, [businessId]: { error: '', status: 'removing' } }))
    try {
      await removeSavedBusiness(userId, businessId)
      setItems((current) => current.filter((item) => item.businessId !== businessId))
      setRemovals((current) => {
        const next = { ...current }
        delete next[businessId]
        return next
      })
    } catch {
      setRemovals((current) => ({
        ...current,
        [businessId]: { error: t('savedBusinesses.removeFailed'), status: 'failed' },
      }))
    }
  }

  const initialLoading = status === 'loading' && items.length === 0
  const initialError = status === 'error' && items.length === 0

  return (
    <div className="saved-businesses-page">
      <header className="saved-businesses-page__header">
        <p className="account-card__eyebrow">{t('savedBusinesses.page.eyebrow')}</p>
        <h1>{t('savedBusinesses.page.title')}</h1>
        <p>{t('savedBusinesses.page.description')}</p>
      </header>

      {initialLoading && <p className="saved-businesses-page__state" role="status">{t('savedBusinesses.page.loading')}</p>}
      {initialError && (
        <div className="saved-businesses-page__state" role="alert">
          <p>{error}</p>
          <button onClick={() => void loadPage(null, true)} type="button">{t('savedBusinesses.retry')}</button>
        </div>
      )}
      {!initialLoading && !initialError && items.length === 0 && (
        <section className="saved-businesses-page__empty">
          <h2>{t('savedBusinesses.page.emptyTitle')}</h2>
          <p>{t('savedBusinesses.page.emptyDescription')}</p>
          <Link className="button button--primary" to="/services">{t('savedBusinesses.page.browseServices')}</Link>
        </section>
      )}
      {items.length > 0 && (
        <section aria-label={t('savedBusinesses.page.itemsLabel')}>
          <div className="saved-businesses-grid">
            {items.map((item) => (
              <SavedBusinessItem
                item={item}
                key={item.businessId}
                onRemove={(id) => void removeItem(id)}
                removal={removals[item.businessId]}
              />
            ))}
          </div>
          {(nextCursor || status === 'load-more-failed') && (
            <div className="saved-businesses-page__pagination">
              {status === 'load-more-failed' && <p role="alert">{error}</p>}
              <button
                aria-busy={status === 'loading-more' || undefined}
                disabled={status === 'loading-more' || !nextCursor}
                onClick={() => void loadPage(nextCursor)}
                type="button"
              >
                {status === 'loading-more'
                  ? t('savedBusinesses.page.loadingMore')
                  : status === 'load-more-failed'
                    ? t('savedBusinesses.retry')
                    : t('savedBusinesses.page.loadMore')}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function SavedBusinessesPage() {
  const { user } = useAuthentication()
  return <SavedBusinessesSession key={user?.uid} userId={user?.uid} />
}

export default SavedBusinessesPage
