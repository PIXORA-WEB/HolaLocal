import {randomUUID} from 'node:crypto'
import {customerReviewTranslationCacheKey} from '@holalocal/firebase-contract/customerReviewTranslation'
import {validateCustomerReviewSubmission} from '@holalocal/firebase-contract/customerReviewContracts'
import {isPublicBusinessEligible} from '@holalocal/firebase-contract'

const fail=code=>{const error=new Error(code);error.code=code;throw error}
// Cache lives inside the authoritative public projection: publication replaces it,
// withdrawal/removal/erasure deletes it. No orphan collection or private source cache.
export function createCustomerReviewTranslationService({database,provider,providerVersion,configured=false,clock=Date.now}) {
 return {translate:async input=>{
  if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).sort().join()!=='publicReviewId,publishedRevision,targetLanguage')fail('invalid-payload')
  let key
  try{key=customerReviewTranslationCacheKey({...input,providerVersion})}catch{fail('invalid-translation-target')}
  const {publicReviewId,publishedRevision,targetLanguage}=input
  const path=`customerReviewsPublic/${publicReviewId}`,leaseId=randomUUID()
  const response=(status,extra={})=>({publicReviewId,publishedRevision,targetLanguage,status,...extra})
  async function source(tx){
   const row=await tx.get(path)
   if(!row||row.publicReviewId!==publicReviewId||row.publishedRevision!==publishedRevision)fail('review-refresh-required')
   if(!isPublicBusinessEligible(await tx.get(`businesses/${row.businessId}`)))fail('business-unavailable')
   const valid=validateCustomerReviewSubmission({rating:row.rating,originalText:row.originalText,declaredSourceLanguage:row.declaredSourceLanguage},{min:1,max:2000},{allowLegacyDisplayName:true})
   if(!valid.valid||valid.value.originalText!==row.originalText)fail('review-refresh-required')
   return row
  }
  const initial=await database.runTransaction(async tx=>{
   const row=await source(tx)
   if(row.declaredSourceLanguage===targetLanguage)return {answer:response('original')}
   if(!configured)return {answer:response('unavailable')}
   const cache=row.translationCache?.providerVersion===providerVersion&&row.translationCache?.publishedRevision===publishedRevision?row.translationCache:{providerVersion,publishedRevision,entries:{}}
   const entry=cache.entries?.[targetLanguage]
   if(entry?.key===key&&entry.status==='translated')return {answer:response('translated',{translatedText:entry.translatedText})}
   if(entry?.key===key&&entry.until>clock())return {answer:response(entry.status==='pending'?'pending':'unavailable',{retryAfterMs:Math.min(60000,entry.until-clock())})}
   tx.set(path,{...row,translationCache:{...cache,entries:{...cache.entries,[targetLanguage]:{key,status:'pending',leaseId,until:clock()+60000}}}})
   return {text:row.originalText,sourceLanguage:row.declaredSourceLanguage}
  })
  if(initial.answer)return initial.answer
  let translatedText=null
  try{
   const result=await provider.translateText({text:initial.text,targetLanguage,sourceLanguageHint:initial.sourceLanguage})
   if(typeof result?.translatedText==='string'&&result.translatedText.trim()&&[...result.translatedText].length<=8000&&![...result.translatedText].some(character=>character.codePointAt(0)<32&&![9,10,13].includes(character.codePointAt(0))))translatedText=result.translatedText
  }catch{ /* Safe unavailable response; no provider diagnostics/content in logs. */ }
  return database.runTransaction(async tx=>{
   const row=await source(tx) // Recheck availability/revision even after a paid result.
   if(row.originalText!==initial.text)fail('review-refresh-required')
   const cache=row.translationCache,entry=cache?.entries?.[targetLanguage]
   if(cache?.providerVersion!==providerVersion||entry?.leaseId!==leaseId)return response('pending',{retryAfterMs:1000})
   const next=translatedText?{key,status:'translated',translatedText}:{key,status:'unavailable',until:clock()+30000}
   tx.set(path,{...row,translationCache:{...cache,entries:{...cache.entries,[targetLanguage]:next}}})
   return translatedText?response('translated',{translatedText}):response('unavailable',{retryAfterMs:30000})
  })
 }}
}
