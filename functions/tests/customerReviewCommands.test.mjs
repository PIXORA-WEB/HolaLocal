import test from 'node:test'
import assert from 'node:assert/strict'
import * as contracts from '../../shared/firebase-contract/customerReviewContracts.js'
import * as lifecycle from '../../shared/firebase-contract/customerReviewLifecycle.js'
import { createCustomerReviewCommands, customerReviewPairKey } from '../src/customerReviewCommands.js'
import { CustomerReviewFakeDatabase } from './customerReviewFakeDatabase.mjs'

const originalText = 'Thoughtful service and very clear communication.'
function setup() {
  const db = new CustomerReviewFakeDatabase()
  const identities = { customer: { uid: 'customer', emailVerified: true }, admin: { uid: 'admin', admin: true } }
  const account = { uid: 'customer', accountStatus: 'active', roles: ['customer'], deletionRequestedAt: null }
  const business = { businessId: 'business', ownerId: 'owner', managerIds: ['owner'], name: 'Fictional service',
    description: 'Synthetic business', primaryCategoryId: 'home', categoryIds: ['home'], serviceAreas: ['Madrid'],
    languages: ['en'], primaryLanguage: 'en', location: { locality: 'Madrid', region: 'Madrid', countryCode: 'ES' },
    status: 'active', publishedAt: 1 }
  db.data.set('accounts/customer', account); db.data.set('businesses/business', business)
  let allocations = 0
  const dependencies = {
    helpers: { ...contracts, ...lifecycle }, database: db,
    auth: { resolveActor: async token => structuredClone(identities[token] ?? null),
      loadAuthorIdentity: async uid => structuredClone(identities[uid] ?? null) },
    readEligibility: async (tx, { authorUid, businessId }) => ({ account: await tx.get(`accounts/${authorUid}`),
      business: await tx.get(`businesses/${businessId}`) }),
    // Synthetic aliases and quotas, not proposed launch policy.
    aliasPolicy: { choose: () => 'Sample reviewer' },
    quotaPolicy: { reserve: ({ current }) => {
      if ((current?.used ?? 0) >= 10) throw new Error('synthetic-quota-refused')
      return { used: (current?.used ?? 0) + 1 }
    } },
    clock: () => 123,
    allocatePublicId: () => `opaque_sample_review_${++allocations}`,
  }
  const core = createCustomerReviewCommands(dependencies)
  const submit = (overrides = {}) => core.submit('customer', { businessId: 'business', requestId: 'submit1',
    expectedVersion: 0, rating: 4, displayName: 'Test reviewer', originalText, ...overrides })
  const command = (name, result, extra = {}, actor = 'admin') => core[name](actor, {
    publicReviewId: result.publicReviewId, expectedVersion: result.version, requestId: `${name}${result.version}`, ...(name==='reject'?{rejectionReasonCode:'spam'}:{}), ...extra })
  return { db, identities, account, business, core, dependencies, submit, command, allocations: () => allocations }
}
const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code || error.message === code)
const stats = s => s.db.data.get('customerReviewStats/business')
const docs = (s, prefix) => [...s.db.data].filter(([path]) => path.startsWith(prefix)).map(([, value]) => value)
const edit = (s, current, overrides = {}) => s.core.edit('customer', { businessId: 'business', expectedVersion: current.version,
  requestId: `edit${current.version}`, rating: 2, displayName:'Test reviewer',originalText: 'A revised account of this fictional service.', ...overrides })
async function published(s) { return s.command('approve', await s.submit()) }

test('required dependency boundary and unambiguous private pair identity', () => {
  const s = setup()
  for (const key of ['quotaPolicy', 'helpers', 'auth', 'readEligibility', 'database']) {
    assert.throws(() => createCustomerReviewCommands({ ...s.dependencies, [key]: undefined }))
  }
  assert.equal(customerReviewPairKey('ab', 'c'), customerReviewPairKey('ab', 'c'))
  assert.notEqual(customerReviewPairKey('ab', 'c'), customerReviewPairKey('a', 'bc'))
  assert.match(customerReviewPairKey('ab', 'c'), /^[a-f0-9]{64}$/)
})

test('trusted identity, current account and public-business submission eligibility', async () => {
  const cases = [
    [s => delete s.identities.customer, 'authentication-required'],
    [s => { s.identities.customer.emailVerified = false }, 'verified-email-required'],
    [s => { s.account.accountStatus = 'suspended' }, 'active-account-required'],
    [s => { s.account.deletionRequestedAt = 1 }, 'active-account-required'],
    [s => { s.account.roles = ['owner'] }, 'customer-role-required'],
    [s => { s.business.ownerId = 'customer' }, 'self-review-forbidden'],
    [s => { s.business.managerIds.push('customer') }, 'self-review-forbidden'],
    [s => { s.business.status = 'draft' }, 'public-business-required'],
  ]
  for (const [change, code] of cases) {
    const s = setup(); change(s); const before = structuredClone(s.db.data)
    await rejectsCode(s.submit(), code); assert.deepEqual(s.db.data, before)
  }
  const s = setup(); s.account.roles.push('owner'); assert.equal((await s.submit()).status, 'pending')
})

test('exact payloads, normalized fingerprints and safe expected versions', async () => {
  for (const overrides of [{ authorUid: 'admin' }, { expectedVersion: 0.5 }, { expectedVersion: '0' },
    { expectedVersion: -1 }, { rating: 6 }, { displayName:'Test reviewer',originalText: 'short' }, { businessId: '../secret' }]) {
    const s = setup(); await assert.rejects(s.submit(overrides)); assert.equal(docs(s, 'customerReview').length, 0)
  }
  const s = setup(); const one = await s.submit({ displayName:'Test reviewer',originalText: `  ${originalText}  ` })
  assert.deepEqual(await s.submit(), one)
  await rejectsCode(s.submit({ rating: 3 }), 'request-id-conflict')
})

test('immutable revisions, allowlisted outcomes, initial approval and pending/rejected edit', async () => {
  const s = setup(); const pending = await s.submit()
  assert.deepEqual(stats(s), { sum: 0, count: 0 }); assert.equal(docs(s, 'customerReviewsPublic/').length, 0)
  const approved = await s.command('approve', pending, { moderationNote: 'Private audit sample' })
  assert.deepEqual(stats(s), { sum: 4, count: 1 })
  const beforePublic = structuredClone(docs(s, 'customerReviewsPublic/'))
  const firstRevision = structuredClone(docs(s, 'customerReviewSlots/').filter(value => value.revision === 1))
  const pendingEdit = await edit(s, approved)
  assert.deepEqual(docs(s, 'customerReviewsPublic/'), beforePublic)
  const rejected = await s.command('reject', pendingEdit)
  assert.equal(rejected.status, 'rejected'); assert.equal(rejected.publishedRevision, 1)
  assert.deepEqual(stats(s), { sum: 4, count: 1 })
  assert.deepEqual(docs(s, 'customerReviewSlots/').filter(value => value.revision === 1), firstRevision)
  assert.deepEqual(Object.keys(approved).sort(), ['pendingRevision', 'publicReviewId', 'publishedRevision', 'status', 'version'])
  const publicDoc = beforePublic[0]
  assert.deepEqual(Object.keys(publicDoc).sort(), ['businessId', 'declaredSourceLanguage', 'originalText', 'publicReviewId',
    'publishedRevision', 'rating', 'reviewerAlias', 'publishedAt', 'updatedAt'].sort())
  assert.equal(JSON.stringify(publicDoc).includes('customer'), false)
  assert.equal(JSON.stringify(approved).includes('Private'), false)
})

test('approved edit replaces rating; author withdrawal cancels pending work despite lost eligibility', async () => {
  const s = setup(); const approved = await published(s)
  const replacement = await s.command('approve', await edit(s, approved))
  assert.deepEqual(stats(s), { sum: 2, count: 1 }); assert.equal(replacement.publishedRevision, 2)
  const pending = await edit(s, replacement)
  s.identities.customer.emailVerified = false
  s.db.data.set('accounts/customer', { ...s.account, accountStatus: 'suspended', roles: [], deletionRequestedAt: 1 })
  const withdrawn = await s.command('withdraw', pending, {}, 'customer')
  assert.equal(withdrawn.pendingRevision, null); assert.equal(withdrawn.publishedRevision, null)
  assert.deepEqual(stats(s), { sum: 0, count: 0 }); assert.equal(docs(s, 'customerReviewsPublic/').length, 0)
  await rejectsCode(s.command('approve', pending), 'verified-email-required')
  assert.deepEqual(await s.command('withdraw', pending, {}, 'customer'), withdrawn)
})

test('removal is terminal; stale and current-version approval cannot restore pending edit', async () => {
  const s = setup(); const pending = await edit(s, await published(s))
  const removed = await s.command('remove', pending)
  assert.deepEqual(stats(s), { sum: 0, count: 0 })
  await rejectsCode(s.command('approve', pending), 'review-version-conflict')
  await rejectsCode(s.command('approve', removed), 'invalid-review-transition')
  await rejectsCode(s.submit({ requestId: 'resubmit', expectedVersion: removed.version }), 'invalid-review-transition')
  assert.deepEqual(await s.command('remove', pending), removed)
})

test('initial rejection, rejected/withdrawn resubmission, pending replacement denial', async () => {
  const s = setup(); const initial = await s.submit()
  await rejectsCode(s.submit({ requestId: 'pending-again', expectedVersion: initial.version }), 'invalid-review-transition')
  const rejected = await s.command('reject', initial)
  assert.deepEqual(stats(s), { sum: 0, count: 0 })
  const second = await s.submit({ expectedVersion: rejected.version, requestId: 'second' })
  const withdrawn = await s.command('withdraw', second, {}, 'customer')
  const third = await s.submit({ expectedVersion: withdrawn.version, requestId: 'third' })
  assert.equal(third.pendingRevision, 3)
  await rejectsCode(edit(s, third), 'published-review-required')
})

test('moderation requires admin; approval rechecks author relationships and identity', async () => {
  for (const change of [s => { s.business.ownerId = 'customer' }, s => { s.business.managerIds.push('customer') },
    s => { s.identities.customer.emailVerified = false }, s => { s.account.roles = [] },
    s => { s.business.status = 'draft' }]) {
    const s = setup(); const pending = await s.submit()
    // Fake commits clone the store, so replace current authoritative records after changing fixture objects.
    change(s); s.db.data.set('businesses/business', s.business); s.db.data.set('accounts/customer', s.account)
    await assert.rejects(s.command('approve', pending)); assert.equal(docs(s, 'customerReviewsPublic/').length, 0)
  }
  const s = setup(); const pending = await s.submit()
  for (const command of ['approve', 'reject', 'remove']) await rejectsCode(s.command(command, pending, {}, 'customer'), 'admin-required')
  await rejectsCode(s.command('withdraw', pending, {}, 'admin'), 'author-required')
})

test('replays reauthorize, conflicting IDs bind command and normalized content', async () => {
  const s = setup(); const pending = await s.submit(); const approved = await s.command('approve', pending)
  const snapshot = structuredClone(s.db.data)
  assert.deepEqual(await s.command('approve', pending), approved); assert.deepEqual(s.db.data, snapshot)
  await rejectsCode(s.command('reject', pending, { requestId: 'approve1' }), 'request-id-conflict')
  s.identities.admin.admin = false
  await rejectsCode(s.command('approve', pending), 'admin-required')
  s.identities.customer.emailVerified = false
  await rejectsCode(s.submit(), 'verified-email-required')
})

test('discarded transaction callback retries create exactly one revision/audit/quota reservation', async () => {
  const s = setup(); s.db.retryNext = true
  const result = await s.submit()
  assert.equal(s.db.callbacks, 2); assert.equal(s.allocations(), 1)
  assert.equal(docs(s, 'customerReviewAudits/').length, 1)
  assert.equal(docs(s, 'customerReviewRequests/').length, 1)
  assert.deepEqual(docs(s, 'customerReviewQuotas/'), [{ used: 1 }])
  const snapshot = structuredClone(s.db.data)
  assert.deepEqual(await s.submit(), result); assert.deepEqual(s.db.data, snapshot)
  const approved = await s.command('approve', result)
  s.db.retryNext = true; await s.command('approve', await edit(s, approved))
  assert.deepEqual(stats(s), { sum: 2, count: 1 })
})

test('quota refusal is atomic, request is retryable, withdrawal does not reserve quota', async () => {
  const s = setup(); const pending = await s.submit()
  const quotaPath = [...s.db.data.keys()].find(path => path.startsWith('customerReviewQuotas/'))
  const rejected = await s.command('reject', pending)
  s.db.data.set(quotaPath, { used: 10 }); const snapshot = structuredClone(s.db.data)
  const payload = { expectedVersion: rejected.version, requestId: 'retry-after-quota' }
  await rejectsCode(s.submit(payload), 'synthetic-quota-refused'); assert.deepEqual(s.db.data, snapshot)
  s.db.data.set(quotaPath, { used: 9 }); const next = await s.submit(payload)
  assert.deepEqual(await s.submit(payload), next); assert.deepEqual(s.db.data.get(quotaPath), { used: 10 })
  await s.command('withdraw', next, {}, 'customer'); assert.deepEqual(s.db.data.get(quotaPath), { used: 10 })
})

test('missing/corrupt statistics and projection mismatch fail closed without partial writes', async () => {
  for (const value of [null, { sum: 0, count: 0 }, { sum: 3, count: 1 }, { sum: 100, count: 1 }]) {
    const s = setup(); const approved = await published(s)
    if (value) s.db.data.set('customerReviewStats/business', value)
    else s.db.data.delete('customerReviewStats/business')
    const snapshot = structuredClone(s.db.data)
    await assert.rejects(s.command('withdraw', approved, {}, 'customer')); assert.deepEqual(s.db.data, snapshot)
  }
  const s = setup(); const approved = await published(s)
  s.db.data.get(`customerReviewsPublic/${approved.publicReviewId}`).rating = 1
  await rejectsCode(s.command('remove', approved), 'inconsistent-public-projection')
})

test('public ID collision and missing immutable history abort, expected-version conflicts preserve quota', async () => {
  const s = setup(); s.db.data.set('customerReviewIds/opaque_sample_review_1', { businessId: 'other', authorUid: 'other' })
  await rejectsCode(s.submit(), 'public-id-conflict')
  const t = setup(); const pending = await t.submit(); const snapshot = structuredClone(t.db.data)
  await rejectsCode(t.submit({ requestId: 'stale' }), 'review-version-conflict'); assert.deepEqual(t.db.data, snapshot)
  const revisionPath = [...t.db.data.keys()].find(path => path.includes('/revisions/'))
  t.db.data.delete(revisionPath)
  await rejectsCode(t.command('approve', pending), 'invalid-revision')
})

test('simulated intervening removal aborts retried approval instead of restoring content', async () => {
  const s = setup(); const pending = await edit(s, await published(s))
  s.db.retryNext = true
  s.db.beforeRetry = () => s.command('remove', pending)
  await rejectsCode(s.command('approve', pending), 'review-version-conflict')
  assert.deepEqual(stats(s), { sum: 0, count: 0 })
  assert.equal(docs(s, 'customerReviewsPublic/').length, 0)
  assert.equal(docs(s, 'customerReviewAudits/').filter(value => value.command === 'approve').length, 1)
})

test('two independent customers contribute separately; retries and removals preserve the other contribution', async () => {
  const s = setup(); const first = await published(s)
  s.identities.second = { uid: 'second', emailVerified: true }
  s.db.data.set('accounts/second', { ...s.account, uid: 'second' })
  const pending = await s.core.submit('second', { businessId: 'business', requestId: 'submit1', expectedVersion: 0,
    rating: 5, displayName:'Test reviewer', originalText })
  const second = await s.command('approve', pending, { requestId: 'approve-second' })
  assert.notEqual(first.publicReviewId, second.publicReviewId)
  assert.deepEqual(stats(s), { sum: 9, count: 2 })
  await s.command('withdraw', first, {}, 'customer')
  assert.deepEqual(stats(s), { sum: 5, count: 1 })
  await s.command('withdraw', first, {}, 'customer')
  assert.deepEqual(stats(s), { sum: 5, count: 1 })
})

test('Batch 1 admin removal of unpublished pending/rejected slots remains allowed', async () => {
  for (const rejectFirst of [false, true]) {
    const s = setup(); let current = await s.submit()
    if (rejectFirst) current = await s.command('reject', current)
    const removed = await s.command('remove', current)
    assert.equal(removed.status, 'removed'); assert.deepEqual(stats(s), { sum: 0, count: 0 })
  }
})

test('bounded window uses at most two revision reads after many immutable edits', async () => {
  const s = setup(); let current = await published(s)
  for (let i = 0; i < 30; i++) {
    s.db.readPaths = []
    current = await edit(s, current)
    assert.ok(s.db.readPaths.filter(path => path.includes('/revisions/')).length <= 2)
    s.db.readPaths = []
    current = await s.command(i % 2 ? 'approve' : 'reject', current)
    assert.ok(s.db.readPaths.filter(path => path.includes('/revisions/')).length <= 2)
    for (const path of [...s.db.data.keys()].filter(path => path.startsWith('customerReviewQuotas/'))) s.db.data.set(path, { used: 0 })
  }
  assert.equal(docs(s, 'customerReviewSlots/').filter(value => value.revision).length, 31)
  assert.equal(current.publishedRevision, 31)
})

test('Unicode and punctuation identifiers retain exact pair identity and safe document segments', () => {
  for (const id of ['auth:example.user+123', 'équipe', '用户', 'a'.repeat(128), 'x'.repeat(1500), '😀'.repeat(375)]) {
    assert.equal(contracts.isCustomerReviewId(id), true, id)
  }
  for (const id of ['', '.', '..', '__reserved__', 'a/b', '\u0000', '\ud800', 'x'.repeat(1501), '😀'.repeat(376)]) {
    assert.equal(contracts.isCustomerReviewId(id), false)
  }
  assert.notEqual(customerReviewPairKey('é', 'user'), customerReviewPairKey('e\u0301', 'user'))
})

test('Firestore-style property ordering does not break locators; invalid state pointers fail closed', async () => {
  const s = setup(); const current = await published(s)
  s.db.data.set(`customerReviewIds/${current.publicReviewId}`, { authorUid: 'customer', businessId: 'business' })
  const pending = await edit(s, current)
  const slotPath = `customerReviewSlots/${customerReviewPairKey('business', 'customer')}`
  const slot = s.db.data.get(slotPath)
  s.db.data.set(slotPath, { ...slot, pendingRevision: 1 })
  await rejectsCode(s.command('approve', pending), 'invalid-revision-pointer')
  assert.deepEqual(stats(s), { sum: 4, count: 1 })
})

test('server timestamps preserve immutable originals, public dates, retries and resubmission history',async()=>{
  const s=setup();let time=1000
  s.core=createCustomerReviewCommands({...s.dependencies,clock:()=>time})
  const submit=(version,requestId)=>s.core.submit('customer',{businessId:'business',expectedVersion:version,requestId,rating:4,displayName:'Test reviewer',originalText})
  const act=(name,current,requestId)=>s.core[name](name==='withdraw'?'customer':'admin',{
    publicReviewId:current.publicReviewId,expectedVersion:current.version,requestId,...(name==='reject'?{rejectionReasonCode:'spam'}:{})})
  const pending=await submit(0,'first')
  const slotPath=`customerReviewSlots/${customerReviewPairKey('business','customer')}`
  const first=s.db.data.get(`${slotPath}/revisions/1`).submittedAt
  time=2000;const approved=await act('approve',pending,'approve-first')
  const pubPath=`customerReviewsPublic/${pending.publicReviewId}`
  const dates=()=>{const p=s.db.data.get(pubPath);return [p.publishedAt,p.updatedAt]}
  const originalDates=structuredClone(dates())
  time=3000;const editPending=await submit(approved.version,'edit-one')
  assert.deepEqual(dates(),originalDates)
  time=4000;const rejected=await act('reject',editPending,'reject-edit')
  assert.deepEqual(dates(),originalDates)
  time=5000;const secondEdit=await submit(rejected.version,'edit-two')
  time=6000;const replacement=await act('approve',secondEdit,'approve-edit')
  assert.deepEqual(dates(),[{seconds:2,nanoseconds:0},{seconds:6,nanoseconds:0}])
  time=7000;await act('approve',secondEdit,'approve-edit')
  assert.deepEqual(dates(),[{seconds:2,nanoseconds:0},{seconds:6,nanoseconds:0}])
  const withdrawn=await act('withdraw',replacement,'withdraw')
  assert.equal(s.db.data.get(slotPath).publishedVersionAt,null)
  assert.deepEqual(s.db.data.get(slotPath).firstPublishedAt,{seconds:2,nanoseconds:0})
  time=8000;const resubmitted=await submit(withdrawn.version,'resubmit')
  time=9000;await act('approve',resubmitted,'republish')
  assert.deepEqual(dates(),[{seconds:2,nanoseconds:0},{seconds:9,nanoseconds:0}])
  assert.deepEqual(s.db.data.get(`${slotPath}/revisions/1`).submittedAt,first)
  assert.deepEqual(s.db.data.get(slotPath).firstSubmittedAt,{seconds:1,nanoseconds:0})
  await assert.rejects(s.core.submit('customer',{businessId:'business',requestId:'forged-date',expectedVersion:0,
    rating:4,displayName:'Test reviewer',originalText,firstSubmittedAt:123}),/unsupported-field/)
})

test('deletion cleanup marker fences even stored moderation/withdrawal receipts',async()=>{
  const s=setup();const pending=await s.submit();const approved=await s.command('approve',pending)
  const pair=customerReviewPairKey('business','customer')
  s.db.data.set(`customerReviewSlots/${pair}`,{authorUid:'customer',businessId:'business',publicReviewId:approved.publicReviewId,customerReviewCleanup:true})
  await rejectsCode(s.command('approve',pending),'review-not-found')
  await rejectsCode(s.command('withdraw',approved,{},'customer'),'review-not-found')
  await rejectsCode(s.submit(),'review-not-found')
})


test('lifecycle conflict retry rechecks eligibility; withdrawal works while unavailable', async () => {
  for(const action of ['submit','approve','edit']) {
    const s=setup()
    const current=action==='submit'?null:action==='approve'?await s.submit():await published(s)
    const before=structuredClone([...s.db.data].filter(([path])=>!path.startsWith('businesses/')))
    s.db.retryNext=true
    s.db.beforeRetry=()=>{s.db.data.get('businesses/business').status='suspended'}
    const work=action==='submit'?s.submit():action==='approve'?s.command('approve',current):edit(s,current)
    await rejectsCode(work,'public-business-required')
    assert.deepEqual([...s.db.data].filter(([path])=>!path.startsWith('businesses/')),before)
    if(current) {
      const withdrawn=await s.command('withdraw',current,{},'customer')
      assert.equal(withdrawn.publishedRevision,null);assert.equal(withdrawn.pendingRevision,null)
      assert.deepEqual(stats(s),{sum:0,count:0})
    }
  }
})


test('rejection requires explicit structured public guidance; revisions, public dates and ratings are preserved',async()=>{
 const s=setup(),approved=await published(s),pending=await edit(s,approved)
 const payload={publicReviewId:pending.publicReviewId,expectedVersion:pending.version,requestId:'reasoned-reject',rejectionReasonCode:'personal_information',moderationNote:'PRIVATE internal moderation note'}
 const path=`customerReviewSlots/${customerReviewPairKey('business','customer')}`
 for(const rejectionReasonCode of [undefined,null,'other','invalid',{},4])await rejectsCode(s.core.reject('admin',{...payload,rejectionReasonCode}),'invalid-rejection-reason')
 await rejectsCode(s.core.reject('admin',{...payload,authorGuidance:'unsupported'}),'unsupported-field')
 const beforePublic=structuredClone(s.db.data.get(`customerReviewsPublic/${pending.publicReviewId}`)),beforeStats=structuredClone(stats(s))
 const result=await s.core.reject('admin',payload)
 assert.deepEqual(s.db.data.get(path).rejection,{revision:2,reasonCode:'personal_information'})
 assert.deepEqual(s.db.data.get(`customerReviewsPublic/${pending.publicReviewId}`),beforePublic)
 assert.deepEqual(stats(s),beforeStats)
 assert.ok(!JSON.stringify(result).includes('PRIVATE'))
 assert.deepEqual(await s.core.reject('admin',payload),result)
 await rejectsCode(s.core.reject('admin',{...payload,rejectionReasonCode:'spam'}),'request-id-conflict')
 await rejectsCode(s.core.reject('admin',{...payload,requestId:'stale-rejection'}),'review-version-conflict')
 await edit(s,result)
 assert.equal(s.db.data.get(path).rejection,null)
})


test('chosen names are moderated per revision and bound to request identity',async()=>{
 const s=setup()
 for(const displayName of [undefined,'','  ','x'.repeat(81),'Hidden\u202ename'])await rejectsCode(s.submit({displayName}),'invalid-display-name')
 const pending=await s.submit({displayName:'  Éloise  '})
 assert.deepEqual(await s.submit({displayName:'Éloise'}),pending)
 await rejectsCode(s.submit({displayName:'Different name'}),'request-id-conflict')
 assert.equal(docs(s,'customerReviewsPublic/').length,0)
 const approved=await s.command('approve',pending)
 assert.equal(docs(s,'customerReviewsPublic/')[0].reviewerAlias,'Éloise')
 const changed=await edit(s,approved,{displayName:'New name'})
 assert.equal(docs(s,'customerReviewsPublic/')[0].reviewerAlias,'Éloise')
 const rejected=await s.command('reject',changed)
 assert.equal(docs(s,'customerReviewsPublic/')[0].reviewerAlias,'Éloise')
 await s.command('approve',await edit(s,rejected,{displayName:'Approved replacement'}))
 const projection=docs(s,'customerReviewsPublic/')[0]
 assert.equal(projection.reviewerAlias,'Approved replacement')
 assert.equal(projection.authorUid,undefined);assert.equal(projection.email,undefined)
 assert.equal(docs(s,'customerReviewSlots/').find(v=>v.authorUid)?.authorUid,'customer')
})
