import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { businessReportReasons } from '../../services/reportService.js'
import AccessibleDialog from './AccessibleDialog.jsx'

function BusinessReportDialog({ business, error, onClose, onSubmit, open, submitting, success }) {
  const { t } = useTranslation()
  const [details, setDetails] = useState('')
  const [reason, setReason] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit({ details, reason })
  }

  function handleClose() {
    setDetails('')
    setReason('')
    onClose()
  }

  return (
    <AccessibleDialog
      ariaLabelledBy="business-report-title"
      className="profile-edit-dialog report-dialog"
      closeDisabled={submitting}
      onClose={handleClose}
      open={open}
    >
      <div className="profile-edit-dialog__panel">
        <header className="profile-edit-dialog__header">
          <div>
            <p className="account-card__eyebrow">{t('reports.eyebrow')}</p>
            <h2 id="business-report-title">{t('reports.title', { name: business?.name })}</h2>
          </div>
          <button aria-label={t('reports.close')} disabled={submitting} onClick={handleClose} type="button">×</button>
        </header>

        {success ? (
          <div className="report-dialog__success" role="status">
            <span aria-hidden="true">✓</span>
            <h3>{t('reports.submitted')}</h3>
            <p>{t('reports.submittedDescription')}</p>
            <button className="button button--primary" onClick={handleClose} type="button">{t('common.done')}</button>
          </div>
        ) : (
          <form className="auth-form report-form" onSubmit={handleSubmit}>
            <p>{t('reports.description')}</p>

            <fieldset className="report-form__reasons">
              <legend>{t('reports.reasonLegend')}</legend>
              {businessReportReasons.map((option) => (
                <label key={option.value}>
                  <input
                    checked={reason === option.value}
                    name="report-reason"
                    onChange={() => setReason(option.value)}
                    required
                    type="radio"
                    value={option.value}
                  />
                  <span>{t(`reports.reasons.${option.value}`)}</span>
                </label>
              ))}
            </fieldset>

            <label>
              <span>{t('reports.details')} <small>({t('common.optional')})</small></span>
              <textarea
                maxLength="2000"
                onChange={(event) => setDetails(event.target.value)}
                placeholder={t('reports.detailsPlaceholder')}
                rows="5"
                value={details}
              />
            </label>

            <p className="report-form__support-note">
              {t('reports.supportPrefix')}{' '}
              <a href="mailto:hello@holalocal.es">hello@holalocal.es</a>.
            </p>
            {error && <p className="form-message form-message--error" role="alert">{error}</p>}
            <div className="profile-edit-form__actions">
              <button className="button button--secondary" disabled={submitting} onClick={handleClose} type="button">{t('common.cancel')}</button>
              <button className="button button--primary" disabled={submitting || !reason} type="submit">
                {submitting ? t('reports.submitting') : t('reports.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </AccessibleDialog>
  )
}

export default BusinessReportDialog
