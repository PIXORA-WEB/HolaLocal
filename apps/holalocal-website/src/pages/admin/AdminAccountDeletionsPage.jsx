import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccessibleDialog from '../../components/common/AccessibleDialog.jsx'
import {
  finalizeAccountDeletion,
  listAccountDeletionRequests,
} from '../../services/adminAccountDeletionService.js'

function safeCode(value) {
  const allowed = new Set([
    'owned-businesses', 'ownership-integrity-conflict', 'profile-integrity-conflict',
    'ownership_blocked', 'ownership_integrity_conflict', 'manager_relationship_integrity_conflict',
    'conversation_integrity_conflict', 'profile_media_cleanup_failed', 'consent_evidence_invalid',
    'user_evidence_minimization_failed', 'firebase_auth_deletion_failed', 'workflow_state_conflict',
    'internal_retryable',
  ])
  return allowed.has(value) ? value : 'generic'
}

function errorKind(error) {
  const message = String(error?.message ?? '')
  if (error?.code === 'functions/aborted' || message.includes('stale-request-version')) return 'stale'
  if (message.includes('account-deletion-lease-active')) return 'lease'
  if (error?.code === 'functions/permission-denied') return 'permission'
  return 'generic'
}

function dateText(value, language) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—'
}

function AdminAccountDeletionsPage() {
  const { i18n, t } = useTranslation()
  const [history, setHistory] = useState(false)
  const [view, setView] = useState({ status: 'loading', requests: [] })
  const [selected, setSelected] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const result = await listAccountDeletionRequests({ includeHistory: history })
      setView({ status: 'loaded', requests: result?.requests ?? [], operationalHasMore: result?.operationalHasMore === true, historyHasMore: result?.historyHasMore === true })
      setSelected((current) => current
        ? (result?.requests ?? []).find((item) => item.uid === current.uid) ?? null
        : null)
    } catch (error) {
      setView({ status: 'error', requests: [], error: errorKind(error) })
    }
  }, [history])

  useEffect(() => {
    let active = true
    listAccountDeletionRequests({ includeHistory: history }).then((result) => {
      if (active) setView({ status: 'loaded', requests: result?.requests ?? [], operationalHasMore: result?.operationalHasMore === true, historyHasMore: result?.historyHasMore === true })
    }).catch((error) => {
      if (active) setView({ status: 'error', requests: [], error: errorKind(error) })
    })
    return () => { active = false }
  }, [history])

  async function runFinalization() {
    if (!selected?.canFinalize || submitting) return
    setSubmitting(true)
    setNotice(null)
    try {
      const result = await finalizeAccountDeletion(selected.uid, selected.requestVersion)
      if (result?.blockerCode) setNotice({ type: 'blocker', code: safeCode(result.blockerCode) })
      else if (result?.state === 'failed_retryable') setNotice({ type: 'failure', code: safeCode(result.failureCode) })
      else setNotice({ type: 'success', code: result?.state === 'completed' ? 'completed' : 'updated' })
    } catch (error) {
      setNotice({ type: 'error', code: errorKind(error) })
    } finally {
      setConfirming(false)
      setSubmitting(false)
      await refresh()
    }
  }

  const actionLabel = selected?.state === 'failed_retryable'
    || selected?.actionReason === 'expired-finalizer-lease'
    ? t('admin.deletions.retry') : t('admin.deletions.finalize')

  return (
    <section aria-labelledby="admin-deletions-title" className="admin-page admin-deletions">
      <header className="admin-page__heading admin-page__heading--split">
        <div><p className="admin-eyebrow">{t('admin.deletions.eyebrow')}</p><h1 id="admin-deletions-title">{t('admin.deletions.title')}</h1><p>{t('admin.deletions.description')}</p></div>
        <button aria-pressed={history} className="button button--secondary" onClick={() => { setView((current) => ({ ...current, status: 'loading' })); setHistory((value) => !value) }} type="button">{t('admin.deletions.history')}</button>
      </header>

      {notice && <p aria-live="polite" className={`alert alert--${notice.type}`}>{t(`admin.deletions.notice.${notice.code}`, { defaultValue: t('admin.deletions.notice.generic') })}</p>}
      {view.status === 'loading' && <p role="status">{t('admin.deletions.loading')}</p>}
      {view.status === 'error' && <div role="alert"><p>{t(`admin.deletions.notice.${view.error}`)}</p><button className="button button--secondary" onClick={() => void refresh()} type="button">{t('common.retry')}</button></div>}
      {view.status === 'loaded' && view.operationalHasMore && <p className="alert alert--warning" role="status">{t('admin.deletions.operationalOverflow')}</p>}
      {view.status === 'loaded' && history && view.historyHasMore && <p className="alert alert--warning" role="status">{t('admin.deletions.historyOverflow')}</p>}
      {view.status === 'loaded' && view.requests.length === 0 && <p>{t('admin.deletions.empty')}</p>}
      {view.status === 'loaded' && view.requests.length > 0 && (
        <div className="admin-deletion-list">
          {view.requests.map((request) => (
            <button className="admin-deletion-card" key={request.uid} onClick={() => setSelected(request)} type="button">
              <span><strong>{t(`admin.deletions.state.${request.state}`)}</strong><small>{dateText(request.requestedAt, i18n.language)}</small></span>
              <code>{request.uid}</code><span>{t('admin.deletions.version', { version: request.requestVersion })}</span>
            </button>
          ))}
        </div>
      )}

      <AccessibleDialog ariaLabelledBy="deletion-detail-title" className="admin-action-dialog" onClose={() => setSelected(null)} open={Boolean(selected) && !confirming}>
        {selected && <div className="admin-action-dialog__panel">
          <h2 id="deletion-detail-title">{t('admin.deletions.detail')}</h2>
          <dl><dt>{t('admin.deletions.identifier')}</dt><dd><code>{selected.uid}</code></dd><dt>{t('admin.deletions.status')}</dt><dd>{t(`admin.deletions.state.${selected.state}`)}</dd><dt>{t('admin.deletions.requestedAt')}</dt><dd>{dateText(selected.requestedAt, i18n.language)}</dd><dt>{t('admin.deletions.versionLabel')}</dt><dd>{selected.requestVersion}</dd><dt>{t('admin.deletions.checkpoint')}</dt><dd>{selected.lastCompletedStep ? t(`admin.deletions.checkpoints.${selected.lastCompletedStep}`) : '—'}</dd>{selected.failureCode && <><dt>{t('admin.deletions.failure')}</dt><dd>{t(`admin.deletions.codes.${safeCode(selected.failureCode)}`)}</dd></>}</dl>
          {selected.cleanupCounts && <p>{t('admin.deletions.cleanup', selected.cleanupCounts)}</p>}
          {selected.state === 'finalizing' && !selected.canFinalize && <p role="status">{t('admin.deletions.inProgress')}</p>}
          {selected.actionReason === 'expired-finalizer-lease' && <p role="status">{t('admin.deletions.resumeAvailable')}</p>}
          {selected.canFinalize && <button className="button button--danger" onClick={() => setConfirming(true)} type="button">{actionLabel}</button>}
          <button className="button button--secondary" onClick={() => setSelected(null)} type="button">{t('common.close')}</button>
        </div>}
      </AccessibleDialog>

      <AccessibleDialog ariaDescribedBy="deletion-confirm-description" ariaLabelledBy="deletion-confirm-title" closeDisabled={submitting} className="admin-action-dialog" onClose={() => setConfirming(false)} open={confirming}>
        <div className="admin-action-dialog__panel"><h2 id="deletion-confirm-title">{actionLabel}</h2><p id="deletion-confirm-description">{t('admin.deletions.confirmation')}</p><p>{t('admin.deletions.historyPreserved')}</p><button autoFocus className="button button--secondary" disabled={submitting} onClick={() => setConfirming(false)} type="button">{t('common.cancel')}</button><button className="button button--danger" disabled={submitting} onClick={() => void runFinalization()} type="button">{submitting ? t('admin.deletions.processing') : actionLabel}</button></div>
      </AccessibleDialog>
    </section>
  )
}

export default AdminAccountDeletionsPage
