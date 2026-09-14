import {lazy,Suspense} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter,Routes,Route} from 'react-router-dom'
import i18n,{loadLocale} from '../../../src/i18n/index.js'
import SiteLayout from '../../../src/components/layout/SiteLayout.jsx'
import {SERVICE_TAXONOMY_SERVICES} from '@holalocal/firebase-contract'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
export const Services=lazy(()=>import('../../../src/pages/ServicesPage.jsx'))
const params=new URLSearchParams(location.search),locale=params.get('locale')??'en',short=params.get('size')==='short'
await loadLocale(locale);await i18n.changeLanguage(locale)
const image=index=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#ddeeff"/><text x="40" y="140">Synthetic photo ${index}</text></svg>`)
const description=locale==='de'?'Ausführliche Beschreibung unseres lokalen Betriebs und der angebotenen Dienstleistungen. ':'A detailed description of this synthetic local business and its available services. '
const business={businessId:'synthetic-business',ownerId:'synthetic-owner',managerIds:[],name:locale==='de'?'Lokaler Betrieb für Hauspflege und umfangreiche Dienstleistungen':'Synthetic local home services',description:description.repeat(short?1:60),category:'handyman',primaryCategoryId:'handyman',categoryIds:['handyman'],serviceIds:['handyman'],serviceAreas:['marbella'],serviceArea:'Marbella',languages:['en','de'],location:{locality:'Marbella',region:'malaga',countryCode:'ES'},status:'active',subscriptionTier:'free',contact:{},publicContact:{},galleryImages:[],galleryUrls:short?[]:Array.from({length:12},(_,i)=>image(i)),services:short?['handyman']:SERVICE_TAXONOMY_SERVICES.map(s=>s.id)}
window.h={user:null,profile:null,business,businesses:[business],events:[],t:key=>i18n.t(key)}
createRoot(document.getElementById('root')).render(<BrowserRouter><Suspense fallback={<p>Loading fixture</p>}><Routes><Route element={<SiteLayout/>}><Route path="/services" element={<Services/>}/><Route path="/services/:businessId" element={<Services/>}/></Route></Routes></Suspense></BrowserRouter>)
