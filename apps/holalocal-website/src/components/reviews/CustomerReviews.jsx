import ReviewText from './ReviewText.jsx'
import { useEffect, useMemo, useState, useSyncExternalStore, useRef, useId } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AccessibleDialog from '../common/AccessibleDialog.jsx'
import { createReviewController, reviewActions, reviewPermission, reviewReasons, reviewTextCount, validateCustomerReviewSubmission } from '../../utils/customerReviewModel.js'
import '../../styles/customerReviews.css'

function withdrawalCopy(own) {
  return own?.published?(own.pending?'withdrawBoth':'withdrawPublished'):'withdrawPending'
}

function useReviews(api,businessId,user,ownOnly=false,reloadAfter=true) {
  const controller=useMemo(()=>createReviewController({api,businessId,authenticated:!!user?.uid,ownOnly,reloadAfter}),[api,businessId,user?.uid,ownOnly,reloadAfter])
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
  useEffect(()=>{controller.start();if(reloadAfter)void controller.load();return controller.dispose},[controller,reloadAfter])
  return [state,controller]
}
function Guidance({code}) {
  const {t}=useTranslation()
  return <p role="status">{t(`customerReviews.${code}`)} {code==='signIn'&&<Link to="/login">{t('customerReviews.signInAction')}</Link>}{code==='verify'&&<Link to="/verify-email">{t('customerReviews.account')}</Link>}</p>
}
function Feedback({state,controller,onRefresh}) {
  const {t}=useTranslation()
  return <>{state.error&&<div role="alert"><Guidance code={state.error}/>{state.uncertain?<button className="button button--secondary" type="button" disabled={state.busy} onClick={()=>void controller.retry()}>{t('common.retry')}</button>:state.error==='refresh'&&<button className="button button--secondary" type="button" onClick={()=>onRefresh?onRefresh():void controller.load()}>{t('common.retry')}</button>}</div>}{state.feedback&&<p role="status">{t(`customerReviews.success_${state.feedback}`)}</p>}</>
}
function ReviewDates({review}) {
  const {i18n,t}=useTranslation()
  const format=value=>value&&Number.isFinite(value.seconds)?new Intl.DateTimeFormat(i18n.resolvedLanguage,{dateStyle:'medium'}).format(new Date(value.seconds*1000)):null
  return <p className="customer-reviews__dates">{format(review.publishedAt)}{review.updatedAt&&(review.updatedAt.seconds!==review.publishedAt?.seconds||review.updatedAt.nanoseconds!==review.publishedAt?.nanoseconds)&&<> · {t('customerReviews.updated')}: {format(review.updatedAt)}</>}</p>
}
export function ReviewRatingSummary({summary}) {
  const {t,i18n}=useTranslation()
  if(!summary||!summary.available)return <p className="customer-reviews__summary">{t('customerReviews.statsUnavailable')}</p>
  return <p className="customer-reviews__summary">{summary.count>0&&<><span aria-hidden="true">★ </span>{new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:1}).format(summary.average)} / 5 · </>}{t('customerReviews.count',{count:summary.count})}</p>
}
export function OwnStatus({own}) {
  const {t}=useTranslation()
  if(!own)return null
  return <div className="customer-reviews__own"><h3>{t('customerReviews.myReview')}</h3>{!(own.status==='published'&&own.published)&&<p role="status">{t(`customerReviews.${own.published&&own.pending?'pendingEdit':own.status}`)}</p>}
    {own.status==='rejected'&&own.rejection?.revision===own.lastSubmitted?.revision&&<p role="status">{t(`customerReviews.rejection_${own.rejection.reasonCode}`)}</p>}
    {own.published&&<div><span>{own.published.displayName}</span><strong>{t('customerReviews.published')} · {own.published.rating} / 5</strong><p className="customer-reviews__text">{own.published.originalText}</p></div>}
    {own.lastSubmitted&&own.lastSubmitted.revision!==own.published?.revision&&<div><span>{own.lastSubmitted.displayName}</span><strong>{t('customerReviews.submittedText')} · {own.lastSubmitted.rating} / 5</strong><p className="customer-reviews__text">{own.lastSubmitted.originalText}</p></div>}
    {!own.businessAvailable&&<Guidance code="unavailable"/>}</div>
}
export function AuthorForm({own,state,controller,user,profile,businessId,heading=false}) {
  const {t,i18n}=useTranslation()
  const source=own?.lastSubmitted??own?.published
  const [draft,setDraft]=useState(null)
  const rating=draft?.rating??source?.rating??''
  const text=draft?.text??source?.originalText??''
  const displayName=draft?.displayName??source?.displayName??''
  const [expanded,setExpanded]=useState(false)
  const [invalid,setInvalid]=useState(false)
  const [confirm,setConfirm]=useState(false)
  const id=useId()
  const trigger=useRef(null),editor=useRef(null),title=useRef(null),wasOpen=useRef(false)
  useEffect(()=>{
    if(expanded)(editor.current?.querySelector('input:checked:not(:disabled), input:not(:disabled), a, textarea:not(:disabled), button:not(:disabled)')??editor.current)?.focus()
    else if(wasOpen.current)(trigger.current??title.current)?.focus()
    wasOpen.current=expanded
  },[expanded])
  useEffect(()=>{
    let previous=controller.getSnapshot().feedback
    return controller.subscribe(()=>{
      const {feedback,feedbackTarget}=controller.getSnapshot()
      if(feedback&&feedback!==previous&&[own?.publicReviewId,businessId].includes(feedbackTarget)&&['submit','edit','withdraw'].includes(feedback)){
        setExpanded(false);setDraft(null);setInvalid(false)
      }
      previous=feedback
    })
  },[controller,own?.publicReviewId,businessId])
  const permission=own?.businessAvailable===false?'unavailable':reviewPermission(user,profile,businessId)
  const actions=reviewActions(own)
  const blocked=state.busy||state.loading||state.uncertain||!!state.error
  const withdrawalBlocked=state.busy||state.loading||state.uncertain||(!!state.error&&state.error!=='quota')
  const submit=event=>{
    event.preventDefault()
    const validation=validateCustomerReviewSubmission({rating:Number(rating),displayName,originalText:text,declaredSourceLanguage:source?.declaredSourceLanguage??null})
    if(!validation.valid){setInvalid(true);editor.current?.querySelector(validation.issues.includes('invalid-display-name') ? '[name=displayName]' : validation.issues.includes('invalid-rating') ? 'input[type=radio]' : 'textarea')?.focus();return}
    setInvalid(false);void controller.execute(actions.edit?'edit':'submit',{businessId,expectedVersion:own?.version??0,...validation.value})
  }
  return <><div className="customer-reviews__heading">{heading?<h2 id="customer-reviews-title" tabIndex={-1} ref={title}>{t('customerReviews.title')}</h2>:<span tabIndex={-1} ref={title} aria-label={t('customerReviews.myReview')}/>}
    {!expanded&&state.ready!==false&&actions.submit&&<button className="button button--secondary" ref={trigger} aria-expanded={expanded} aria-controls={`${id}-editor`} disabled={state.busy||state.loading} onClick={()=>{controller.clearSuccessFeedback();setExpanded(true)}}>{t(actions.edit?'customerReviews.editTrigger':'customerReviews.writeTrigger')}</button>}</div>
    <OwnStatus own={own}/>
    <div id={`${id}-editor`} ref={editor} tabIndex={-1} hidden={!expanded}>
    {permission?<Guidance code={permission}/>:actions.submit&&<form onSubmit={submit} noValidate>
    <label>{t('customerReviews.displayName')}<input name="displayName" autoComplete="off" required disabled={blocked} value={displayName} onChange={e=>setDraft({rating,text,displayName:e.target.value})} aria-invalid={invalid||undefined} aria-describedby={`${id}-name-notice${invalid?` ${id}-error`: ''}`}/></label>
    <p id={`${id}-name-notice`}>{t('customerReviews.displayNameNotice')}</p>
    <p className="customer-reviews__notice">{t('customerReviews.approval')}</p><fieldset disabled={blocked}><legend>{t('customerReviews.rating')}</legend><div className="customer-reviews__ratings">{[1,2,3,4,5].map(value=><label className="customer-reviews__star-choice" key={value}><input type="radio" name={`${id}-rating`} required value={value} aria-label={`${t('customerReviews.rating')}: ${new Intl.NumberFormat(i18n.resolvedLanguage).format(value)} / 5`} checked={Number(rating)===value} onChange={()=>setDraft({rating:value,text,displayName})}/><span aria-hidden="true">★ <small>{new Intl.NumberFormat(i18n.resolvedLanguage).format(value)}</small></span></label>)}</div>{rating&&<p className="customer-reviews__selected">{t('customerReviews.rating')}: {new Intl.NumberFormat(i18n.resolvedLanguage).format(Number(rating))} / 5</p>}</fieldset>
    <label>{t('customerReviews.text')}<textarea required disabled={blocked} value={text} onChange={e=>setDraft({rating,text:e.target.value,displayName})} aria-invalid={invalid||undefined} aria-describedby={`${id}-count${invalid?` ${id}-error`: ''}`}/></label>
    <p id={`${id}-count`} className="customer-reviews__counter"><span>{t('customerReviews.counter',{number:new Intl.NumberFormat(i18n.resolvedLanguage).format(reviewTextCount(text)),maximum:new Intl.NumberFormat(i18n.resolvedLanguage).format(2000)})}</span><span>{t('customerReviews.minimum',{minimum:new Intl.NumberFormat(i18n.resolvedLanguage).format(20)})}</span></p>
    {invalid&&<p id={`${id}-error`} role="alert">{t('customerReviews.validation')}</p>}<button className="button button--primary" disabled={blocked} type="submit">{t(actions.edit?'customerReviews.edit':'customerReviews.submit')}</button>
  </form>}
    <button className="button button--secondary" type="button" disabled={state.busy} onClick={()=>setExpanded(false)}>{t('common.cancel')}</button></div>
  {actions.withdraw&&<button className="button button--secondary" type="button" disabled={withdrawalBlocked} onClick={()=>setConfirm(true)}>{t('customerReviews.withdraw')}</button>}
  <AccessibleDialog open={confirm} onClose={()=>setConfirm(false)} className="customer-reviews-modal" ariaLabelledBy={`${id}-withdraw-title`}><div className="customer-reviews__dialog"><h2 id={`${id}-withdraw-title`}>{t('customerReviews.withdraw')}</h2><p>{t(`customerReviews.${withdrawalCopy(own)}`)}</p><button className="button button--secondary" onClick={()=>{setConfirm(false);void controller.execute('withdraw',{publicReviewId:own.publicReviewId,expectedVersion:own.version})}}>{t('customerReviews.withdraw')}</button><button className="button button--secondary" onClick={()=>setConfirm(false)}>{t('common.cancel')}</button></div></AccessibleDialog></>
}
export function ReportDialog({review,api,user,profile,onClose,open,onRefresh}) {
  const {t,i18n}=useTranslation()
  const [state,controller]=useReviews(api,undefined,user,false,false)
  const [reason,setReason]=useState('')
  const [details,setDetails]=useState('')
  const permission=reviewPermission(user,profile,null,true)
  const tooLong=reviewTextCount(details)>2000||/[\uD800-\uDFFF]/u.test(details)
  return <AccessibleDialog className="customer-reviews-modal" open={open} onClose={onClose} closeDisabled={state.busy} ariaLabelledBy="review-report-title"><div className="customer-reviews__dialog"><h2 id="review-report-title">{t('customerReviews.report')}</h2><p>{t('customerReviews.reportNotice')}</p><Feedback state={state} controller={controller} onRefresh={onRefresh}/>
    {permission?<Guidance code={permission}/>:!state.feedback&&<form onSubmit={e=>{e.preventDefault();if(!tooLong)void controller.execute('report',{publicReviewId:review.publicReviewId,observedPublishedRevision:review.publishedRevision,reasonCode:reason,details:details.trim().normalize('NFC')})}}>
      <fieldset disabled={state.busy||state.uncertain||!!state.error}><legend>{t('customerReviews.reason')}</legend>{reviewReasons.map(value=><label key={value}><input type="radio" name="review-report-reason" value={value} required checked={reason===value} onChange={()=>setReason(value)}/>{t(`customerReviews.${value}`)}</label>)}</fieldset>
      <label>{t('customerReviews.details')}<textarea disabled={state.busy||state.uncertain||!!state.error} value={details} onChange={e=>setDetails(e.target.value)}/></label><p>{new Intl.NumberFormat(i18n.resolvedLanguage).format(reviewTextCount(details))} / {new Intl.NumberFormat(i18n.resolvedLanguage).format(2000)}</p>
      <button className="button button--primary" type="submit" disabled={tooLong||state.busy||state.uncertain||!!state.error}>{t('customerReviews.submitReport')}</button></form>}
    <button className="button button--secondary" disabled={state.busy} onClick={onClose}>{t('common.close')}</button></div></AccessibleDialog>
}
function OwnListItem({review,state,controller,user,profile}) {
  const {t}=useTranslation()
  return <article><AuthorForm own={review} state={state} controller={controller} user={user} profile={profile} businessId={review.businessId}/>{review.businessAvailable&&<Link to={`/services/${encodeURIComponent(review.businessId)}`}>{t('services.viewBusiness')}</Link>}</article>
}
export default function CustomerReviews({api,businessId,user,profile,ownOnly=false,onMutation}) {
  const {t,i18n}=useTranslation()
  const [state,controller]=useReviews(api,businessId,user,ownOnly)
  const [report,setReport]=useState(null)
  const [reportOpen,setReportOpen]=useState(false)
  useEffect(()=>{if(['submit','edit','withdraw'].includes(state.feedback))onMutation?.()},[state.feedback,onMutation])
  return <section id="business-reviews" className="customer-reviews" aria-labelledby="customer-reviews-title">{ownOnly?<h2 id="customer-reviews-title">{t('customerReviews.myReviews')}</h2>:<AuthorForm key={`${user?.uid??'anonymous'}:${businessId}`} heading own={state.own} state={state} controller={controller} user={user} profile={profile} businessId={businessId}/> }
    <Feedback state={state} controller={controller}/>{(state.loading||!state.ready)&&<p role="status">{t('common.loading')}</p>}
    {!state.loading&&state.error&&state.error!=='refresh'&&!state.uncertain&&<button className="button button--secondary" onClick={()=>void controller.load()}>{t('common.retry')}</button>}
    {state.ready&&!state.loading&&!state.error&&state.items.length===0&&<p>{t('customerReviews.empty')}</p>}
    {state.items.map(review=>ownOnly?<OwnListItem key={`${user?.uid}:${review.publicReviewId}`} review={review} state={state} controller={controller} user={user} profile={profile}/>:<article key={review.publicReviewId}><h3>{review.reviewerAlias||t('customerReviews.reviewer')}</h3><p className="customer-reviews__rating" aria-label={t('customerReviews.rating')}><span aria-hidden="true">★ </span>{new Intl.NumberFormat(i18n.resolvedLanguage).format(review.rating)} / 5</p><ReviewDates review={review}/><ReviewText review={review} api={api}/><button className="button button--text customer-reviews__report" onClick={()=>{setReport(review);setReportOpen(true)}}>{t('customerReviews.report')}</button></article>)}
    {state.cursor&&<button className="button button--secondary" disabled={state.loading||state.busy||state.uncertain} onClick={()=>void controller.load(true)}>{t('customerReviews.more')}</button>}
    {report&&<ReportDialog key={`${user?.uid??'anonymous'}:${report.publicReviewId}:${report.publishedRevision}`} open={reportOpen} review={report} api={api} user={user} profile={profile} onClose={()=>setReportOpen(false)} onRefresh={()=>{setReport(null);setReportOpen(false);void controller.load()}}/>}
  </section>
}
