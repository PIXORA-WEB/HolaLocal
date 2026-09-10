import test from 'node:test'
import assert from 'node:assert/strict'
import {customerReviewQuotaPolicy,customerReviewReportQuotaPolicy,CUSTOMER_REVIEW_WINDOW_MS as day} from '../src/customerReviewQuotas.js'
import {runCustomerReviewRetention} from '../src/customerReviewRetention.js'
for(const [policy,limit,kind] of [[customerReviewQuotaPolicy,5,'review'],[customerReviewReportQuotaPolicy,10,'report']]) {
 test(`${kind} rolling quota: exact boundary, staggered timestamps, no fixed-day reset`,()=>{
  let current=null
  for(let i=0;i<limit;i++)current=policy.reserve({current,now:day+i})
  const before=structuredClone(current)
  assert.throws(()=>policy.reserve({current,now:2*day-1}),new RegExp(`${kind}-quota-exceeded`))
  assert.deepEqual(current,before)
  current=policy.reserve({current,now:2*day})
  assert.equal(current.acceptedAt.length,limit)
  assert.equal(current.acceptedAt[0],day+1)
  assert.throws(()=>policy.reserve({current,now:2*day}),/quota-exceeded/)
  assert.equal(policy.reserve({current,now:4*day}).acceptedAt.length,1)
 })
 test(`${kind} quota fails closed for legacy or corrupt counters`,()=>{
  for(const current of [{used:0},{schemaVersion:1,acceptedAt:[NaN]},{schemaVersion:1,acceptedAt:[11]},
   {schemaVersion:1,acceptedAt:[2,1]},{schemaVersion:1,acceptedAt:Array(limit+1).fill(1)},
   {schemaVersion:1,acceptedAt:[],forged:true}]) assert.throws(()=>policy.reserve({current,now:10}),/invalid-.*-quota/)
 })
}
test('retention defaults off before Firestore construction',async()=>{
 assert.deepEqual(await runCustomerReviewRetention({env:{},createDatabase:()=>assert.fail('must stay disabled')}),{disabled:true})
})
