import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCustomerReviewSlot, validateCustomerReviewSubmission, customerReviewSlotKey,
  assertCustomerReviewSlot, projectPublishedCustomerReview, CUSTOMER_REVIEW_PUBLIC_FIELDS,
  customerReviewCodePointLength,
} from '../customerReviewContracts.js'
import {
  evaluateCustomerReviewEligibility, isCustomerReviewAdmin, transitionCustomerReview,
  customerReviewRatingContribution, customerReviewRatingDelta, applyCustomerReviewRatingDelta,
  customerReviewRatingAverage, assertCustomerReviewAggregate, CUSTOMER_REVIEW_TRANSITIONS,
} from '../customerReviewLifecycle.js'
import { customerReviewTranslationCacheKey, customerReviewSourceLanguages } from '../customerReviewTranslation.js'
import { SUPPORTED_LANGUAGE_CODES } from '../constants.js'

const business = {
  businessId: 'business', ownerId: 'owner', managerIds: ['owner','manager'],
  name: 'Synthetic business', description: 'Synthetic description', primaryCategoryId: 'plumber',
  categoryIds: ['plumber'], serviceAreas: ['malaga'], languages: ['en'], primaryLanguage: 'en',
  location: { locality: 'Málaga', region: 'Málaga', countryCode: 'ES' },
  contact: { phone:'',phoneVisible:false,email:'',emailVisible:false,website:'',websiteVisible:false,
    whatsappNumber:'',whatsappVisible:false,preferredContactMethod:'holalocal',allowCallbackRequests:false },
  status: 'active', publishedAt: 1, deletedAt: null, deletionRequestedAt: null,
}
const identity = { uid: 'customer', emailVerified: true }
const account = { uid:'customer',accountStatus:'active',roles:['customer'],deletionRequestedAt:null }
const original = { rating: 4, originalText: 'A helpful and carefully explained service.', declaredSourceLanguage: 'en' }
const edited = { rating: 2, originalText: 'An amended account of the service received.', declaredSourceLanguage: null }
const admin = { uid:'admin',admin:true }
const empty = () => createCustomerReviewSlot({ businessId:'business',authorUid:'customer',publicReviewId:'opaque-public-review-01' })
const step = (slot, action, overrides={}) => transitionCustomerReview(slot, {
  action, expectedVersion:slot.version, actor:['approve','reject','remove'].includes(action)?admin:identity,
  authorIdentity:identity,authorAccount:account,business,submission:original,...overrides,
})
const pending = () => step(empty(),'submit')
const published = () => step(pending(),'approve')
const expectCode = (fn, code) => assert.throws(fn, error => error.code === code)

test('submission enforces inclusive configurable bounds after trim/NFC by Unicode code points', () => {
  for(const length of [20,2000]) assert.equal(validateCustomerReviewSubmission({...original,originalText:'a'.repeat(length)}).valid,true)
  for(const length of [0,19,2001]) assert.equal(validateCustomerReviewSubmission({...original,originalText:'a'.repeat(length)}).valid,false)
  const result=validateCustomerReviewSubmission({...original,originalText:' \n'+'e\u0301'.repeat(20)+'\t '})
  assert.equal(result.value.originalText,'é'.repeat(20))
  assert.equal(customerReviewCodePointLength(result.value.originalText),20)
  assert.equal(validateCustomerReviewSubmission({...original,originalText:'😀'.repeat(20)}).valid,true)
  assert.equal(validateCustomerReviewSubmission({...original,originalText:'😀'.repeat(19)}).valid,false)
  assert.equal(validateCustomerReviewSubmission({...original,originalText:' a '},{min:1,max:1}).value.originalText,'a')
  for(const bounds of [{min:0,max:20},{min:30,max:20},{min:1.5,max:20},null]) expectCode(()=>validateCustomerReviewSubmission(original,bounds),'invalid-text-bounds')
})

test('submission rejects malformed types, extra fields, surrogates and invalid languages without mutation', () => {
  for(const value of [null,undefined,[],42,'text',new Date()]) assert.equal(validateCustomerReviewSubmission(value).valid,false)
  for(const rating of [0,6,1.5,'5',true,NaN,Infinity,null]) assert.equal(validateCustomerReviewSubmission({...original,rating}).valid,false)
  for(const originalText of [null,42,{},' \n\t\u00a0','\uD800'.repeat(20)]) assert.equal(validateCustomerReviewSubmission({...original,originalText}).valid,false)
  for(const field of ['authorUid','translatedText','status','interfaceLanguage','detectedSourceLanguage']) assert.equal(validateCustomerReviewSubmission({...original,[field]:'injected'}).valid,false)
  for(const language of ['',42,{},'not a language']) assert.equal(validateCustomerReviewSubmission({...original,declaredSourceLanguage:language}).valid,false)
  assert.equal(validateCustomerReviewSubmission({...original,declaredSourceLanguage:'zh-Hant'}).valid,true)
  const payload=Object.freeze({...original,originalText:'  '+original.originalText+'  '})
  const accepted=validateCustomerReviewSubmission(payload).value
  assert.equal(payload.originalText,'  '+original.originalText+'  ')
  assert.ok(Object.isFrozen(accepted))
  assert.equal(accepted.originalText,original.originalText)
})

test('private slot identity is deterministic, ordered and unambiguous; public identity is separate', () => {
  assert.equal(customerReviewSlotKey('business','customer'),customerReviewSlotKey('business','customer'))
  assert.notEqual(customerReviewSlotKey('a_b','c'),customerReviewSlotKey('a','b_c'))
  assert.notEqual(customerReviewSlotKey('a','b'),customerReviewSlotKey('b','a'))
  expectCode(()=>customerReviewSlotKey('a/b','c'),'invalid-slot-identity')
  expectCode(()=>createCustomerReviewSlot({businessId:'a',authorUid:'customer-long-identity',publicReviewId:'customer-long-identity'}),'invalid-public-review-id')
  assert.equal(empty().status,'empty')
})

test('eligibility models trusted account, verification, role, public lifecycle and ownership requirements', () => {
  const eligible=(patch={})=>evaluateCustomerReviewEligibility({identity,account,business,...patch})
  assert.equal(eligible().eligible,true)
  assert.equal(eligible({account:{...account,roles:['business','customer']}}).eligible,true)
  for(const id of [null,{}, {uid:'customer',emailVerified:false}]) assert.equal(eligible({identity:id}).eligible,false)
  for(const status of ['suspended','deleted','deletion_pending',null]) assert.equal(eligible({account:{...account,accountStatus:status}}).eligible,false)
  for(const patch of [{uid:'someone-else'},{roles:['business']},{roles:'customer'},{deletionRequestedAt:1}]) assert.equal(eligible({account:{...account,...patch}}).eligible,false)
  for(const uid of ['owner','manager']) assert.equal(eligible({identity:{uid,emailVerified:true},account:{...account,uid}}).reason,'self-review-forbidden')
  for(const patch of [{status:'pending_review'},{status:'suspended'},{publishedAt:null},{deletedAt:1},{deletionRequestedAt:1},{name:''},{managerIds:42}]) assert.equal(eligible({business:{...business,...patch}}).eligible,false)
  assert.equal(isCustomerReviewAdmin({uid:'moderator',moderator:true}),false)
  assert.equal(isCustomerReviewAdmin({admin:true}),false)
  assert.equal(isCustomerReviewAdmin(admin),true)
})

test('new submission requires approval and public projection is an explicit allowlist', () => {
  const first=pending()
  assert.equal(projectPublishedCustomerReview(first),null)
  const approved=step(first,'approve')
  const projection=projectPublishedCustomerReview({...approved,moderationNotes:'private',email:'private@example.com',revisions:approved.revisions.map(r=>({...r,privateNote:'hidden'}))})
  assert.deepEqual(Object.keys(projection),CUSTOMER_REVIEW_PUBLIC_FIELDS)
  assert.equal(projection.originalText,original.originalText)
  assert.equal(projection.rating,4)
  assert.ok(!JSON.stringify(projection).includes('private'))
  assert.ok(!Object.hasOwn(projection,'authorUid'))
})

test('pending/rejected edits retain published original/rating; approval replaces exactly that version', () => {
  const first=published(), edit=step(first,'submit',{submission:edited})
  assert.equal(edit.status,'pending')
  assert.equal(edit.pendingRevision,2)
  assert.equal(edit.publishedRevision,1)
  assert.equal(projectPublishedCustomerReview(edit).originalText,original.originalText)
  const rejected=step(edit,'reject')
  assert.equal(rejected.status,'rejected')
  assert.equal(projectPublishedCustomerReview(rejected).rating,4)
  const approved=step(edit,'approve')
  assert.equal(approved.publishedRevision,2)
  assert.equal(projectPublishedCustomerReview(approved).originalText,edited.originalText)
  assert.equal(first.revisions[0].originalText,original.originalText)
  assert.ok(Object.isFrozen(approved) && Object.isFrozen(approved.revisions) && Object.isFrozen(approved.revisions[0]))
  assert.throws(()=>{approved.revisions[0].originalText='overwrite'},TypeError)
})

test('withdrawal/removal cancel pending edits and stale approvals cannot resurrect content', () => {
  for(const action of ['withdraw','remove']) {
    const edit=step(published(),'submit',{submission:edited}), next=step(edit,action)
    assert.equal(next.status,action==='withdraw'?'withdrawn':'removed')
    assert.equal(next.pendingRevision,null)
    assert.equal(next.publishedRevision,null)
    assert.equal(projectPublishedCustomerReview(next),null)
    expectCode(()=>step(next,'approve',{expectedVersion:edit.version}),'review-version-conflict')
    expectCode(()=>step(next,'approve'),'invalid-review-transition')
    expectCode(()=>step(next,action),'invalid-review-transition')
  }
  assert.equal(step(step(pending(),'withdraw'),'submit').status,'pending')
  assert.equal(step(step(pending(),'reject'),'submit').status,'pending')
  expectCode(()=>step(step(pending(),'remove'),'submit'),'invalid-review-transition')
})

test('transition table is exhaustive and permissions/expected versions are checked', () => {
  const states={empty:empty(),pending:pending(),published:published(),rejected:step(pending(),'reject'),withdrawn:step(pending(),'withdraw'),removed:step(pending(),'remove')}
  for(const [action,allowed] of Object.entries(CUSTOMER_REVIEW_TRANSITIONS)) {
    for(const [status,slot] of Object.entries(states)) {
      if(allowed.includes(status)) assertCustomerReviewSlot(step(slot,action))
      else expectCode(()=>step(slot,action),'invalid-review-transition')
    }
  }
  for(const action of ['approve','reject','remove']) expectCode(()=>step(pending(),action,{actor:{uid:'mod',moderator:true}}),'admin-required')
  for(const action of ['submit','withdraw']) expectCode(()=>step(action==='submit'?empty():pending(),action,{actor:{uid:'stranger'}}),'author-required')
  expectCode(()=>step(pending(),'approve',{authorIdentity:{...identity,emailVerified:false}}),'verified-email-required')
  expectCode(()=>step(pending(),'approve',{business:{...business,managerIds:['owner','customer']}}),'self-review-forbidden')
  expectCode(()=>step(empty(),'submit',{business:{...business,businessId:'other'}}),'review-context-mismatch')
  expectCode(()=>step(empty(),'submit',{expectedVersion:-1}),'review-version-conflict')
  expectCode(()=>step(empty(),'publish'),'invalid-review-transition')
})

test('integer aggregate deltas preserve pending/rejected edits and remove published contributions once', () => {
  const first=pending(), approved=step(first,'approve'), edit=step(approved,'submit',{submission:edited})
  let aggregate={sum:0,count:0}
  const transitions=[[empty(),first,0,0],[first,approved,4,1],[approved,edit,0,0],[edit,step(edit,'reject'),0,0],[edit,step(edit,'approve'),-2,0]]
  for(const [before,after,sum,count] of transitions) {
    const delta=customerReviewRatingDelta(before,after)
    assert.deepEqual(delta,{sum,count})
    aggregate=applyCustomerReviewRatingDelta(aggregate,delta)
  }
  assert.deepEqual(aggregate,{sum:2,count:1})
  const current=step(edit,'approve'), withdrawn=step(current,'withdraw')
  const delta=customerReviewRatingDelta(current,withdrawn)
  assert.deepEqual(delta,{sum:-2,count:-1})
  aggregate=applyCustomerReviewRatingDelta(aggregate,delta)
  assert.deepEqual(aggregate,{sum:0,count:0})
  assert.equal(customerReviewRatingAverage(aggregate),null)
  assert.equal(customerReviewRatingAverage({sum:9,count:2}),4.5)
  assert.deepEqual(customerReviewRatingContribution(step(first,'reject')),{sum:0,count:0})
  assert.deepEqual(customerReviewRatingDelta(edit,step(edit,'remove')),{sum:-4,count:-1})
  expectCode(()=>applyCustomerReviewRatingDelta(aggregate,delta),'invalid-review-aggregate')
})

test('corrupted states, counters, impossible deltas and unsafe arithmetic fail closed', () => {
  for(const value of [null,{}, {sum:1,count:0},{sum:0,count:1},{sum:6,count:1},{sum:1.5,count:1},{sum:-1,count:0},{sum:Infinity,count:1}]) expectCode(()=>assertCustomerReviewAggregate(value),'invalid-review-aggregate')
  expectCode(()=>applyCustomerReviewRatingDelta({sum:Number.MAX_SAFE_INTEGER,count:Number.MAX_SAFE_INTEGER},{sum:1,count:1}),'invalid-review-aggregate')
  for(const delta of [{sum:-1,count:1},{sum:1,count:-1},{sum:5,count:0},{sum:2,count:2}]) expectCode(()=>applyCustomerReviewRatingDelta({sum:10,count:3},delta),'invalid-review-delta')
  const p=published()
  for(const patch of [{publishedRevision:9},{status:'withdrawn'},{pendingRevision:1},{version:-1}]) assert.throws(()=>assertCustomerReviewSlot({...p,...patch}))
  expectCode(()=>customerReviewRatingDelta(p,{...p,businessId:'other'}),'review-identity-mismatch')
  const mutable=JSON.parse(JSON.stringify(p));step(mutable,'submit',{submission:edited})
  assert.equal(Object.isFrozen(mutable),false)
  assert.equal(Object.isFrozen(mutable.revisions[0]),false)
  assert.equal(mutable.revisions.length,1)
})

test('translation keys include revision, target, public identity and provider version without ambiguous delimiters', () => {
  const fields={publicReviewId:'opaque-public-review-01',publishedRevision:1,targetLanguage:'es',providerVersion:'provider/model:v1'}
  const key=customerReviewTranslationCacheKey(fields)
  assert.equal(key,customerReviewTranslationCacheKey({...fields}))
  assert.ok(!key.includes('/'))
  for(const patch of [{publicReviewId:'opaque-public-review-02'},{publishedRevision:2},{targetLanguage:'fr'},{providerVersion:'provider/model:v2'}]) assert.notEqual(key,customerReviewTranslationCacheKey({...fields,...patch}))
  assert.equal(new Set(SUPPORTED_LANGUAGE_CODES.map(targetLanguage=>customerReviewTranslationCacheKey({...fields,targetLanguage}))).size,17)
  for(const patch of [{targetLanguage:'ES'},{targetLanguage:'xx'},{publishedRevision:0},{publishedRevision:1.5},{providerVersion:''}]) assert.throws(()=>customerReviewTranslationCacheKey({...fields,...patch}))
  assert.deepEqual(customerReviewSourceLanguages(),{declared:null,detected:null})
  assert.deepEqual(customerReviewSourceLanguages({declared:'es',detected:'zh-Hant'}),{declared:'es',detected:'zh-Hant'})
  expectCode(()=>customerReviewSourceLanguages({detected:'invalid value'}),'invalid-source-language')
})
