import test from 'node:test'
import assert from 'node:assert/strict'
import {checkTagSettings} from '../scripts/analyticsTagSettings.mjs'
const tags=()=>[
 {function:'__ogt_auto_events',...Object.fromEntries(['OutboundClick','Scroll','Download','HistoryEvents','Form','Video'].map(k=>['vtp_enable'+k,false])),vtp_enablePageView:true},
 {function:'__ogt_1p_data_v2',vtp_isEnabled:false,vtp_isAutoCollectPiiEnabledFlag:true},
 {function:'__ccd_ga_regscope',vtp_settingsTable:['list',['map','redactFieldGroup','GOOGLE_SIGNALS','disallowAllRegions',true]]},
 {function:'__ccd_auto_redact',vtp_redactEmail:true}]
test('base page-view capability is compatible with app suppression; inactive PII flag is not collection',()=>assert.equal(checkTagSettings(tags()).safeSettings,true))
for(const key of ['OutboundClick','Scroll','Download','HistoryEvents','Form','Video','UnknownDetector'])test(`reject enabled ${key}`,()=>{const t=tags();t[0]['vtp_enable'+key]=true;assert.equal(checkTagSettings(t).safeSettings,false)})
test('reject enabled user data, missing settings, signals and redaction',()=>{
 for(const index of [0,1,2,3])assert.equal(checkTagSettings(tags().filter((_,i)=>i!==index)).safeSettings,false)
 const t=tags();t[1].vtp_isEnabled=true;assert.equal(checkTagSettings(t).safeSettings,false)
})
