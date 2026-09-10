import test from 'node:test'
import assert from 'node:assert/strict'
import {Timestamp} from 'firebase-admin/firestore'
import {isAutomaticErasureEligible,acquireAccountDeletionLease} from '../src/accountDeletionPrimitives.js'
import {runAccountDeletionRecovery} from '../src/accountDeletionRecovery.js'
import {FakeFirestore} from './fakeFirestore.mjs'
const now=Timestamp.fromMillis(10000000)
const row={state:'failed_retryable',finalizedBy:'admin',finalizationStartedAt:Timestamp.fromMillis(1),updatedAt:Timestamp.fromMillis(1),retryCount:0,requestVersion:2}
test('recovery is off before constructing database',async()=>assert.deepEqual(await runAccountDeletionRecovery({env:{},createDatabase:()=>assert.fail()}),{disabled:true}))
test('automatic eligibility excludes unstarted, cancelled, active leases, exhausted and corrupt work',()=>{
 assert.equal(isAutomaticErasureEligible(row,now),true)
 for(const change of [{state:'requested'},{state:'cancelled'},{state:'completed'},{finalizedBy:null},{finalizationStartedAt:null},{updatedAt:null},{retryCount:5},{retryCount:-1},{updatedAt:now},{state:'finalizing',leaseExpiresAt:Timestamp.fromMillis(10000001)}])assert.equal(isAutomaticErasureEligible({...row,...change},now),false)
 assert.equal(isAutomaticErasureEligible({...row,state:'finalizing',leaseExpiresAt:Timestamp.fromMillis(2)},now),true)
})
test('recovery lease enforces authoriser and retry cap atomically without changing manual permissions',async()=>{
 const db=new FakeFirestore();db.store.set('accountDeletionRequests/target',{...row})
 await assert.rejects(acquireAccountDeletionLease({uid:'target',adminUid:'other',expectedRequestVersion:2,db,recovery:true,now}),/automatic-erasure-ineligible/)
 const lease=await acquireAccountDeletionLease({uid:'target',adminUid:'admin',expectedRequestVersion:2,db,recovery:true,now})
 assert.ok(lease.acquired);assert.equal(db.store.get('accountDeletionRequests/target').retryCount,1)
 await assert.rejects(acquireAccountDeletionLease({uid:'target',adminUid:'admin',expectedRequestVersion:2,db,recovery:true,now}),/stale-request-version/)
})
