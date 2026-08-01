import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AccessibleDialog from '../../components/common/AccessibleDialog.jsx'
import {
  getAdminBusinessReview,
  moderateBusiness,
} from '../../services/adminService.js'
import { getBusinessCategoryLabel } from '../../utils/business.js'
import { getBusinessProfileCompletion } from '../../utils/businessCompletion.js'
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
const CONTACT_LABEL_KEYS = {
  email: 'business.form.contact.emailLabel',
  phone: 'business.form.contact.phone',
  website: 'business.form.contact.website',
  whatsapp: 'business.form.contact.showWhatsapp',
}

function dateText(value, language) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—'
}

function DetailList({ children, className = '' }) {
  return <dl className={`admin-detail-list ${className}`.trim()}>{children}</dl>
}

function Detail({ label, missingText, value }) {
  return <div><dt>{label}</dt><dd>{value || missingText}</dd></div>
}

function StatusBadge({ status, t }) {
  return <span className={`admin-status admin-status--${status}`}>{t(`admin.status.${status}`, { defaultValue: status })}</span>
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

  if (state.status === 'loading') {
    return (
      <section aria-live="polite" className="admin-page admin-review-loading" role="status">
        <span className="visually-hidden">{t('admin.review.loading')}</span>
        <div className="admin-review-loading__heading" />
        <div className="admin-review-loading__grid"><span /><span /></div>
      </section>
    )
  }
  if (state.status === 'error') {
    return (
      <section className="admin-page admin-state-page">
        <p className="admin-eyebrow">{t('admin.review.eyebrow')}</p>
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
  const completion = getBusinessProfileCompletion(business)
  const completedRequirements = completion.items.filter((item) => item.complete).length
  const visibleContacts = Object.entries(business.contact ?? {})
    .filter(([key, value]) => key.endsWith('Visible') && value)
    .map(([key]) => key.replace('Visible', ''))
    .map((key) => t(CONTACT_LABEL_KEYS[key], { defaultValue: key }))

  return (
    <article className="admin-page admin-review">
      <Link className="admin-back-link" to="/admin/businesses?status=pending_review">← {t('admin.review.back')}</Link>
      <header className="admin-review__header">
        <div className="admin-review__identity">
          {business.profilePhoto?.downloadUrl
            ? <img className="admin-review__logo" alt={t('admin.review.logoAlt', { name: business.name })} src={business.profilePhoto.downloadUrl} />
            : <span aria-hidden="true" className="admin-review__logo-fallback">{business.name?.charAt(0) || '?'}</span>}
          <div>
            <p className="admin-eyebrow">{t('admin.review.eyebrow')}</p>
            <h1>{business.name}</h1>
            <p>{business.tagline || t('admin.review.noTagline')}</p>
          </div>
        </div>
        <StatusBadge status={business.status} t={t} />
      </header>

      <p aria-live="polite" className="form-message admin-review__announcement" role="status">{announcement}</p>
      {!pending && <div className="admin-alert admin-alert--notice" role="status"><div><strong>{t('admin.review.statusChangedTitle')}</strong><p>{t('admin.review.alreadyReviewed')}</p></div></div>}

      <div className="admin-review__workspace">
        <div className="admin-review__content">
          <section className="admin-panel admin-review__section" aria-labelledby="public-profile-title">
            <div className="admin-panel__heading">
              <div><p className="admin-eyebrow">{t('admin.review.publicEyebrow')}</p><h2 id="public-profile-title">{t('admin.review.publicProfile')}</h2></div>
            </div>

            <div className="admin-review__description">
              <h3>{t('admin.review.description')}</h3>
              <p>{business.description || t('admin.common.notProvided')}</p>
            </div>

            <div className="admin-review__facts-grid">
              <section>
                <h3>{t('admin.review.services')}</h3>
                <DetailList>
                  <Detail label={t('admin.review.category')} missingText={t('admin.common.notProvided')} value={getBusinessCategoryLabel(business.primaryCategoryId, t)} />
                  <Detail label={t('admin.review.services')} missingText={t('admin.common.notProvided')} value={(business.categoryIds ?? []).map((item) => getBusinessCategoryLabel(item, t)).join(', ')} />
                </DetailList>
              </section>
              <section>
                <h3>{t('admin.review.coverage')}</h3>
                <DetailList>
                  <Detail label={t('admin.review.location')} missingText={t('admin.common.notProvided')} value={[business.location?.locality, business.location?.region, business.location?.countryCode].filter(Boolean).join(', ')} />
                  <Detail label={t('admin.review.serviceAreas')} missingText={t('admin.common.notProvided')} value={(business.serviceAreas ?? []).map((item) => getServiceAreaLabel(item, t)).join(', ')} />
                </DetailList>
              </section>
              <section>
                <h3>{t('admin.review.communication')}</h3>
                <DetailList>
                  <Detail label={t('admin.review.languages')} missingText={t('admin.common.notProvided')} value={(business.languages ?? []).map(getLanguageNameFromCode).join(', ')} />
                  <Detail label={t('admin.review.contact')} missingText={t('admin.common.notProvided')} value={visibleContacts.join(', ') || t('admin.review.platformOnly')} />
                </DetailList>
              </section>
              <section>
                <h3>{t('admin.review.publication')}</h3>
                <DetailList>
                  <Detail label={t('admin.review.published')} missingText={t('admin.common.notProvided')} value={dateText(business.publishedAt, i18n.resolvedLanguage)} />
                  <Detail label={t('admin.review.verification')} missingText={t('admin.common.notProvided')} value={t(`business.control.verification.${business.verificationStatus}`, { defaultValue: business.verificationStatus })} />
                </DetailList>
              </section>
            </div>
          </section>

          <section className="admin-panel admin-review__section" aria-labelledby="checklist-title">
            <div className="admin-panel__heading">
              <div><p className="admin-eyebrow">{t('admin.review.readinessEyebrow')}</p><h2 id="checklist-title">{t('admin.review.checklist')}</h2></div>
              <div className="admin-completion-summary">
                <strong>{t('admin.review.requirementsPresent', { complete: completedRequirements, total: completion.items.length })}</strong>
                <span>{t('admin.review.profileCompleteness', { percentage: completion.percentage })}</span>
              </div>
            </div>
            <ul className="admin-review-checklist">
              {completion.items.map((item) => (
                <li className={item.complete ? 'is-complete' : 'is-incomplete'} key={item.key}>
                  <span aria-hidden="true">{item.complete ? '✓' : '!'}</span>
                  <span>{t(`business.control.checklist.${item.key}`)}</span>
                  <strong>{t(item.complete ? 'admin.review.checkPassed' : 'admin.review.checkAttention')}</strong>
                </li>
              ))}
            </ul>
            <p className="admin-panel__note">{t('admin.review.checklistNote')}</p>
          </section>

          <section className="admin-panel admin-review__section" aria-labelledby="gallery-title">
            <div className="admin-panel__heading"><div><p className="admin-eyebrow">{t('admin.review.mediaEyebrow')}</p><h2 id="gallery-title">{t('admin.review.gallery')}</h2></div><span>{t('admin.review.imageCount', { count: gallery.length })}</span></div>
            {gallery.length === 0 ? <div className="admin-empty admin-empty--compact"><p>{t('admin.review.noGallery')}</p></div> : (
              <div className="admin-review__gallery">{gallery.map((image, index) => <img alt={t('admin.review.galleryAlt', { index: index + 1, name: business.name })} key={image.storagePath ?? image.downloadUrl} loading="lazy" src={image.downloadUrl} />)}</div>
            )}
          </section>
        </div>

        <aside className="admin-moderation-panel" aria-labelledby="moderation-title">
          <div className="admin-moderation-panel__heading">
            <div><p className="admin-eyebrow">{t('admin.review.moderationEyebrow')}</p><h2 id="moderation-title">{t('admin.review.moderation')}</h2></div>
            <StatusBadge status={business.status} t={t} />
          </div>

          <DetailList className="admin-detail-list--stacked">
            <Detail label={t('admin.review.submitted')} missingText={t('admin.common.notProvided')} value={dateText(business.submittedAt, i18n.resolvedLanguage)} />
            <Detail label={t('admin.review.ownerName')} missingText={t('admin.common.notProvided')} value={owner.displayName} />
            <Detail label={t('admin.review.ownerEmail')} missingText={t('admin.common.notProvided')} value={owner.email} />
            <Detail label={t('admin.review.ownerLocale')} missingText={t('admin.common.notProvided')} value={owner.preferredLocale} />
          </DetailList>

          {privateModeration.currentRejection && (
            <div className="admin-previous-guidance">
              <strong>{t('admin.review.previousGuidance')}</strong>
              <p>{privateModeration.currentRejection.guidance}</p>
            </div>
          )}

          {pending && (
            <div className="admin-decision-section">
              <div className="admin-publishing-note">
                <strong>{t('admin.review.decisionHeading')}</strong>
                <p>{t('admin.review.decisionHelp')}</p>
                <p>{t('admin.review.publishNotVerify')}</p>
              </div>
              <div className="admin-review__actions">
                <button className="button button--primary" onClick={() => setDialog('approve')} type="button">{t('admin.review.approve')}</button>
                <button className="button button--danger" onClick={() => setDialog('reject')} type="button">{t('admin.review.reject')}</button>
              </div>
            </div>
          )}

          <section className="admin-history-section" aria-labelledby="history-title">
            <h3 id="history-title">{t('admin.review.history')}</h3>
            {history.length === 0 ? <p className="admin-history-empty">{t('admin.review.noHistory')}</p> : (
              <ol className="admin-history">
                {history.map((event) => (
                  <li key={event.eventId}>
                    <span aria-hidden="true" />
                    <div><strong>{t(`admin.actions.${event.action}`)}</strong><time>{dateText(event.createdAt, i18n.resolvedLanguage)}</time><p>{t(`admin.status.${event.previousStatus}`, { defaultValue: event.previousStatus })} → {t(`admin.status.${event.newStatus}`, { defaultValue: event.newStatus })}</p>{event.guidance && <blockquote>{event.guidance}</blockquote>}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <details className="admin-technical-details">
            <summary>{t('admin.review.technicalDetails')}</summary>
            <DetailList className="admin-detail-list--stacked">
              <Detail label={t('admin.review.businessId')} missingText={t('admin.common.notProvided')} value={business.businessId} />
              <Detail label={t('admin.review.ownerUid')} missingText={t('admin.common.notProvided')} value={owner.uid} />
            </DetailList>
          </details>
        </aside>
      </div>

      <AccessibleDialog ariaDescribedBy="approve-description" ariaLabelledBy="approve-title" closeDisabled={decisionPending} onClose={closeDialog} open={dialog === 'approve'}>
        <div className="admin-dialog">
          <span aria-hidden="true" className="admin-dialog__icon admin-dialog__icon--approve">✓</span>
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
          <span aria-hidden="true" className="admin-dialog__icon admin-dialog__icon--reject">!</span>
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
            <button className="button button--danger" disabled={decisionPending} type="submit">{t(decisionPending ? 'admin.review.processing' : 'admin.review.reject')}</button>
          </div>
        </form>
      </AccessibleDialog>
    </article>
  )
}

export default AdminBusinessReviewPage
