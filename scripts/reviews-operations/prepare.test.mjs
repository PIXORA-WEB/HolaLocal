import test from 'node:test'
import assert from 'node:assert/strict'
import {prepare,callables} from './prepare.mjs'
test('offline artifacts cannot activate alerts or create channels; explicit scoped inputs',()=>{
 assert.throws(()=>prepare());assert.throws(()=>prepare({projectId:'holalocal-491c9',notificationChannels:['name@example.test']}));assert.throws(()=>prepare({projectId:'holalocal-491c9',notificationChannels:['projects/other-project/notificationChannels/123']}))
 const p=prepare({projectId:'holalocal-491c9'});assert.equal(p.readyToNotify,false);assert.equal(p.policies.length,7);assert.equal(p.metrics.length,2)
 for(const a of p.policies){assert.equal(a.enabled,false);assert.deepEqual(a.notificationChannels,[]);assert.equal(a.conditions.length,1)}
 assert.equal(new Set(callables).size,16)
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
