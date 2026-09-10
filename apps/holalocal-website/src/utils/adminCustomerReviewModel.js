// Opt-in UI command model. Server authorization remains authoritative.
export const adminReviewMethods=Object.freeze({queue:'listCustomerReviewModerationQueue',case:'getCustomerReviewModerationCase',approve:'approveCustomerReview',reject:'rejectCustomerReview',remove:'removeCustomerReview',reports:'listCustomerReviewReports',reportCase:'getCustomerReviewReport',resolve:'resolveCustomerReviewReport'})
export function createAdminReviewService({enabled,authorize,invoke}) {
  return Object.fromEntries(Object.entries(adminReviewMethods).map(([key,name])=>[key,async payload=>{
    if(!enabled)throw new Error('customer-reviews-disabled')
    if(await authorize()!==true)throw new Error('admin-required')
    return invoke(name,payload)
  }]))
}
export function adminReviewError(error){
  const message=String(error?.message??'')
  if(/admin-required|unauthenticated|authentication-required|permission-denied|auth\//.test(`${error?.code} ${message}`))return 'denied'
  if(/disabled|production-policies-unavailable/.test(message))return 'unavailable'
  if(/invalid-rejection-reason|invalid-moderation-note/.test(message))return 'rejectionHelp'
  if(/conflict|refresh-required|invalid-cursor|restart-pagination|report-not-open/.test(message))return 'refresh'
  if(/not-found|target-unavailable|public-business-required|business-unavailable|published-review-required/.test(message))return 'gone'
  return 'failure'
}
export const adminRejectionReasons=Object.freeze(['spam','abusive_content','personal_information','irrelevant_content','conflict_of_interest'])
export function adminActionPayload(action,item,reason='',internalNote=''){
  if(action==='reject'){
    if(!item?.pending||!adminRejectionReasons.includes(reason))throw new Error('invalid-rejection-reason')
    if(typeof internalNote!=='string'||[...internalNote].length>2000||/[\uD800-\uDFFF]/u.test(internalNote))throw new Error('invalid-moderation-note')
    return {publicReviewId:item.publicReviewId,expectedVersion:item.version,rejectionReasonCode:reason,...(internalNote?{moderationNote:internalNote}:{})}
  }
  if(action==='approve'){
    if(!item?.pending||!item.businessAvailable)throw new Error('public-business-required')
    return {publicReviewId:item.publicReviewId,expectedVersion:item.version}
  }
  if(action==='remove'){
    if(!item?.observedRevisionIsCurrent||item.targetState!=='published'||item.observedPublishedRevision!==item.currentReview?.publishedRevision)throw new Error('review-refresh-required')
    return {publicReviewId:item.publicReviewId,expectedVersion:item.currentReview.version}
  }
  if(['resolved','dismissed'].includes(action)){
    const value=reason.trim().normalize('NFC')
    if(!value||[...value].length>500||/[\uD800-\uDFFF]/u.test(value))throw new Error('invalid-resolution-reason')
    return {reportId:item.reportId,expectedVersion:item.version,disposition:action,resolutionReason:value}
  }
  throw new Error('invalid-action')
}
export function createAdminReviewController({api,reports=false,requestId=()=>crypto.randomUUID()}){
  let active=true,epoch=0,operation=null
  const initial=()=>({items:[],cursor:null,item:null,selected:null,loading:false,busy:false,uncertain:false,error:'',success:'',denied:false,action:null})
  let state=initial()
  const listeners=new Set(),emit=patch=>{if(active){state={...state,...patch};listeners.forEach(fn=>fn())}}
  const valid=e=>active&&epoch===e
  function failure(error){const code=adminReviewError(error);if(code==='denied'||code==='unavailable'){operation=null;epoch++;emit({items:[],item:null,selected:null,cursor:null,denied:true,error:code,busy:false,loading:false,uncertain:false,success:''})}else emit({error:code})}
  async function read(id=null,more=false){
    if(state.busy||state.uncertain)return
    const e=++epoch
    emit({selected:id,item:null,loading:true,error:'',success:'',action:null,...(more?{}:{items:[],cursor:null})})
    try{
      const result=await (id?api[reports?'reportCase':'case'](reports?{reportId:id}:{publicReviewId:id}):api[reports?'reports':'queue']({pageSize:10,cursor:more?state.cursor:null}))
      if(!valid(e))return
      if(id)emit({item:result,error:result?'':'gone'})
      else emit({items:[...new Map([...(more?state.items:[]),...result.items].map(item=>[item.reportId??item.publicReviewId,item])).values()],cursor:result.nextCursor})
    }catch(error){if(valid(e))failure(error)}finally{if(valid(e))emit({loading:false})}
  }
  async function execute(action,payload){
    if(state.busy||state.loading||state.denied)return
    if(!operation)operation={action,payload:Object.freeze({...structuredClone(payload),requestId:requestId()})}
    const e=epoch;emit({busy:true,error:'',success:'',action:operation.action})
    try{
      await api[['resolved','dismissed'].includes(operation.action)?'resolve':operation.action](operation.payload)
      if(!valid(e))return
      const success=operation.action;operation=null;emit({busy:false,uncertain:false,item:null,success})
    }catch(error){if(!valid(e))return;const code=adminReviewError(error);if(code!=='failure')operation=null;emit({busy:false,uncertain:code==='failure'});failure(error)}
  }
  return {getSnapshot:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},read,execute,retry:()=>operation&&execute(operation.action,operation.payload),
    start:()=>{active=true;state=initial();void read()},dispose:()=>{active=false;epoch++;operation=null;state={items:[],item:null,denied:true};listeners.clear()}}
}

// The caller supplies Firebase User instances, never profile roles or request claims.
export async function authorizeAdminReviewUser(user,getCurrentUser){
  const current=getCurrentUser()
  if(!user||current?.uid!==user.uid)return false
  const token=await current.getIdTokenResult(true)
  return getCurrentUser()?.uid===user.uid&&token.claims?.admin===true
}
