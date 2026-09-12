// PageView is a base capability, not history detection. The application must
// additionally prove send_page_view:false and one manual event with the real tag.
export function checkTagSettings(tags) {
 const auto=tags.filter(t=>t.function==='__ogt_auto_events')
 const provided=tags.filter(t=>t.function==='__ogt_1p_data_v2')
 const expected=['OutboundClick','Scroll','Download','HistoryEvents','Form','Video']
 const unsafeAuto=auto.length!==1 || expected.some(k=>auto[0][`vtp_enable${k}`]!==false)
  || auto.some(t=>Object.entries(t).some(([k,v])=>k.startsWith('vtp_enable')&&k!=='vtp_enablePageView'&&v===true))
 const unsafeProvided=provided.length!==1 || provided[0].vtp_isEnabled!==false
 const signals=tags.filter(t=>t.function==='__ccd_ga_regscope').flatMap(t=>t.vtp_settingsTable??[])
  .some(row=>Array.isArray(row)&&row.includes('GOOGLE_SIGNALS')&&row[row.indexOf('disallowAllRegions')+1]===true)
 const redaction=tags.some(t=>t.function==='__ccd_auto_redact'&&t.vtp_redactEmail===true)
 return {unsafeAuto,unsafeProvided,safeSettings:!unsafeAuto&&!unsafeProvided&&signals&&redaction}
}
