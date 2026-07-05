import { Component } from 'react'
import { useTranslation } from 'react-i18next'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="application-error" role="main">
        <section className="auth-card" aria-labelledby="application-error-title">
          <div className="auth-card__heading">
            <p className="auth-card__eyebrow">HolaLocal</p>
            <h1 id="application-error-title">{this.props.title}</h1>
            <p>{this.props.description}</p>
          </div>
          <div className="application-error__actions">
            <button className="button button--primary" onClick={() => window.location.reload()} type="button">
              {this.props.reloadLabel}
            </button>
            <button className="button button--secondary" onClick={() => window.location.assign('/')} type="button">
              {this.props.homeLabel}
            </button>
          </div>
        </section>
      </main>
    )
  }
}

function ApplicationErrorBoundary({ children }) {
  const { t } = useTranslation()

  return (
    <ErrorBoundary
      description={t('errors.application.description')}
      homeLabel={t('errors.application.home')}
      reloadLabel={t('errors.application.reload')}
      title={t('errors.application.title')}
    >
      {children}
    </ErrorBoundary>
  )
}

export default ApplicationErrorBoundary
