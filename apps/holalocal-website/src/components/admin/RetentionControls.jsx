import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RETENTION_EXECUTION_LIMIT } from '@holalocal/firebase-contract'
import AccessibleDialog from '../common/AccessibleDialog.jsx'
import { manageRetentionRecords } from '../../services/adminAccountDeletionService.js'
import { adminRetentionCopy } from '../../i18n/adminRetentionCopy.js'

const freshForm = () => ({action:'hold',reason:'',endingCondition:'',reviewAt:'',messageId:'',subjectUid:''})
export default function RetentionControls() {
  const {i18n,t}=useTranslation(), copy=adminRetentionCopy[i18n.language.split('-')[0]]??adminRetentionCopy.en
  const [open,setOpen]=useState(false),[kind,setKind]=useState('acknowledgment'),[cursor,setCursor]=useState(null),[reload,setReload]=useState(0)
  const [view,setView]=useState({rows:[],cleanupEnabled:false}),[loading,setLoading]=useState(false),[error,setError]=useState(false)
  const [selected,setSelected]=useState([]),[record,setRecord]=useState(null),[form,setForm]=useState(freshForm),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[results,setResults]=useState([])
  const heading=useRef(null)
  useEffect(()=>{
    if(!open)return
    let active=true
    setLoading(true);setError(false);setSelected([]);setView({rows:[],cleanupEnabled:false})
    manageRetentionRecords({action:'list',kind,cursor}).then(data=>{if(active){setView(data);setLoading(false)}}).catch(()=>{if(active){setError(true);setLoading(false)}})
    return ()=>{active=false}
  },[open,kind,cursor,reload])
  const status=row=>row.evidencePresent===false?copy.removed:row.decision.status==='needs-assessment'?copy.assess:copy[row.decision.status]??row.decision.status
  const close=()=>{if(!busy){setRecord(null);setConfirm(false)}}
  async function submit(event){
    event.preventDefault();if(busy)return
    const formElement=event.currentTarget
    setBusy(true);setError(false)
    try{
      if(confirm){
        const response=await manageRetentionRecords({action:'execute',kind,ids:selected})
        if(response.disabled)throw new Error('disabled')
        setResults(response.results??[])
      }else{
        const data=form.action==='resolve'?{action:'resolve',kind,id:record.id,summary:form.reason}
          :form.action==='redact'?{action:'redact',kind,id:record.id,messageId:form.messageId,subjectUid:form.subjectUid,reason:form.reason}
            :{action:'assess',kind,id:record.id,expectedRevision:record.decision.revision,decision:form.action,reason:form.reason,...(form.action==='hold'?{endingCondition:form.endingCondition,reviewAt:new Date(form.reviewAt).toISOString()}:{})}
        const response=await manageRetentionRecords(data)
        setResults([{id:record.id,...response}])
      }
      setRecord(null);setConfirm(false);setReload(value=>value+1)
    }catch(error){setError(true);if(String(error?.message).includes('future-review-date'))formElement.querySelector('input[type=datetime-local]')?.focus()}finally{setBusy(false)}
  }
  function select(row){setForm(freshForm());setRecord(row);setError(false)}
  const kindLabels={'acknowledgment':copy.acknowledgments,'business-report':copy.reports,conversation:copy.conversations}
  return <details className="admin-panel admin-retention" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary ref={heading}>{copy.title}</summary>
    {open&&<>
      <p className="admin-panel__note">{copy.notice}</p>
      <div className="admin-toolbar"><label>{copy.title}<select aria-label={copy.title} disabled={busy} value={kind} onChange={event=>{setKind(event.target.value);setCursor(null);setResults([])}}>{Object.entries(kindLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <button className="button button--secondary" type="button" disabled={busy||loading} onClick={()=>{setCursor(null);setReload(value=>value+1)}}>{copy.reset}</button></div>
      {!view.cleanupEnabled&&<p role="status">{copy.closed}</p>}
      {error&&<p className="admin-alert" role="alert">{copy.failed}</p>}
      {loading?<p role="status">{t('common.loading')}</p>:view.rows.length===0?<p className="admin-empty">{copy.empty}</p>:<div className="admin-deletion-list">{view.rows.map(row=><div className="admin-retention__record" key={row.id}>
        <input type="checkbox" aria-label={`${copy.execute}: ${row.id}`} disabled={busy||!view.cleanupEnabled||(!selected.includes(row.id)&&selected.length>=RETENTION_EXECUTION_LIMIT)} checked={selected.includes(row.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,row.id]:current.filter(id=>id!==row.id))}/>
        <div><code>{row.id}</code><p>{status(row)}{row.decision.reviewAt?` · ${new Date(row.decision.reviewAt).toLocaleString(i18n.language)}`:''}</p>{row.resolvedAt&&<p>{copy.resolve}: {new Date(row.resolvedAt).toLocaleString(i18n.language)}</p>}</div>
        <button className="button button--secondary" type="button" disabled={busy||row.evidencePresent===false} onClick={()=>select(row)}>{copy.review}</button>
      </div>)}</div>}
      <div className="admin-toolbar"><button className="button button--secondary" type="button" disabled={loading||busy||!view.nextCursor} onClick={()=>setCursor(view.nextCursor)}>{copy.next}</button>
        <button className="button button--danger" type="button" disabled={busy||loading||!view.cleanupEnabled||!selected.length} onClick={()=>setConfirm(true)}>{copy.execute} ({selected.length}/{RETENTION_EXECUTION_LIMIT})</button></div>
      {results.length>0&&<ul aria-live="polite">{results.map(result=><li key={result.id}><code>{result.id}</code>: {result.failed?copy.failed:result.held||result.blocked||result.accountRetained||result.notDue?copy.held:result.needsAssessment?copy.assess:result.removed||result.redacted?copy.removed:result.disabled?copy.closed:copy.done}{result.complete===false?` · ${copy.execute}`:''}</li>)}</ul>}
    </>}
    <AccessibleDialog open={Boolean(record)||confirm} onClose={close} closeDisabled={busy} className="admin-action-dialog" ariaLabelledBy="retention-dialog-title">
      <form className="admin-action-dialog__panel admin-retention__form" onSubmit={submit}>
        <h2 id="retention-dialog-title">{confirm?copy.execute:copy.review}</h2>
        {confirm?<p>{copy.confirm}</p>:record&&<>
          <code>{record.id}</code><p>{status(record)}</p>
          {record.details&&<p>{record.details}</p>}
          <dl className="admin-detail-list"><div><dt>{copy.reviewer}</dt><dd>{record.decision.reviewerId??'—'}</dd></div><div><dt>{copy.reason}</dt><dd>{record.decision.reason??'—'}</dd></div><div><dt>{copy.ending}</dt><dd>{record.decision.endingCondition??'—'}</dd></div></dl>
          <label>{copy.review}<select disabled={busy} value={form.action} onChange={event=>setForm({...freshForm(),action:event.target.value})}><option value="hold">{copy.hold}</option><option value="release" disabled={!['held','overdue'].includes(record.decision.status)}>{copy.release}</option>{kind==='business-report'&&record.status==='open'&&<option value="resolve">{copy.resolve}</option>}{kind==='conversation'&&<option value="redact" disabled={!view.cleanupEnabled}>{copy.redact}</option>}</select></label>
          <label>{copy.reason}<textarea required minLength={3} maxLength={500} disabled={busy} value={form.reason} onChange={event=>setForm({...form,reason:event.target.value})}/></label>
          {form.action==='hold'&&<><label>{copy.ending}<textarea required minLength={3} maxLength={500} disabled={busy} value={form.endingCondition} onChange={event=>setForm({...form,endingCondition:event.target.value})}/></label><label>{copy.reviewAt}<input required type="datetime-local" disabled={busy} value={form.reviewAt} onChange={event=>setForm({...form,reviewAt:event.target.value})}/></label></>}
          {form.action==='redact'&&<><p>{copy.confirm}</p><label>{copy.message}<input required maxLength={128} disabled={busy} value={form.messageId} onChange={event=>setForm({...form,messageId:event.target.value})}/></label><label>{copy.subject}<input required maxLength={128} disabled={busy} value={form.subjectUid} onChange={event=>setForm({...form,subjectUid:event.target.value})}/></label></>}
        </>}
        {error&&<p role="alert">{copy.failed}</p>}
        <button autoFocus className="button button--secondary" disabled={busy} type="button" onClick={close}>{t('common.cancel')}</button>
        <button className={`button button--${confirm||form.action==='redact'?'danger':'primary'}`} disabled={busy} type="submit">{busy?t('common.loading'):confirm?copy.execute:copy[form.action]}</button>
      </form>
    </AccessibleDialog>
  </details>
}
