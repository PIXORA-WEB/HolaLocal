import { validateCustomerReviewSubmission } from '@holalocal/firebase-contract/customerReviewContracts'
export { validateCustomerReviewSubmission }
export const reviewReasons = ['spam','abusive_content','personal_information','irrelevant_content','conflict_of_interest','other']
export const normalizedReviewText = value => value.trim().normalize('NFC')
export const reviewTextCount = value => [...normalizedReviewText(value)].length
export function reviewError(error) {
  const message=String(error?.message??'')
  if (/version-conflict|refresh-required|restart-pagination|invalid-cursor/.test(message)) return 'refresh'
  if (/report-already-open/.test(message)) return 'duplicate'
  if (/verified-email/.test(message)) return 'verify'
  if (/self-review/.test(message)) return 'self'
  if (/authentication-required|unauthenticated/.test(`${error?.code} ${message}`)) return 'signIn'
  if (/active-account|customer-role/.test(message)) return 'ineligible'
  if (/unavailable|public-business-required|review-not-found/.test(message)&&!message.includes('customer-review-unavailable')) return 'unavailable'
  if (/customer-reviews-disabled|production-policies-unavailable/.test(message)) return 'unavailable'
  if (/invalid-display-name/.test(message)) return 'validation'
  if (/quota-exceeded/.test(message)) return 'quota'
  return 'failure'
}
export function reviewPermission(user,profile,businessId,report=false) {
  if(!user)return 'signIn'
  if(!user.emailVerified)return 'verify'
  if(profile?.accountStatus!=='active'||profile?.deletionRequestedAt!=null||(!report&&!profile?.roles?.includes('customer')))return 'ineligible'
  if(!report&&businessId&&profile?.businessId===businessId)return 'self'
  return null // Server remains authoritative, including owner/manager relationships absent from public projections.
}
export function reviewActions(own) {
  const status=own?.status
  return {submit:!own||['published','rejected','withdrawn'].includes(status),
    edit:own?.published!=null&&['published','rejected'].includes(status),
    withdraw:!!own&&['pending','published','rejected'].includes(status)}
}
export function createReviewController({api,businessId,ownOnly=false,authenticated=false,reloadAfter=true,requestId=()=>crypto.randomUUID()}) {
  let active=true,epoch=0,operation=null
  let state={ready:false,items:[],cursor:null,own:null,loading:false,busy:false,error:'',feedback:'',uncertain:false}
  const listeners=new Set()
  const emit=patch=>{if(!active)return;state={...state,...patch};listeners.forEach(fn=>fn())}
  const valid=e=>active&&e===epoch
  async function load(more=false) {
    if(state.loading)return
    const e=++epoch;emit({loading:true,error:'',...(more?{}:{cursor:null})})
    try {
      const result=await (ownOnly?api.listOwn({cursor:more?state.cursor:null}):api.listPublic({businessId,cursor:more?state.cursor:null}))
      if(!valid(e))return
      const items=[...(more?state.items:[]),...result.items]
      emit({items:[...new Map(items.map(item=>[item.publicReviewId,item])).values()],cursor:result.nextCursor})
      if(authenticated&&!ownOnly){const own=await api.getOwn({businessId});if(valid(e))emit({own})}
    }catch(error){if(valid(e))emit({error:reviewError(error),...(reviewError(error)==='refresh'?{items:[],cursor:null}:{})})}
    finally{if(valid(e))emit({loading:false,ready:true})}
  }
  async function execute(name,payload) {
    if(state.busy||state.loading)return
    if(!operation)operation={name,payload:Object.freeze({...structuredClone(payload),requestId:requestId()})}
    const e=epoch;emit({busy:true,error:'',feedback:'',uncertain:false})
    try {
      await api[operation.name](operation.payload)
      if(!valid(e))return
      const completed=operation.name,feedbackTarget=operation.payload.publicReviewId??operation.payload.businessId;operation=null;emit({feedback:completed,feedbackTarget,busy:false});if(reloadAfter)await load()
    }catch(error){
      if(!valid(e))return
      const code=reviewError(error)
      if(code!=='failure')operation=null
      emit({busy:false,error:code,uncertain:code==='failure'})
    }
  }
  // Opening the editor dismisses only obsolete success copy, never an unresolved operation.
  const clearSuccessFeedback=()=>emit({feedback:'',feedbackTarget:undefined})
  return {clearSuccessFeedback,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},getSnapshot:()=>state,load,
    start:()=>{active=true;emit({items:[],cursor:null,own:null,loading:false,busy:false,error:'',feedback:'',uncertain:false})},execute,retry:()=>operation&&execute(operation.name,operation.payload),
    dispose:()=>{active=false;epoch++;operation=null;state={items:[],own:null};listeners.clear()}}
}
