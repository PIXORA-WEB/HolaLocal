import {pathToFileURL} from 'node:url'
// Defaults to an offline plan. Paid execution requires a separate explicit approval.
import {createGoogleCloudTranslator, GOOGLE_TRANSLATION_EU_ENDPOINT, GOOGLE_TRANSLATION_EU_LOCATION} from '../src/providers/googleCloudTranslator.js'
import {SUPPORTED_LANGUAGE_CODES} from '../../shared/firebase-contract/constants.js'
const targets=SUPPORTED_LANGUAGE_CODES.filter(language=>language!=='en')
const text='This is a synthetic review of a fictional service for translation testing.'
export const probePlan=projectId=>({projectId,provider:'existing Google Cloud Translation Advanced adapter',location:GOOGLE_TRANSLATION_EU_LOCATION,apiEndpoint:GOOGLE_TRANSLATION_EU_ENDPOINT,text,sourceLanguage:'en',model:'general/base',perRequestTimeoutMs:10000,overallTimeoutMs:210000,targets,inputCharacters:[...text].length*targets.length,maximumRequests:targets.length,automaticProviderRetries:false})
export async function runProbe(provider, emit=console.log){
 let failed=false
 for(const targetLanguage of targets){
  try{const result=await provider.translateText({text,targetLanguage,sourceLanguageHint:'en'});emit(JSON.stringify({targetLanguage,translatedText:result.translatedText,sourceLanguage:result.sourceLanguage}))}
  catch(error){failed=true;emit(JSON.stringify({targetLanguage,status:'unavailable',category:error.safeCategory??'unknown',diagnostics:error.providerDiagnostics??null}));break}
 }
 return !failed
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const [projectId,mode='--plan']=process.argv.slice(2)
if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId??'')||!['--plan','--execute-paid'].includes(mode)||process.argv.length>4)throw new Error('Usage: node scripts/checkReviewTranslationProvider.mjs APPROVED_PROJECT [--plan|--execute-paid]')
const plan=probePlan(projectId)
console.log(JSON.stringify(plan))
if(mode==='--execute-paid'){
 const deadline=setTimeout(()=>{console.error('Probe deadline exceeded; no automatic rerun.');process.exit(1)},210000)
 const provider=createGoogleCloudTranslator({projectId,location:GOOGLE_TRANSLATION_EU_LOCATION,apiEndpoint:GOOGLE_TRANSLATION_EU_ENDPOINT,requestTimeoutMs:10000})
 const passed=await runProbe(provider)
 clearTimeout(deadline)
 if(!passed)process.exitCode=1
}else console.log('PLAN ONLY: no credentials accessed or provider requests made. Obtain separate project/budget/data-location approval before --execute-paid.')

}
