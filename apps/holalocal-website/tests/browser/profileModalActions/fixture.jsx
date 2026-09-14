import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import i18n, { loadLocale } from '../../../src/i18n/index.js'
import ProfilePage from '../../../src/pages/customer/ProfilePage.jsx'
import AnalyticsConsent from '../../../src/components/common/AnalyticsConsent.jsx'
import BusinessReportDialog from '../../../src/components/common/BusinessReportDialog.jsx'
import { ANALYTICS_CHOICE_KEY } from '../../../src/services/analyticsConsent.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
if(new URLSearchParams(location.search).has('hidden')) localStorage.setItem(ANALYTICS_CHOICE_KEY,'rejected')
const locale = new URLSearchParams(location.search).get('locale') ?? 'de'
await loadLocale(locale)
await i18n.changeLanguage(locale)
window.h={user:{uid:'synthetic-user',email:'synthetic@example.invalid',emailVerified:true},profile:{uid:'synthetic-user',firstName:'Anna',lastName:'Mustermann',displayName:'Anna Mustermann',city:'Marbella',country:'Deutschland',preferredLocale:'de',roles:['customer'],accountStatus:'active',profileCompleted:true,onboardingCompleted:true},t:key=>i18n.t(key),calls:[],save:updates=>{window.h.calls.push(updates);return new Promise((resolve,reject)=>{window.h.resolveSave=resolve;window.h.rejectSave=()=>reject(Object.assign(new Error('synthetic failure'),{code:'unavailable'}))})}}
export function Fixture(){
 const [report,setReport]=useState(false)
 return <BrowserRouter><AnalyticsConsent/><ProfilePage/><button id="report-open" onClick={()=>setReport(true)}>Synthetic report</button><BusinessReportDialog business={{name:'Synthetic Business'}} open={report} onClose={()=>setReport(false)} onSubmit={()=>{throw new Error('No report submissions permitted')}} submitting={false} success={false}/></BrowserRouter>
}
createRoot(document.getElementById('root')).render(<Fixture/>)
