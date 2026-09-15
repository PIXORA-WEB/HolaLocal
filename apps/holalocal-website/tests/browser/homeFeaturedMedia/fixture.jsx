import { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useParams, useNavigate } from 'react-router-dom'
import '../../../src/i18n/index.js'
import '../../../src/styles/tokens.css'
import '../../../src/styles/base.css'
import '../../../src/styles/global.css'
import { getPublicBusinessById } from '../../../src/services/publicBusinessService.js'
export const Home = lazy(() => import('../../../src/pages/HomePage.jsx'))
export const Panel = lazy(async () => { await import('../../../src/styles/servicesPresentation.css'); return import('../../../src/components/common/BusinessDetailPanel.jsx') })
// Only the detail-route orchestration is a fixture; both rendered components and
// service/media loading are originals. This is not full Services-route acceptance.
export function Detail() {
  const {businessId}=useParams(), navigate=useNavigate(), [business,setBusiness]=useState(null)
  useEffect(()=>{getPublicBusinessById(businessId).then(setBusiness)},[businessId])
  return business ? <Panel business={business} onBack={()=>navigate('/')} /> : <p>Loading detail</p>
}
window.fixture={calls:[],businesses:Array.from({length:60},(_,n)=>({businessId:`b${n}`,name:`Business ${n} — Long synthetic local services name`,description:'Long synthetic description. '.repeat(20),profileComplete:true,category:'handyman',services:['handyman'],serviceAreas:['marbella'],languages:['en'],contact:{},logoStoragePath:`businesses/b${n}/logos/logo`,galleryStoragePaths:[0,1].map(i=>`businesses/b${n}/photos/${i}`)}))}
createRoot(document.getElementById('root')).render(<BrowserRouter><Suspense fallback={<p>Loading</p>}><Routes><Route path="/" element={<Home/>}/><Route path="/services/:businessId" element={<Detail/>}/></Routes></Suspense></BrowserRouter>)
