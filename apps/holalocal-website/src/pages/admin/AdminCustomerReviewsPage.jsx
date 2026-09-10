import '../../i18n/registerAdminCustomerReviewTranslations.js'
import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {useTranslation} from 'react-i18next'
import {onIdTokenChanged} from 'firebase/auth'
import {getFirebaseAuth} from '../../firebase/auth.js'
import useAuthentication from '../../hooks/useAuthentication.js'
import {authorizeAdminReviewUser} from '../../utils/adminCustomerReviewModel.js'
import {customerReviewsEnabled} from '../../utils/customerReviewsFlag.js'
import {adminCustomerReviewService} from '../../services/adminCustomerReviewService.js'
import CustomerReviewModeration from '../../components/admin/CustomerReviewModeration.jsx'

export default function AdminCustomerReviewsPage({reports=false}){
  const {user}=useAuthentication(),{t}=useTranslation()
  const [access,setAccess]=useState(null)
  useEffect(()=>{
    if(!customerReviewsEnabled||!user)return
    let active=true,sequence=0
    const inspect=async(current,force=false)=>{
      const version=++sequence
      try{const token=await current?.getIdTokenResult(force);if(active&&version===sequence)setAccess({uid:current?.uid,admin:token?.claims?.admin===true})}
      catch{if(active&&version===sequence)setAccess(null)}
    }
    const unsubscribe=onIdTokenChanged(getFirebaseAuth(),current=>void inspect(current))
    const refresh=()=>void inspect(getFirebaseAuth().currentUser,true)
    window.addEventListener('focus',refresh)
    return()=>{active=false;sequence++;unsubscribe();window.removeEventListener('focus',refresh)}
  },[user])
  const api=useMemo(()=>adminCustomerReviewService(()=>authorizeAdminReviewUser(user,()=>getFirebaseAuth().currentUser)),[user])
  if(!customerReviewsEnabled)return <p role="status">{t('adminCustomerReviews.unavailable')}</p>
  if(!user||access?.uid!==user.uid||!access.admin)return <p role="status">{t('admin.access.denied')}</p>
  return <div className="admin-review-workspace"><nav aria-label={t('adminCustomerReviews.title')}><Link className="button button--secondary" to="/admin/customer-reviews">{t('adminCustomerReviews.title')}</Link>{' '}<Link className="button button--secondary" to="/admin/customer-review-reports">{t('adminCustomerReviews.reports')}</Link></nav><CustomerReviewModeration key={`${user.uid}:${reports}`} api={api} reports={reports}/></div>
}
