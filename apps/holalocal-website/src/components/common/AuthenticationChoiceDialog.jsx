import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AccessibleDialog from './AccessibleDialog.jsx'

function AuthenticationChoiceDialog({ copy, onClose, open, returnLocation }) {
  const { t } = useTranslation()

  return (
    <AccessibleDialog
      ariaDescribedBy="authentication-choice-description"
      ariaLabelledBy="authentication-choice-title"
      className="profile-edit-dialog authentication-choice-dialog"
      onClose={onClose}
      open={open}
    >
      <section className="profile-edit-dialog__panel">
        <button
          aria-label={t('services.authPrompt.close')}
          className="authentication-choice-dialog__close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <p className="account-card__eyebrow">{t(copy.eyebrow)}</p>
        <h2 id="authentication-choice-title">{t(copy.title)}</h2>
        <p id="authentication-choice-description">{t(copy.description)}</p>
        <div className="authentication-choice-dialog__actions">
          <Link className="button button--primary" state={{ from: returnLocation }} to="/login">
            {t('auth.login')}
          </Link>
          <Link className="button button--secondary" state={{ from: returnLocation }} to="/register">
            {t('auth.register')}
          </Link>
        </div>
      </section>
    </AccessibleDialog>
  )
}

export default AuthenticationChoiceDialog
