import {Link,Navigate} from 'react-router-dom'
import {useTranslation} from 'react-i18next'
import useAuthentication from '../../hooks/useAuthentication.js'
import CustomerReviews from '../../components/reviews/CustomerReviews.jsx'
import {customerReviewsEnabled} from '../../utils/customerReviewsFlag.js'
import {customerReviewService} from '../../services/customerReviewService.js'
// Author status/withdrawal deliberately do not use CustomerRoute submission-eligibility restrictions.
export default function MyReviewsPage() {
  const {user,userProfile,loading}=useAuthentication()
  const {t}=useTranslation()
  if(!customerReviewsEnabled)return <Navigate replace to="/services"/>
  if(loading)return <p role="status">{t('common.loading')}</p>
  if(!user)return <div className="services-page"><p>{t('customerReviews.signIn')}</p><Link to="/login">{t('customerReviews.signInAction')}</Link></div>
  return <div className="services-page"><CustomerReviews key={user.uid} ownOnly api={customerReviewService} user={user} profile={userProfile}/></div>
}
