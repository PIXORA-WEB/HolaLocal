import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AccessibleDialog from '../../components/common/AccessibleDialog.jsx'
import {
  getAdminBusinessReview,
  moderateBusiness,
} from '../../services/adminService.js'
import { getBusinessCategoryLabel } from '../../utils/business.js'
import { getLanguageNameFromCode } from '../../utils/languages.js'
import { getServiceAreaLabel } from '../../utils/locations.js'

const REASON_CODES = [
  'incomplete_profile',
  'unclear_service_information',
  'location_or_service_area',
  'contact_information',
  'logo_or_gallery',
  'unsupported_or_inappropriate_content',
  'other',
]
const GUIDANCE_MIN = 20
const GUIDANCE_MAX = 2000

function dateText(value, language) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—'
}

function DetailList({ children }) {
  return <dl className="admin-detail-list">{children}</dl>
}

function Detail({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || '—'}</dd></div>
}

function callableMessageKey(error) {
  const detail = error?.message ?? ''
  if (error?.code?.includes('permission-denied')) return 'admin.errors.permission'
  if (error?.code?.includes('unauthenticated')) return 'admin.errors.session'
  if (error?.code?.includes('not-found')) return 'admin.review.notFound'
  if (detail.includes('business-publication-ineligible')) return 'admin.errors.ineligible'
  if (detail.includes('invalid-business-status-transition')) return 'admin.errors.stale'
  return 'admin.errors.decision'
}

function AdminBusinessReviewPage() {
  const { businessId } = useParams()
  const { i18n, t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', review: null, attempt: 0 })
  const [dialog, setDialog] = useState(null)
  const [reasonCode, setReasonCode] = useState('')
  const [guidance, setGuidance] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [decisionPending, setDecisionPending] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const requestIdRef = useRef(null)

  async function loadReview() {
    try {
      const review = await getAdminBusinessReview(businessId)
      setState((current) => ({ ...current, review, status: 'loaded' }))
    } catch (error) {
      const type = error?.code?.includes('not-found')
        ? 'not-found'
        : error?.code?.includes('permission-denied') ? 'permission' : 'load'
      setState((current) => ({ ...current, error: type, status: 'error' }))
    }
  }

  useEffect(() => {
    let active = true
    getAdminBusinessReview(businessId)
      .then((review) => active && setState((current) => ({ ...current, review, status: 'loaded' })))
      .catch((error) => {
        if (!active) return
        const type = error?.code?.includes('not-found')
          ? 'not-found'
          : error?.code?.includes('permission-denied') ? 'permission' : 'load'
        setState((current) => ({ ...current, error: type, status: 'error' }))
      })
    return () => { active = false }
  }, [businessId, state.attempt])

  function closeDialog() {
    if (decisionPending) return
    setDialog(null)
    setFieldErrors({})
    requestIdRef.current = null
  }

  async function submitDecision(operation) {
    if (decisionPending) return
    if (operation === 'reject') {
      const errors = {}
      if (!REASON_CODES.includes(reasonCode)) errors.reasonCode = t('admin.reject.reasonRequired')
      const length = guidance.trim().length
      if (length < GUIDANCE_MIN || length > GUIDANCE_MAX) {
        errors.guidance = t('admin.reject.guidanceLength', { min: GUIDANCE_MIN, max: GUIDANCE_MAX })
      }
      setFieldErrors(errors)
      if (Object.keys(errors).length > 0) return
    }
    requestIdRef.current ??= crypto.randomUUID().replaceAll('-', '')
    setDecisionPending(true)
    setAnnouncement('')
    try {
      await moderateBusiness({
        businessId,
        operation,
        reasonCode,
        guidance: guidance.trim(),
        requestId: requestIdRef.current,
      })
      setDialog(null)
      setAnnouncement(t(operation === 'publish' ? 'admin.review.approved' : 'admin.review.rejected'))
      requestIdRef.current = null
      await loadReview()
    } catch (error) {
      setAnnouncement(t(callableMessageKey(error)))
      if ((error?.message ?? '').includes('invalid-business-status-transition')) await loadReview()
    } finally {
      setDecisionPending(false)
    }
  }

  if (state.status === 'loading') return <p className="admin-page" role="status">{t('admin.review.loading')}</p>
  if (state.status === 'error') {
    return (
      <section className="admin-page">
        <h1>{t(state.error === 'not-found' ? 'admin.review.notFoundTitle' : 'admin.review.loadErrorTitle')}</h1>
        <p role="alert">{t(state.error === 'permission' ? 'admin.errors.permission' : state.error === 'not-found' ? 'admin.review.notFound' : 'admin.errors.load')}</p>
        {state.error !== 'not-found' && <button className="button button--secondary" onClick={() => setState((current) => ({ ...current, status: 'loading', attempt: current.attempt + 1 }))} type="button">{t('common.retry')}</button>}
      </section>
    )
  }

  const { business, history, owner, privateModeration } = state.review
  const gallery = business.galleryImages?.length
    ? business.galleryImages
    : (business.galleryImageURLs ?? []).map((downloadUrl) => ({ downloadUrl }))
  const pending = business.status === 'pending_review'

  return (
    <article className="admin-page admin-review">
      <Link to="/admin/businesses?status=pending_review">{t('admin.review.back')}</Link>
      <header className="admin-page__heading">
        <p>{t('admin.review.eyebrow')}</p>
        <h1>{business.name}</h1>
        <p><span className={`admin-status admin-status--${business.status}`}>{t(`admin.status.${business.status}`, { defaultValue: business.status })}</span></p>
      </header>
      <p aria-live="polite" className="form-message" role="status">{announcement}</p>
      {!pending && <div className="admin-alert" role="status"><p>{t('admin.review.alreadyReviewed')}</p></div>}

      <section className="admin-review__section" aria-labelledby="public-profile-title">
        <h2 id="public-profile-title">{t('admin.review.publicProfile')}</h2>
        {business.profilePhoto?.downloadUrl && <img className="admin-review__logo" alt={t('admin.review.logoAlt', { name: business.name })} src={business.profilePhoto.downloadUrl} />}
        <DetailList>
          <Detail label={t('admin.review.tagline')} value={business.tagline} />
          <Detail label={t('admin.review.description')} value={business.description} />
          <Detail label={t('admin.review.category')} value={getBusinessCategoryLabel(business.primaryCategoryId, t)} />
          <Detail label={t('admin.review.services')} value={(business.categoryIds ?? []).map((item) => getBusinessCategoryLabel(item, t)).join(', ')} />
          <Detail label={t('admin.review.location')} value={[business.location?.locality, business.location?.region, business.location?.countryCode].filter(Boolean).join(', ')} />
          <Detail label={t('admin.review.serviceAreas')} value={(business.serviceAreas ?? []).map((item) => getServiceAreaLabel(item, t)).join(', ')} />
          <Detail label={t('admin.review.languages')} value={(business.languages ?? []).map(getLanguageNameFromCode).join(', ')} />
          <Detail label={t('admin.review.contact')} value={Object.entries(business.contact ?? {}).filter(([key, value]) => key.endsWith('Visible') && value).map(([key]) => key.replace('Visible', '')).join(', ') || t('admin.review.platformOnly')} />
          <Detail label={t('admin.review.published')} value={dateText(business.publishedAt, i18n.resolvedLanguage)} />
        </DetailList>
        {gallery.length > 0 && <div className="admin-review__gallery">{gallery.map((image, index) => <img alt={t('admin.review.galleryAlt', { index: index + 1, name: business.name })} key={image.storagePath ?? image.downloadUrl} src={image.downloadUrl} />)}</div>}
      </section>

      <section className="admin-review__section" aria-labelledby="moderation-title">
        <h2 id="moderation-title">{t('admin.review.moderation')}</h2>
        <DetailList>
          <Detail label={t('admin.review.businessId')} value={business.businessId} />
          <Detail label={t('admin.review.ownerUid')} value={owner.uid} />
          <Detail label={t('admin.review.ownerName')} value={owner.displayName} />
          <Detail label={t('admin.review.ownerEmail')} value={owner.email} />
          <Detail label={t('admin.review.ownerLocale')} value={owner.preferredLocale} />
          <Detail label={t('admin.review.submitted')} value={dateText(business.submittedAt, i18n.resolvedLanguage)} />
          {privateModeration.currentRejection && <Detail label={t('admin.review.previousGuidance')} value={privateModeration.currentRejection.guidance} />}
        </DetailList>
      </section>

      <section className="admin-review__section" aria-labelledby="history-title">
        <h2 id="history-title">{t('admin.review.history')}</h2>
        {history.length === 0 ? <p>{t('admin.review.noHistory')}</p> : (
          <ol className="admin-history">
            {history.map((event) => <li key={event.eventId}><strong>{t(`admin.actions.${event.action}`)}</strong> — {dateText(event.createdAt, i18n.resolvedLanguage)} ({event.previousStatus} → {event.newStatus}){event.guidance && <p>{event.guidance}</p>}</li>)}
          </ol>
        )}
      </section>

      {pending && <div className="admin-review__actions">
        <button className="button button--primary" onClick={() => setDialog('approve')} type="button">{t('admin.review.approve')}</button>
        <button className="button button--secondary" onClick={() => setDialog('reject')} type="button">{t('admin.review.reject')}</button>
      </div>}

      <AccessibleDialog ariaDescribedBy="approve-description" ariaLabelledBy="approve-title" closeDisabled={decisionPending} onClose={closeDialog} open={dialog === 'approve'}>
        <div className="admin-dialog">
          <h2 id="approve-title">{t('admin.approve.title')}</h2>
          <p id="approve-description">{t('admin.approve.description', { name: business.name })}</p>
          <div className="admin-dialog__actions">
            <button autoFocus className="button button--secondary" disabled={decisionPending} onClick={closeDialog} type="button">{t('common.cancel')}</button>
            <button className="button button--primary" disabled={decisionPending} onClick={() => void submitDecision('publish')} type="button">{t(decisionPending ? 'admin.review.processing' : 'admin.review.approve')}</button>
          </div>
        </div>
      </AccessibleDialog>

      <AccessibleDialog ariaDescribedBy="reject-description" ariaLabelledBy="reject-title" closeDisabled={decisionPending} onClose={closeDialog} open={dialog === 'reject'}>
        <form className="admin-dialog" onSubmit={(event) => { event.preventDefault(); void submitDecision('reject') }}>
          <h2 id="reject-title">{t('admin.reject.title')}</h2>
          <p id="reject-description">{t('admin.reject.description')}</p>
          <label htmlFor="rejection-reason">{t('admin.reject.reason')}</label>
          <select aria-describedby={fieldErrors.reasonCode ? 'rejection-reason-error' : undefined} aria-invalid={Boolean(fieldErrors.reasonCode)} autoFocus id="rejection-reason" onChange={(event) => setReasonCode(event.target.value)} value={reasonCode}>
            <option value="">{t('admin.reject.selectReason')}</option>
            {REASON_CODES.map((code) => <option key={code} value={code}>{t(`rejection.reason.${code}`)}</option>)}
          </select>
          {fieldErrors.reasonCode && <p className="form-field-error" id="rejection-reason-error">{fieldErrors.reasonCode}</p>}
          <label htmlFor="rejection-guidance">{t('admin.reject.guidance')}</label>
          <textarea aria-describedby={`rejection-guidance-help${fieldErrors.guidance ? ' rejection-guidance-error' : ''}`} aria-invalid={Boolean(fieldErrors.guidance)} id="rejection-guidance" maxLength={GUIDANCE_MAX} minLength={GUIDANCE_MIN} onChange={(event) => setGuidance(event.target.value)} rows="7" value={guidance} />
          <p id="rejection-guidance-help">{t('admin.reject.guidanceHelp', { min: GUIDANCE_MIN, max: GUIDANCE_MAX })}</p>
          {fieldErrors.guidance && <p className="form-field-error" id="rejection-guidance-error">{fieldErrors.guidance}</p>}
          <div className="admin-dialog__actions">
            <button className="button button--secondary" disabled={decisionPending} onClick={closeDialog} type="button">{t('common.cancel')}</button>
            <button className="button button--primary" disabled={decisionPending} type="submit">{t(decisionPending ? 'admin.review.processing' : 'admin.review.reject')}</button>
          </div>
        </form>
      </AccessibleDialog>
    </article>
  )
}

export default AdminBusinessReviewPage
