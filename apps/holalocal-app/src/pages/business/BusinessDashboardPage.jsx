import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingScreen from '../../components/LoadingScreen.jsx'
import { getAuthenticationErrorMessage } from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import { ensureBusinessProfile } from '../../services/businessService.js'

function BusinessDashboardPage() {
  const { t } = useTranslation()
  const { user, userProfile } = useAuthentication()
  const [businessProfile, setBusinessProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadBusinessProfile() {
      try {
        const profile = await ensureBusinessProfile(user.uid, userProfile)
        if (active) setBusinessProfile(profile)
      } catch (loadError) {
        if (active) setError(getAuthenticationErrorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadBusinessProfile()

    return () => {
      active = false
    }
  }, [user.uid, userProfile])

  if (loading) return <LoadingScreen message="Loading your business profile…" />

  if (error) {
    return <p className="form-message form-message--error" role="alert">{error}</p>
  }

  if (!businessProfile?.profileCompleted) {
    return (
      <section className="business-dashboard">
        <p className="placeholder-page__eyebrow">Business account</p>
        <h1>Complete your business profile</h1>
        <p>Add the essential information customers will eventually use to understand your services.</p>

        <div className="business-status-card">
          <span>Profile status</span>
          <strong>Setup required</strong>
          <p>Your business profile is saved as a draft until the required details are completed.</p>
        </div>

        <Link className="button button--primary" to="/business/edit">
          Complete business profile
        </Link>
      </section>
    )
  }

  return (
    <section className="business-dashboard">
      <p className="placeholder-page__eyebrow">{t('business.dashboard')}</p>
      <h1>{businessProfile.businessName}</h1>

      <dl className="profile-details business-details">
        <div>
          <dt>Category</dt>
          <dd>{businessProfile.mainCategory}</dd>
        </div>
        <div>
          <dt>City</dt>
          <dd>{businessProfile.city}</dd>
        </div>
        <div>
          <dt>Profile status</dt>
          <dd>{businessProfile.profileCompleted ? 'Complete' : 'Incomplete'}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>{businessProfile.isVerified ? 'Verified' : 'Not verified'}</dd>
        </div>
        <div>
          <dt>Subscription</dt>
          <dd>{businessProfile.subscriptionTier}</dd>
        </div>
      </dl>

      <Link className="button button--secondary" to="/business/edit">
        {t('business.edit')}
      </Link>
    </section>
  )
}

export default BusinessDashboardPage
