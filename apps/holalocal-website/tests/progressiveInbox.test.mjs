import test from 'node:test'
import assert from 'node:assert/strict'
import {createInboxViewState, inboxViewReducer, selectInboxView, enrichConversationSummaries} from '../src/utils/messageConversationState.js'
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject} }
const rows = ['slow','fast'].map(conversationId=>({conversationId,participantIds:['user','owner'],customerId:'user',businessOwnerId:'owner'}))
test('fast eligible row publishes before slow context/media, final order follows snapshot', async()=>{
 const slow=deferred(), fast=deferred(), published=[]
 const pending=enrichConversationSummaries(rows,id=>id==='slow'?slow.promise:fast.promise,items=>published.push(items.map(x=>x.conversationId)))
 fast.resolve({name:'Fast'});await new Promise(setImmediate)
 assert.deepEqual(published,[['fast']])
 slow.resolve({name:'Slow'});assert.deepEqual((await pending).map(x=>x.conversationId),['slow','fast'])
 assert.deepEqual(published,[['fast'],['slow','fast']])
})
test('ineligible/missing/failed context cannot block a valid row; all infrastructure failures still reject',async()=>{
 const items=['valid','denied','missing','failed'].map(conversationId=>({conversationId,participantIds:['user','owner'],customerId:'user',businessOwnerId:'owner'}))
 const load=async id=>{if(id==='denied')throw {code:'functions/permission-denied'};if(id==='missing')return null;if(id==='failed')throw Error('offline');return {name:'Valid'}}
 const progress=[];assert.deepEqual((await enrichConversationSummaries(items,load,x=>progress.push(x))).map(x=>x.conversationId),['valid'])
 assert.equal(progress.length,4);assert.ok(progress.every(items=>items.every(item=>item.conversationId==='valid')))
 await assert.rejects(enrichConversationSummaries([{conversationId:'failed'}],load),/offline/)
 assert.deepEqual(await enrichConversationSummaries([{conversationId:'denied'}],load),[])
})
test('empty is final only after settlement; progress replaces instead of duplicating rows',async()=>{
 let state=inboxViewReducer(createInboxViewState('user'),{type:'snapshotReceived',userId:'user',items:rows})
 const action={type:'loadProgress',userId:'user',items:[{...rows[1],business:{name:'Fast'}}],settledIds:['fast']}
 state=inboxViewReducer(state,action);state=inboxViewReducer(state,action)
 assert.equal(state.status,'enriching');assert.equal(state.items.length,1)
 const empty=await enrichConversationSummaries([],()=>{throw Error('must not call')})
 state=inboxViewReducer(state,{type:'loadSucceeded',userId:'user',items:empty})
 assert.equal(state.status,'ready');assert.deepEqual(state.items,[])
})
test('new snapshot clears removed rows, top-level error clears partial list',()=>{
 let state=inboxViewReducer(createInboxViewState('user'),{type:'loadSucceeded',userId:'user',items:rows})
 state=inboxViewReducer(state,{type:'loadStarted',userId:'user'})
 assert.equal(state.status,'loading');assert.deepEqual(state.items,[])
 state=inboxViewReducer(state,{type:'loadFailed',userId:'user',error:'offline'})
 assert.equal(state.status,'failed');assert.equal(state.error,'offline')
})
test('different-user progress is ignored and old-user state is never selected',()=>{
 const state=createInboxViewState('new')
 assert.equal(inboxViewReducer(state,{type:'loadProgress',userId:'old',items:rows}),state)
 assert.deepEqual(selectInboxView({userId:'old',status:'ready',items:rows},'new'),state)
})

const enriched = rows.map(row=>({...row,business:{name:row.conversationId}}))
const readyState = () => inboxViewReducer(createInboxViewState('user'),{type:'loadSucceeded',userId:'user',items:enriched})
const snapshot = (state,items) => inboxViewReducer(state,{type:'snapshotReceived',userId:'user',items})
test('replacement retains compatible rows in new order with fresh snapshot fields',()=>{
 const state=snapshot(readyState(),[{...rows[1],lastMessage:{preview:'fresh'}},rows[0]])
 assert.deepEqual(state.items.map(x=>x.conversationId),['fast','slow'])
 assert.equal(state.items[0].lastMessage.preview,'fresh');assert.equal(state.items[0].business.name,'fast')
 assert.equal(state.status,'enriching')
})
test('partial removal and empty replacement apply immediately',()=>{
 assert.deepEqual(snapshot(readyState(),[rows[1]]).items.map(x=>x.conversationId),['fast'])
 const empty=snapshot(readyState(),[]);assert.equal(empty.status,'ready');assert.deepEqual(empty.items,[])
})
test('participant/account/tombstone changes cannot retain context',()=>{
 for(const change of [{participantIds:['other','owner']},{businessOwnerId:'other'},{businessId:'other'},{customerId:'other'},{status:'participant_deleted'},{participantTombstones:{user:{type:'deleted_user'}}}]){
  assert.deepEqual(snapshot(readyState(),[{...rows[0],...change}]).items,[])
 }
 const other=inboxViewReducer(readyState(),{type:'loadStarted',userId:'other'})
 assert.deepEqual(other.items,[])
})
test('fresh failure removes retained row immediately while new/other rows remain pending',async()=>{
 let state=snapshot(readyState(),[...rows,{conversationId:'new',participantIds:['user','owner']}])
 const slow=deferred(),fresh=deferred()
 const pending=enrichConversationSummaries(state.snapshot,id=>id==='slow'?Promise.reject({code:'permission-denied'}):id==='fast'?slow.promise:fresh.promise,(items,settledIds)=>{
  state=inboxViewReducer(state,{type:'loadProgress',userId:'user',items,settledIds})
 })
 await new Promise(setImmediate);assert.deepEqual(state.items.map(x=>x.conversationId),['fast'])
 fresh.resolve({name:'New'});await new Promise(setImmediate)
 assert.deepEqual(state.items.map(x=>x.conversationId),['fast','new'])
 slow.resolve({name:'Fresh fast'});const final=await pending
 state=inboxViewReducer(state,{type:'loadSucceeded',userId:'user',items:final})
 assert.deepEqual(state.items.map(x=>x.business.name),['Fresh fast','New'])
})
