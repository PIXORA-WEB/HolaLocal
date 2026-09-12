import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Firestore} from '@google-cloud/firestore'
import {createCustomerReviewFirestoreDatabase} from '../src/customerReviewFirestore.js'

test('only translation export receives dedicated identity; shared callable options stay intact', () => {
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8')
 assert.equal(source.match(/serviceAccount:/g)?.length,1)
 assert.ok(source.includes("export const translatePublishedCustomerReview = onCall({ ...PUBLIC_CALLABLE_OPTIONS, serviceAccount: 'holalocal-review-translation@holalocal-491c9.iam.gserviceaccount.com' }, createCustomerReviewCallableHandler('translatePublishedCustomerReview'))"))
})
test('authoritative transaction adapter emits an upsert requiring create and update, no delete or transform', async () => {
 const firestore=new Firestore({projectId:'demo-holalocal-functions'})
 const batch=firestore.batch()
 const database=createCustomerReviewFirestoreDatabase({doc:p=>firestore.doc(p),runTransaction:cb=>cb({get:async()=>({exists:true,data:()=>({publishedRevision:1})}),set:(...args)=>batch.set(...args)})})
 await database.runTransaction(async tx=>{await tx.get('customerReviewsPublic/synthetic');tx.set('customerReviewsPublic/synthetic',{publishedRevision:1,translationCache:{}})})
 const wire=batch._ops[0].op()
 assert.equal(wire.currentDocument,undefined)
 assert.equal(wire.delete,undefined)
 assert.ok(wire.update.name.endsWith('/customerReviewsPublic/synthetic'))
})
