import {useEffect,useMemo,useState,useSyncExternalStore} from 'react'
import {useTranslation} from 'react-i18next'
import ReviewReasonSelect from './ReviewReasonSelect.jsx'
import AccessibleDialog from '../common/AccessibleDialog.jsx'
import {createAdminReviewController,adminActionPayload,adminRejectionReasons} from '../../utils/adminCustomerReviewModel.js'
import '../../styles/customerReviews.css'
import '../../styles/adminCustomerReviews.css'

function Original({title,review,children}){
  const {t}=useTranslation()
  return review&&<section className="admin-customer-reviews__original"><h3>{title}</h3>{review.displayName&&<p>{t('customerReviews.displayName')}: {review.displayName}</p>}<p>★ {review.rating} / 5</p>{children}<p className="customer-reviews__text">{review.originalText}</p></section>
}
export function ReviewModerationCase({item,reports,onAction,blocked}){
  const {t,i18n}=useTranslation()
  const [reason,setReason]=useState(''),[confirmation,setConfirmation]=useState(null),[invalid,setInvalid]=useState(false),[internalNote,setInternalNote]=useState('')
  const copy=key=>t(`adminCustomerReviews.${key}`)
  const date=value=>value?new Intl.DateTimeFormat(i18n.resolvedLanguage,{dateStyle:'medium',timeStyle:'short'}).format(value.seconds*1000):copy('dateMissing')
  const prepare=action=>{try{const payload=adminActionPayload(action,item,reason,internalNote);setInvalid(false);setConfirmation({action,payload})}catch{setInvalid(true)}}
  return <div>
    <header className="admin-customer-reviews__identity"><h2>{copy('business')}: <span>{item.businessId??copy('notProvided')}</span></h2></header>
    {reports?<>
      {item.overdue&&<p role="status">{copy('overdue')}</p>}{item.createdAt&&<p>{new Intl.DateTimeFormat(i18n.resolvedLanguage,{dateStyle:'medium',timeStyle:'short'}).format(item.createdAt.seconds*1000)}</p>}<p>{t(`customerReviews.${item.reasonCode}`)} · {copy(item.targetState)}</p>
      <p>{copy('observed')}: {item.observedPublishedRevision} · {copy('current')}: {item.currentReview?.publishedRevision??copy('notProvided')}</p>
      {!item.observedRevisionIsCurrent&&<p role="status">{copy('changed')}</p>}
      {item.details&&<p className="customer-reviews__text">{item.details}</p>}
      <Original title={copy('current')} review={item.currentReview}/>
      <p>{copy('resolveNotice')}</p>
      {item.status==='open'&&<><label>{copy('reason')}<textarea value={reason} disabled={blocked} aria-invalid={invalid||undefined} aria-describedby="admin-review-reason-help" onChange={e=>setReason(e.target.value)}/></label><p id="admin-review-reason-help">{copy('reasonHelp')}</p>{invalid&&<p role="alert">{copy('reasonHelp')}</p>}
      <button className="button button--secondary" disabled={blocked} onClick={()=>prepare('resolved')}>{copy('resolve')}</button>
      <button className="button button--secondary" disabled={blocked} onClick={()=>prepare('dismissed')}>{copy('dismiss')}</button></>}
      <p>{copy('removeNotice')}</p><button className="button button--secondary" disabled={blocked||!item.observedRevisionIsCurrent||!item.currentReview} onClick={()=>prepare('remove')}>{copy('remove')}</button>
    </>:<>
      <p className="admin-customer-reviews__case-type">{copy(item.published?'edit':'new')}</p>
      <div className={`admin-customer-reviews__comparison${item.published?' admin-customer-reviews__comparison--edit':''}`}>
        <Original title={copy('publishedVersion')} review={item.published}>{item.publicationDates&&<p className="admin-customer-reviews__dates">{date(item.publicationDates.publishedAt)} · {t('customerReviews.updated')}: {date(item.publicationDates.updatedAt)}</p>}</Original>
        <Original title={copy('proposed')} review={item.pending}><p className="admin-customer-reviews__dates">{copy('submittedAt')}: {date(item.pendingSubmittedAt)}</p></Original>
      </div>
      <section className="admin-customer-reviews__action" aria-labelledby="admin-review-approve-title"><h3 id="admin-review-approve-title">{copy('approve')}</h3><p>{copy(item.published?'approveEdit':'approveNew')}</p>
      {!item.businessAvailable&&<p role="status">{copy('unavailable')}</p>}
      <button className="button button--primary" disabled={blocked||!item.pending||!item.businessAvailable} onClick={()=>prepare('approve')}>{copy('approve')}</button></section>
      {item.pending&&<fieldset className="admin-customer-reviews__action admin-customer-reviews__rejection" disabled={blocked}><legend>{copy('reject')}</legend>
      <p>{copy(item.published?'rejectEdit':'rejectNew')}</p>
      <ReviewReasonSelect label={copy('authorReason')} options={[{value:'',label:copy('selectReason')},...adminRejectionReasons.map(value=>({value,label:t(`customerReviews.${value}`)}))]} value={reason} onChange={setReason} disabled={blocked} invalid={invalid} errorId="admin-review-rejection-error" language={i18n.resolvedLanguage}/>
      {reason&&<p className="admin-customer-reviews__guidance">{t(`customerReviews.rejection_${reason}`)}</p>}
      <label>{copy('internalNote')}<textarea value={internalNote} onChange={e=>setInternalNote(e.target.value)} aria-describedby="admin-review-note-help"/></label><p id="admin-review-note-help">{copy('noteHelp')}</p>
      {invalid&&<p id="admin-review-rejection-error" role="alert">{copy('rejectionHelp')}</p>}<button className="button button--secondary" disabled={blocked} onClick={()=>prepare('reject')}>{copy('reject')}</button></fieldset>}
    </>}
    <AccessibleDialog className="customer-reviews-modal" open={!!confirmation} onClose={()=>setConfirmation(null)} ariaLabelledBy="admin-review-confirm-title"><div className="customer-reviews__dialog"><h2 id="admin-review-confirm-title">{copy('confirm')}</h2>{confirmation?.action==='reject'&&<p>{t(`customerReviews.rejection_${confirmation.payload.rejectionReasonCode}`)}</p>}<p>{copy(confirmation?.action==='remove'?'removeNotice':reports?'resolveNotice':item.published?'editPolicy':'newPolicy')}</p><button className="button button--primary" disabled={blocked} onClick={()=>{const value=confirmation;setConfirmation(null);onAction(value.action,value.payload)}}>{copy('confirm')}</button><button className="button button--secondary" onClick={()=>setConfirmation(null)}>{t('common.cancel')}</button></div></AccessibleDialog>
  </div>
}
export default function CustomerReviewModeration({api,reports=false}){
  const {t,i18n}=useTranslation(),copy=key=>t(`adminCustomerReviews.${key}`)
  const controller=useMemo(()=>createAdminReviewController({api,reports}),[api,reports])
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
  useEffect(()=>{controller.start();return controller.dispose},[controller])
  const blocked=state.busy||state.loading||state.uncertain||!!state.error
  const date=value=>value?new Intl.DateTimeFormat(i18n.resolvedLanguage,{dateStyle:'medium',timeStyle:'short'}).format(value.seconds*1000):copy('dateMissing')
  return <section className="customer-reviews admin-customer-reviews"><h1>{copy(reports?'reports':'title')}</h1>
    {state.loading&&<p role="status">{t('common.loading')}</p>}
    {state.error&&<div role="alert"><p>{state.action&&<strong>{copy({resolved:'resolve',dismissed:'dismiss'}[state.action]??state.action)}: </strong>}{copy(state.error)}</p>{!state.denied&&<button className="button button--secondary" disabled={state.busy} onClick={()=>state.uncertain?void controller.retry():void controller.read(state.error==='refresh'?null:state.selected)}>{t('common.retry')}</button>}</div>}
    {state.success&&<p role="status">{copy(`success_${state.success}`)}</p>}
    {state.selected&&!state.denied&&<button className="button button--secondary" disabled={state.busy||state.uncertain} onClick={()=>void controller.read()}>{copy('back')}</button>}
    {!state.selected&&!state.loading&&!state.error&&state.items.length===0&&<p>{copy('empty')}</p>}
    {state.items.map(item=><article key={item.reportId??item.publicReviewId}><h2>{reports?t(`customerReviews.${item.reasonCode}`):`${copy('business')}: ${item.businessId}`}</h2><p>{reports?copy('targetOnOpen'):copy(item.published?'edit':'new')}</p>{reports&&item.overdue&&<p role="status">{copy('overdue')}</p>}{!reports&&<p>★ {item.pending?.rating} / 5</p>}<p>{date(reports?item.createdAt:item.pendingSubmittedAt)}</p><button className="button button--secondary" disabled={blocked} onClick={()=>void controller.read(item.reportId??item.publicReviewId)}>{copy('open')}</button></article>)}
    {state.item&&<ReviewModerationCase key={`${state.item.reportId??state.item.publicReviewId}:${state.item.version}`} item={state.item} reports={reports} onAction={controller.execute} blocked={blocked}/>}
    {state.cursor&&!state.selected&&<button className="button button--secondary" disabled={blocked} onClick={()=>void controller.read(null,true)}>{t('customerReviews.more')}</button>}
  </section>
}
