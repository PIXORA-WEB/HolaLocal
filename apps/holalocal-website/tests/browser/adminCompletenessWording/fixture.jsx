import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LanguageSwitcher from '../../../src/components/common/LanguageSwitcher.jsx'
import AdminBusinessReviewPage from '../../../src/pages/admin/AdminBusinessReviewPage.jsx'
import { i18nReady } from '../../../src/i18n/index.js'
import { getBusinessProfileCompletion } from '../../../src/utils/businessCompletion.js'
import { hasCompletePublicBusinessProfile } from '@holalocal/firebase-contract'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
await i18nReady
const media=new URLSearchParams(location.search).get('media')==='yes'
const business={id:'synthetic',ownerId:'synthetic-owner',managerIds:['synthetic-owner'],name:'Synthetic profile',description:'Synthetic complete business profile.',status:'pending_review',verificationStatus:'unverified',primaryCategoryId:'Cleaning',categoryIds:['Cleaning'],languages:['en'],primaryLanguage:'en',contact:{preferredContactMethod:'holalocal'},location:{locality:'Santa Margarita',region:'cadiz',countryCode:'ES'},serviceAreas:['sotogrande'],...(media?{logoStoragePath:'businesses/synthetic/logos/a',galleryStoragePaths:['businesses/synthetic/photos/a']}:{})}
window.adminWordingFixture={review:{business,history:[],owner:{uid:'synthetic-owner'},privateModeration:{},subscription:{effectivePlanId:'early_access',sourceType:'early_access_fallback',recentAssignmentEvents:[],assignmentVersion:0,canAssign:false}},completion:getBusinessProfileCompletion(business),publicationRequirements:hasCompletePublicBusinessProfile(business),operations:0}
createRoot(document.getElementById('root')).render(<BrowserRouter><LanguageSwitcher /><Routes><Route path="/admin/businesses/:businessId" element={<AdminBusinessReviewPage />} /></Routes></BrowserRouter>)
