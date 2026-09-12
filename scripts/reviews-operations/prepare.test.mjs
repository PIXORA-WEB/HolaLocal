import test from 'node:test'
import assert from 'node:assert/strict'
import {prepare,callables} from './prepare.mjs'
test('offline artifacts cannot activate alerts or create channels; explicit scoped inputs',()=>{
 assert.throws(()=>prepare());assert.throws(()=>prepare({projectId:'holalocal-491c9',notificationChannels:['name@example.test']}));assert.throws(()=>prepare({projectId:'holalocal-491c9',notificationChannels:['projects/other-project/notificationChannels/123']}))
 const p=prepare({projectId:'holalocal-491c9'});assert.equal(p.readyToNotify,false);assert.equal(p.policies.length,12);assert.equal(p.metrics.length,3)
 for(const a of p.policies){assert.equal(a.enabled,false);assert.deepEqual(a.notificationChannels,[]);assert.equal(a.conditions.length,1)}
 assert.equal(new Set(callables).size,17)
})
test('delivery heartbeat distinct from retention completion, errors scoped and expected auth/gate errors excluded',()=>{
 const p=prepare({projectId:'synthetic-test-project',notificationChannels:['projects/synthetic-test-project/notificationChannels/123']})
 assert.match(p.metrics[0].filter,/AttemptFinished/);assert.match(p.metrics[0].filter,/httpRequest.status>=200/);assert.match(p.metrics[1].filter,/jsonPayload.deleted/)
 const conditions=p.policies.map(p=>p.conditions[0]);assert.equal(conditions[2].conditionThreshold.aggregations[0].alignmentPeriod,'7200s');assert.match(p.policies[3].documentation.content,/ONLY arm/)
 assert.match(conditions[5].conditionThreshold.filter,/response_code_class="5xx"/);assert.equal(conditions[6].conditionThreshold.thresholdValue,10000)
 assert.ok(!JSON.stringify(p).includes('holalocal-491c9'));assert.ok(!JSON.stringify(p).includes('allUsers'))
 for(const m of p.metrics)assert.equal(m.metricDescriptor.labels,undefined)
 for(const a of p.policies)assert.equal(a.conditions[0].conditionMatchedLog?.labelExtractors,undefined)
})

test('translation warning coverage includes text and structured logs without sensitive labels',()=>{
 const p=prepare({projectId:'holalocal-491c9'});assert.ok(callables.includes('translatePublishedCustomerReview'))
 const warning=p.policies.find(p=>p.displayName.endsWith('translation-failure'))
 assert.match(warning.conditions[0].conditionMatchedLog.filter,/service_name="translatepublishedcustomerreview"/)
 assert.match(warning.conditions[0].conditionMatchedLog.filter,/jsonPayload.message="google_translation_failure" OR textPayload:/)
 for(const name of ['callable-server-errors','callable-latency'])assert.match(p.policies.find(p=>p.displayName.endsWith(name)).conditions[0].conditionThreshold.filter,/translatepublishedcustomerreview/)
 assert.equal(warning.enabled,false);assert.deepEqual(warning.notificationChannels,[]);assert.equal(warning.conditions[0].conditionMatchedLog.labelExtractors,undefined)
})

test('no staffing promise or routine duplicate email channels in the offline plan',()=>{
 const p=prepare({projectId:'holalocal-491c9',notificationChannels:['projects/holalocal-491c9/notificationChannels/13796860726352907332']})
 assert.ok(!JSON.stringify(p).includes('within one staffed hour'))
 for(const policy of p.policies){if(policy.conditions[0].conditionMatchedLog)assert.equal(policy.alertStrategy.notificationRateLimit.period,'86400s');assert.equal(policy.alertStrategy.notificationChannelStrategy,undefined)}
 for(const name of ['callable-server-errors','callable-latency'])assert.deepEqual(p.policies.find(p=>p.displayName.endsWith(name)).notificationChannels,[])
 assert.ok(!p.policies.find(p=>p.displayName.endsWith('runtime-error')).conditions[0].conditionMatchedLog.filter.includes('sweepresolvedcustomerreviewreports'))
})

test('unattended recovery and partial retention failures get counts-only, disabled coverage',()=>{
 const p=prepare({projectId:'holalocal-491c9'})
 for(const id of ['retention-record-failure','recovery-action-required','recovery-scheduler-failure','recovery-missing-completion'])assert.equal(p.policies.find(v=>v.displayName.endsWith(id)).enabled,false)
 assert.match(p.metrics[2].filter,/account-deletion-recovery/)
 assert.match(p.policies.find(v=>v.displayName.endsWith('retention-record-failure')).conditions[0].conditionMatchedLog.filter,/failedRecords>0/)
})

test('metric alert filters use API-supported one_of without mixed resource-label AND/OR',()=>{
 const {policies}=prepare({projectId:'holalocal-491c9'})
 for(const id of ['callable-server-errors','callable-latency']){
  const filter=policies.find(p=>p.displayName.endsWith(id)).conditions[0].conditionThreshold.filter
  assert.ok(!filter.includes(' OR '))
  const values=JSON.parse('['+filter.match(/one_of\(([^)]+)\)/)[1]+']')
  assert.equal(values.length,17);assert.equal(new Set(values).size,17)
  assert.ok(values.includes('translatepublishedcustomerreview'))
  assert.ok(filter.includes('resource.labels.location="europe-west1"'))
 }
})
