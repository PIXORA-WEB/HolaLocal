import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {checkCustomerReviewIndexes} from '../scripts/checkCustomerReviewIndexes.mjs'
const config=JSON.parse(readFileSync(new URL('../../firestore.indexes.json',import.meta.url)))
test('review composite requirements and explicit deployed readiness',()=>{
 assert.equal(checkCustomerReviewIndexes(config).requiredCompositeIndexes,4)
 const rows=config.indexes.map(row=>({...row,state:'READY'}))
 assert.equal(checkCustomerReviewIndexes(config,rows).deployedCompositeReadiness,'verified from supplied export')
 assert.throws(()=>checkCustomerReviewIndexes(config,rows.map(row=>({...row,state:'CREATING'}))),/not READY/)
 assert.throws(()=>checkCustomerReviewIndexes({...config,indexes:[]}),/Missing local/)
 assert.throws(()=>checkCustomerReviewIndexes({...config,fieldOverrides:[{collectionGroup:'customerReviewReports',fieldPath:'expiresAt',indexes:[]}]}),/expiry index disabled/)
})
