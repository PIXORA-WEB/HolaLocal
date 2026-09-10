import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { moderateBusiness } from '../src/businessModeration.js'
import { createCustomerReviewReadServices } from '../src/customerReviewReads.js'
import { createCustomerReviewReadFirestore } from '../src/customerReviewReadFirestore.js'
import { isPublicBusinessEligible } from '@holalocal/firebase-contract'
import { assertCallableBoundaryEnvironment } from '../scripts/runIsolatedEmulatorTests.mjs'
import * as contracts from '../../shared/firebase-contract/customerReviewContracts.js'
import * as lifecycle from '../../shared/firebase-contract/customerReviewLifecycle.js'
import { createCustomerReviewCommands, customerReviewPairKey } from '../src/customerReviewCommands.js'
import { createCustomerReviewFirestoreDatabase, readCustomerReviewFirestoreEligibility } from '../src/customerReviewFirestore.js'

// No SDK initialization, credential discovery or I/O outside the protected workflow.
if (process.env.HOLALOCAL_CALLABLE_BOUNDARY !== '1') {
  test('customer review Admin SDK emulator gate', { skip: 'NOT RUN: use protected demo emulator workflow' }, () => {})
} else {
  assertCallableBoundaryEnvironment()
  const { initializeApp, deleteApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const app = initializeApp({ projectId: 'demo-holalocal-functions' }, `customer-reviews-${randomUUID()}`)
  const firestore = getFirestore(app)
  test.after(async () => { await firestore.terminate(); await deleteApp(app) })

  async function setup() {
    const uid = `review-user:${randomUUID()}`; const businessId = `review-business:${randomUUID()}`
    const pair = customerReviewPairKey(businessId, uid)
    await firestore.doc(`users/${uid}`).set({ accountStatus: 'active', roles: ['customer'], deletionRequestedAt: null })
    await firestore.doc(`businesses/${businessId}`).set({ ownerId: 'fictional-owner', managerIds: ['fictional-owner'],
      name: 'Synthetic emulator business', description: 'Fictional service', primaryCategoryId: 'home', categoryIds: ['home'],
      serviceAreas: ['Madrid'], languages: ['en'], primaryLanguage: 'en',
      location: { locality: 'Madrid', region: 'Madrid', countryCode: 'ES' }, status: 'active', publishedAt: 1 })
    const rawDatabase = createCustomerReviewFirestoreDatabase(firestore)
    const readCounts = []
    const database = { ...rawDatabase, runTransaction: callback => rawDatabase.runTransaction(async tx => {
      let revisionReads = 0
      try { return await callback({ ...tx, get: path => {
        if (path.includes('/revisions/')) revisionReads++
        return tx.get(path)
      } }) } finally { readCounts.push(revisionReads) }
    }) }
    let now = Date.now()
    const core = createCustomerReviewCommands({ helpers: { ...contracts, ...lifecycle }, database, clock: () => now,
      // Trusted auth is synthetic here; these tests exercise real Firestore, not Auth verification.
      auth: { resolveActor: async role => role === 'admin' ? { uid: 'synthetic-admin', admin: true }
        : { uid, emailVerified: true }, loadAuthorIdentity: async () => ({ uid, emailVerified: true }) },
      readEligibility: readCustomerReviewFirestoreEligibility,
      aliasPolicy: { choose: () => 'Synthetic reviewer' },
      quotaPolicy: { reserve: ({ current }) => ({ used: (current?.used ?? 0) + 1 }) },
    })
    const payload = { businessId, requestId: randomUUID(), expectedVersion: 0, rating: 4,
      displayName:'Test reviewer',originalText: 'Synthetic customer review for isolated emulator tests.' }
    const submit = overrides => core.submit('author', { ...payload, ...overrides })
    const act = (command, current, extra = {}) => core[command](command === 'withdraw' ? 'author' : 'admin', {
      publicReviewId: current.publicReviewId, expectedVersion: current.version, requestId: randomUUID(), ...(command==='reject'?{rejectionReasonCode:'spam'}:{}), ...extra })
    const edit = (current, extra = {}) => core.edit('author', { ...payload, requestId: randomUUID(),
      expectedVersion: current.version, rating: 2, ...extra })
    const stats = async () => (await firestore.doc(`customerReviewStats/${businessId}`).get()).data()
    const audits = async () => (await firestore.collection('customerReviewAudits').where('pair', '==', pair).get()).size
    return { advance: () => { now += 1000 }, uid, pair, businessId, core, payload, submit, act, edit, stats, audits, readCounts }
  }

  test('real Firestore concurrent identical first submissions commit one revision/audit/quota', async () => {
    const s = await setup()
    const results = await Promise.all([s.submit(), s.submit()])
    assert.deepEqual(results[0], results[1]); assert.equal(await s.audits(), 1)
    assert.equal((await firestore.collection(`customerReviewSlots/${s.pair}/revisions`).get()).size, 1)
    // Hash matches the private quota namespace used by the core.
    const { createHash } = await import('node:crypto')
    const quotaId = createHash('sha256').update(JSON.stringify(['customerReviewQuota', 1, s.uid])).digest('hex')
    assert.equal((await firestore.doc(`customerReviewQuotas/${quotaId}`).get()).data().used, 1)
    await assert.rejects(s.submit({ rating: 5 }), /request-id-conflict/)
  })

  test('real Firestore same-pair different requests and conflicting same-ID races choose one winner', async () => {
    for (const differentId of [true, false]) {
      const s = await setup()
      const results = await Promise.allSettled([s.submit(), s.submit({ rating: 5,
        requestId: differentId ? randomUUID() : s.payload.requestId })])
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
      assert.equal(await s.audits(), 1)
      assert.deepEqual(await s.stats(), { sum: 0, count: 0 })
    }
  })

  test('real Firestore approval versus withdrawal/removal preserves a single winning version', async () => {
    for (const command of ['withdraw', 'remove']) {
      const s = await setup()
      const approved = await s.act('approve', await s.submit())
      const pending = await s.edit(approved)
      const results = await Promise.allSettled([s.act('approve', pending), s.act(command, pending)])
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
      const slot = (await firestore.doc(`customerReviewSlots/${s.pair}`).get()).data()
      assert.equal(slot.version, pending.version + 1)
      assert.deepEqual(await s.stats(), slot.publishedRevision === null ? { sum: 0, count: 0 } : { sum: 2, count: 1 })
      assert.equal(await s.audits(), 4)
      await assert.rejects(s.act('approve', pending))
    }
  })

  test('real Firestore approved edits preserve history with bounded transaction reads', async () => {
    const s = await setup(); let current = await s.act('approve', await s.submit())
    for (let i = 0; i < 12; i++) current = await s.act('approve', await s.edit(current))
    assert.deepEqual(await s.stats(), { sum: 2, count: 1 })
    assert.equal(current.publishedRevision, 13)
    assert.ok(s.readCounts.every(count => count <= 2))
    assert.equal((await firestore.collection(`customerReviewSlots/${s.pair}/revisions`).get()).size, 13)
    const published = (await firestore.doc(`customerReviewsPublic/${current.publicReviewId}`).get()).data()
    assert.equal(published.publishedRevision, 13); assert.equal(published.authorUid, undefined)
  })

  test('real Firestore immutable timestamps and idempotent publication dates survive edits',async()=>{
    const s=await setup();const pending=await s.submit();s.advance()
    const approved=await s.act('approve',pending)
    const path=`customerReviewsPublic/${approved.publicReviewId}`
    const first=(await firestore.doc(path).get()).data()
    assert.equal(typeof first.publishedAt.toMillis,'function')
    s.advance();const edit=await s.edit(approved)
    assert.ok((await firestore.doc(path).get()).data().updatedAt.isEqual(first.updatedAt))
    s.advance();const rejected=await s.act('reject',edit)
    assert.ok((await firestore.doc(path).get()).data().updatedAt.isEqual(first.updatedAt))
    s.advance();const next=await s.edit(rejected);s.advance()
    const requestId=randomUUID();await s.act('approve',next,{requestId})
    const replacement=(await firestore.doc(path).get()).data()
    assert.ok(replacement.publishedAt.isEqual(first.publishedAt))
    assert.ok(replacement.updatedAt.toMillis()>first.updatedAt.toMillis())
    s.advance();await s.act('approve',next,{requestId})
    assert.ok((await firestore.doc(path).get()).data().updatedAt.isEqual(replacement.updatedAt))
  })
  test('real Firestore missing revision, bad pointers and corrupt/missing counters fail closed', async () => {
    for (const corruption of ['revision', 'pointer', 'stats', 'missing-stats']) {
      const s = await setup(); const current = await s.act('approve', await s.submit())
      if (corruption === 'revision') await firestore.doc(`customerReviewSlots/${s.pair}/revisions/1`).delete()
      if (corruption === 'pointer') await firestore.doc(`customerReviewSlots/${s.pair}`).update({ publishedRevision: 50 })
      if (corruption === 'stats') await firestore.doc(`customerReviewStats/${s.businessId}`).set({ sum: 0, count: 0 })
      if (corruption === 'missing-stats') await firestore.doc(`customerReviewStats/${s.businessId}`).delete()
      await assert.rejects(s.act('withdraw', current)); assert.equal(await s.audits(), 2)
      assert.equal((await firestore.doc(`customerReviewsPublic/${current.publicReviewId}`).get()).exists, true)
    }
  })

  function lifecycleServices(s) {
    return createCustomerReviewReadServices({ helpers:{...contracts,...lifecycle},isPublicBusinessEligible,
      database:createCustomerReviewReadFirestore(firestore),
      auth:{resolveActor:async()=>({uid:s.uid})} })
  }
  const moderate=(s,operation)=>moderateBusiness({uid:'synthetic-moderator',claims:{moderator:true},
    businessId:s.businessId,operation,requestId:randomUUID(),db:firestore})

  test('real business suspend/restore/archive preserves reviews; withdrawal and private status survive',async()=>{
    const s=await setup();const reads=lifecycleServices(s)
    const approved=await s.act('approve',await s.submit());const pending=await s.edit(approved)
    const publicRef=firestore.doc(`customerReviewsPublic/${approved.publicReviewId}`)
    const before=(await publicRef.get()).data();const counters=await s.stats()
    await moderate(s,'suspend')
    await assert.rejects(reads.listPublic({businessId:s.businessId}),/business-unavailable/)
    assert.deepEqual(await reads.readRatingSummaries({businessIds:[s.businessId]}),
      [{businessId:s.businessId,available:false,average:null,count:null}])
    await assert.rejects(s.act('approve',pending),/public-business-required/)
    await assert.rejects(s.edit(approved),/public-business-required/)
    const own=await reads.getOwn('author',{businessId:s.businessId})
    assert.equal(own.businessAvailable,false);assert.equal(own.pending.revision,2);assert.equal(own.published.revision,1)
    assert.deepEqual((await publicRef.get()).data(),before);assert.deepEqual(await s.stats(),counters)
    await moderate(s,'restore')
    const restored=await reads.listPublic({businessId:s.businessId})
    assert.equal(restored.items.length,1);assert.equal(restored.items[0].publishedRevision,1)
    assert.equal(restored.items[0].originalText,before.originalText)
    assert.deepEqual((await publicRef.get()).data(),before)
    await moderate(s,'suspend');await s.act('withdraw',pending);await moderate(s,'restore')
    assert.equal((await reads.listPublic({businessId:s.businessId})).items.length,0)
    assert.deepEqual(await s.stats(),{sum:0,count:0})
    await moderate(s,'archive')
    await assert.rejects(reads.listPublic({businessId:s.businessId}),/business-unavailable/)
    await assert.rejects(moderate(s,'restore'),/invalid-business-status-transition/)
  })

  test('real business suspension races serialize with approval and public snapshots',async()=>{
    const s=await setup();const reads=lifecycleServices(s);const pending=await s.submit()
    const results=await Promise.allSettled([s.act('approve',pending),moderate(s,'suspend'),reads.listPublic({businessId:s.businessId})])
    assert.equal(results[1].status,'fulfilled')
    if(results[0].status==='rejected')assert.match(results[0].reason.message,/public-business-required/)
    if(results[2].status==='rejected')assert.match(results[2].reason.message,/business-unavailable/)
    else assert.ok(results[2].value.items.length<=1,'a snapshot before suspension may return approved content')
    await assert.rejects(reads.listPublic({businessId:s.businessId}),/business-unavailable/)
    const published=results[0].status==='fulfilled'
    assert.deepEqual(await s.stats(),published?{sum:4,count:1}:{sum:0,count:0})
    await moderate(s,'restore')
    const restored=await reads.listPublic({businessId:s.businessId})
    assert.equal(restored.items.length,published?1:0,'restoration must not approve pending content')
    await s.act('withdraw',published?results[0].value:pending)
    assert.deepEqual(await s.stats(),{sum:0,count:0})
  })

}
