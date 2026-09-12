import test from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase-admin/firestore'
import { initialDeletionEvidenceRetention, nextRetentionDecision, retentionReviewStatus, requireRetentionAdmin } from '../src/recordRetention.js'
const now = Timestamp.fromMillis(100000)
test('due review never expires or renews a legal preservation exception',()=>{
 const held=initialDeletionEvidenceRetention({reviewerId:'admin',now})
 assert.equal(retentionReviewStatus(held,Timestamp.fromMillis(900000)),'overdue')
 assert.equal(held.state,'held');assert.equal(held.reviewAt.toMillis(),100000)
 assert.throws(()=>nextRetentionDecision({previous:held,expectedRevision:0,actorUid:'admin',action:'release',reason:'case ended',now}),/stale/)
 assert.throws(()=>nextRetentionDecision({previous:held,expectedRevision:1,actorUid:'admin',action:'hold',reason:'case remains',endingCondition:'case ends',reviewAt:now,now}),/future-review/)
 const released=nextRetentionDecision({previous:held,expectedRevision:1,actorUid:'admin',action:'release',reason:'case ended',now})
 assert.equal(retentionReviewStatus(released),'released')
})
test('malformed historical decisions require assessment and admin identity is enforced',()=>{
 assert.equal(retentionReviewStatus({state:'released'}),'needs-assessment')
 assert.throws(()=>requireRetentionAdmin('customer',{}),/admin-required/)
 assert.throws(()=>requireRetentionAdmin('moderator',{moderator:true}),/admin-required/)
 assert.doesNotThrow(()=>requireRetentionAdmin('admin',{admin:true}))
})
