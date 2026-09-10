// Defaults to an offline plan. Paid execution requires a separate explicit approval.
import {createGoogleCloudTranslator} from '../src/providers/googleCloudTranslator.js'
import {SUPPORTED_LANGUAGE_CODES} from '../../shared/firebase-contract/constants.js'
const [projectId,mode='--plan']=process.argv.slice(2)
if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId??'')||!['--plan','--execute-paid'].includes(mode)||process.argv.length>4)throw new Error('Usage: node scripts/checkReviewTranslationProvider.mjs APPROVED_PROJECT [--plan|--execute-paid]')
const text='This is a synthetic review of a fictional service for translation testing.'
const plan={projectId,provider:'existing Google Cloud Translation Advanced adapter',location:'global',targets:SUPPORTED_LANGUAGE_CODES,inputCharacters:[...text].length*SUPPORTED_LANGUAGE_CODES.length,maximumRequests:SUPPORTED_LANGUAGE_CODES.length,automaticProviderRetries:false}
console.log(JSON.stringify(plan))
if(mode==='--execute-paid'){
 const provider=createGoogleCloudTranslator({projectId,requestTimeoutMs:10000})
 let failed=false
 for(const targetLanguage of SUPPORTED_LANGUAGE_CODES){
  try{const result=await provider.translateText({text,targetLanguage,sourceLanguageHint:'en'});console.log(JSON.stringify({targetLanguage,translatedText:result.translatedText,sourceLanguage:result.sourceLanguage}));}
  catch(error){failed=true;console.log(JSON.stringify({targetLanguage,status:'unavailable',category:error.safeCategory??'unknown'}))}
 }
 if(failed)process.exitCode=1
}else console.log('PLAN ONLY: no credentials accessed or provider requests made. Obtain separate project/budget/data-location approval before --execute-paid.')
