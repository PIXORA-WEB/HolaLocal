import {lazy,Suspense} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter,Link,Routes,Route} from 'react-router-dom'
import i18n from '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
export const Admin=lazy(()=>import('../../../src/pages/admin/AdminCustomerReviewsPage.jsx'))
export const Services=lazy(()=>import('../../../src/pages/ServicesPage.jsx'))
export const MyReviews=lazy(()=>import('../../../src/pages/customer/MyReviewsPage.jsx'))
const business={businessId:'synthetic-business',ownerId:'synthetic-owner',managerIds:[],name:'Synthetic business with a deliberately long descriptive name for wrapping',description:'Synthetic local services. '.repeat(16),category:'handyman',primaryCategoryId:'handyman',categoryIds:['handyman'],serviceIds:['handyman'],serviceAreas:['marbella'],serviceArea:'Marbella',languages:['en'],location:{locality:'Marbella',region:'malaga',countryCode:'ES'},status:'active',contact:{},publicContact:{},galleryImages:[],galleryUrls:[],services:['handyman']}
const item={publicReviewId:'synthetic-review',businessId:business.businessId,version:3,businessAvailable:true,pendingSubmittedAt:{seconds:1700000000},pending:{revision:2,rating:4,displayName:'Synthetic reviewer with a long display name',originalText:'A long synthetic review for wrapping and paragraph layout. '.repeat(10)},published:{revision:1,rating:3,displayName:'Synthetic reviewer',originalText:'Previous published synthetic review.'}}
const mode=new URLSearchParams(location.search).get('state')
window.h={business,businesses:[business],user:{uid:'synthetic-admin',emailVerified:true,getIdTokenResult:async()=>({claims:{admin:true}})},profile:{roles:['customer'],accountStatus:'active'},own:{...item,status:'published',businessName:business.name},writes:0,t:key=>i18n.t(key),adminApi:{queue:async()=>{if(mode==='error')throw new Error('synthetic read failure');return{items:mode==='empty'?[]:[item],nextCursor:null}},case:async()=>item,approve:async()=>{window.h.writes++;throw new Error('No moderation permitted')},reject:async()=>{window.h.writes++;throw new Error('No moderation permitted')}}}
createRoot(document.getElementById('root')).render(<BrowserRouter><nav aria-label="Fixture navigation"><Link to="/admin/reviews">Fixture Admin</Link> <Link to="/services">Fixture Services</Link> <Link to="/my-reviews">Fixture My Reviews</Link></nav><Suspense fallback={<p>Loading fixture</p>}><Routes><Route path="/admin/reviews" element={<Admin/>}/><Route path="/services" element={<Services/>}/><Route path="/my-reviews" element={<MyReviews/>}/></Routes></Suspense></BrowserRouter>)
