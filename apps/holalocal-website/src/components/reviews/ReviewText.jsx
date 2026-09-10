import {useEffect,useState} from 'react'
import {useTranslation} from 'react-i18next'
import {withTimeout} from '../../utils/withTimeout.js'
import {supportedUILanguages} from '../../utils/languages.js'

export default function ReviewText({review,api}) {
 const {t,i18n}=useTranslation()
 const targetLanguage=(i18n.resolvedLanguage||i18n.language||'en').split('-')[0]
 const key=JSON.stringify([review.publicReviewId,review.publishedRevision,targetLanguage])
 const [result,setResult]=useState(null),[original,setOriginal]=useState(null)
 useEffect(()=>{
  let current=true,timer,attempt=0
  const input={publicReviewId:review.publicReviewId,publishedRevision:review.publishedRevision,targetLanguage}
  const update=value=>{if(current)setResult({key,...value})}
  async function load(){
   if(review.declaredSourceLanguage===targetLanguage){update({status:'original'});return}
   if(!supportedUILanguages.some(value=>value.code===targetLanguage)||typeof api?.translate!=='function'){update({status:'unavailable'});return}
   update({status:'loading'})
   try{
    const response=await withTimeout(()=>api.translate(input),15000)
    if(!current)return
    if(response?.publicReviewId!==input.publicReviewId||response.publishedRevision!==input.publishedRevision||response.targetLanguage!==targetLanguage)throw new Error('stale-translation')
    if(response.status==='pending'&&attempt++<2){timer=setTimeout(load,Math.max(1000,Math.min(response.retryAfterMs||2000,30000)));return}
    if(response.status==='translated'&&typeof response.translatedText==='string'&&response.translatedText.trim()&&[...response.translatedText].length<=8000)update({status:'translated',text:response.translatedText})
    else update({status:response.status==='original'?'original':'unavailable'})
   }catch{update({status:'unavailable'})}
  }
  void load()
  return ()=>{current=false;clearTimeout(timer)}
 },[api,key,review.publicReviewId,review.publishedRevision,review.declaredSourceLanguage,targetLanguage])
 const state=result?.key===key?result:{status:'loading'}
 const showOriginal=original===key||state.status!=='translated'
 return <div className="customer-reviews__translation">
  <p className="customer-reviews__text" lang={showOriginal?(review.declaredSourceLanguage||undefined):targetLanguage}>{showOriginal?review.originalText:state.text}</p>
  <p role="status" aria-live="polite">{state.status==='loading'?t('customerReviews.translationLoading'):state.status==='unavailable'?t('customerReviews.translationUnavailable'):state.status==='translated'?t(showOriginal?'customerReviews.originalText':'customerReviews.machineTranslation'):null}</p>
  {state.status==='translated'&&<button type="button" className="button button--text" onClick={()=>setOriginal(showOriginal?null:key)}>{t(showOriginal?'customerReviews.showTranslation':'customerReviews.showOriginal')}</button>}
 </div>
}
