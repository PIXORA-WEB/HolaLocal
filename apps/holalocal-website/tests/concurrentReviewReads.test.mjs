import assert from 'node:assert/strict'
import test from 'node:test'
import { createReviewController } from '../src/utils/customerReviewModel.js'
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const tick=()=>new Promise(setImmediate)
const article={publicReviewId:'synthetic-review',originalText:'Synthetic published review'}
const result=(items=[])=>({items,nextCursor:null})
function fixture(options={}){
 const pub=deferred(),own=deferred(),calls=[]
 const api={listPublic:input=>{calls.push(['public',input]);return pub.promise},getOwn:input=>{calls.push(['own',input]);return own.promise},listOwn:input=>{calls.push(['listOwn',input]);return pub.promise}}
 const controller=createReviewController({api,businessId:'a',authenticated:true,...options})
 return{pub,own,calls,controller}
}
test('signed-in starts both reads before resolution; public items publish before own',async()=>{
 const f=fixture(),load=f.controller.load();await tick()
 assert.deepEqual(f.calls.map(x=>x[0]),['public','own']);assert.equal(f.controller.getSnapshot().loading,true)
 f.pub.resolve(result([article]));await tick();assert.deepEqual(f.controller.getSnapshot().items,[article]);assert.equal(f.controller.getSnapshot().loading,true)
 f.own.resolve(null);await load;assert.equal(f.controller.getSnapshot().ready,true);assert.equal(f.controller.getSnapshot().loading,false)
})
test('anonymous stays public-only',async()=>{
 const f=fixture({authenticated:false}),load=f.controller.load();await tick();assert.deepEqual(f.calls.map(x=>x[0]),['public']);f.pub.resolve(result());await load;assert.equal(f.controller.getSnapshot().error,'')
})
test('own-only branch stays listOwn-only',async()=>{
 const f=fixture({ownOnly:true}),load=f.controller.load();await tick();assert.deepEqual(f.calls.map(x=>x[0]),['listOwn']);f.pub.resolve(result());await load
})
test('own faster cannot finalize or declare public empty before public response',async()=>{
 const f=fixture(),load=f.controller.load();await tick();f.own.resolve({status:'published'});await tick()
 assert.equal(f.controller.getSnapshot().ready,false);assert.equal(f.controller.getSnapshot().loading,true);assert.equal(f.controller.getSnapshot().own,null)
 f.pub.resolve(result());await load;assert.equal(f.controller.getSnapshot().ready,true);assert.equal(f.controller.getSnapshot().loading,false);assert.deepEqual(f.controller.getSnapshot().items,[]);assert.equal(f.controller.getSnapshot().own.status,'published')
})
for(const ownFirst of [false,true])test(`public failure wins over own success; ownFirst=${ownFirst}`,async()=>{
 const f=fixture(),load=f.controller.load();await tick()
 if(ownFirst){f.own.resolve({status:'published'});await tick()}
 f.pub.reject(Error('public-business-required'));await load
 if(!ownFirst){f.own.resolve({status:'published'});await tick()}
 assert.equal(f.controller.getSnapshot().error,'unavailable');assert.equal(f.controller.getSnapshot().own,null);assert.deepEqual(f.controller.getSnapshot().items,[])
})
test('early own failure is handled and public articles survive generic own error',async()=>{
 const f=fixture(),load=f.controller.load();await tick();f.own.reject(Error('own failure'));await tick();f.pub.resolve(result([article]));await load
 assert.deepEqual(f.controller.getSnapshot().items,[article]);assert.equal(f.controller.getSnapshot().error,'failure');assert.equal(f.controller.getSnapshot().loading,false)
})
for(const ownFirst of [false,true])test(`both failures retain public error precedence; ownFirst=${ownFirst}`,async()=>{
 const f=fixture(),load=f.controller.load();await tick()
 if(ownFirst){f.own.reject(Error('own failure'));await tick()}
 f.pub.reject(Error('public-business-required'));await load
 if(!ownFirst){f.own.reject(Error('own failure'));await tick()}
 assert.equal(f.controller.getSnapshot().error,'unavailable')
})
test('own refresh-class error retains existing item-clearing policy',async()=>{
 const f=fixture(),load=f.controller.load();await tick();f.pub.resolve(result([article]));await tick();f.own.reject(Error('review-refresh-required'));await load
 assert.equal(f.controller.getSnapshot().error,'refresh');assert.deepEqual(f.controller.getSnapshot().items,[])
})
for(const reason of ['business A to B','account change','sign-out','unmount'])test(`${reason}: disposed parallel reads cannot publish`,async()=>{
 const a=fixture(),old=a.controller.load();await tick();a.controller.dispose()
 const b=fixture({businessId:'b',authenticated:reason!=='sign-out'}),fresh=b.controller.load();await tick();b.pub.resolve(result([article]));b.own.resolve(null);await fresh
 const before=b.controller.getSnapshot();a.pub.resolve(result([{publicReviewId:'stale'}]));a.own.resolve({status:'stale'});await old
 assert.equal(b.controller.getSnapshot(),before);assert.deepEqual(a.controller.getSnapshot(),{items:[],own:null})
})
test('late own result from old generation cannot finish new generation',async()=>{
 const o1=deferred(),o2=deferred();let calls=0
 const c=createReviewController({businessId:'a',authenticated:true,api:{listPublic:async()=>result([article]),getOwn:()=>++calls===1?o1.promise:o2.promise}})
 const old=c.load();await tick();c.dispose();c.start();const fresh=c.load();await tick()
 const before=c.getSnapshot();o1.reject(Error('stale own failure'));await old
 assert.equal(c.getSnapshot(),before);assert.equal(c.getSnapshot().loading,true);assert.equal(c.getSnapshot().error,'')
 o2.resolve({status:'current'});await fresh;assert.equal(c.getSnapshot().own.status,'current');assert.equal(c.getSnapshot().loading,false)
})
test('old public response cannot change newer generation loading/error',async()=>{
 const p1=deferred(),o1=deferred(),p2=deferred(),o2=deferred();let pc=0,oc=0
 const c=createReviewController({businessId:'a',authenticated:true,api:{listPublic:()=>++pc===1?p1.promise:p2.promise,getOwn:()=>++oc===1?o1.promise:o2.promise}})
 const old=c.load();await tick();c.dispose();c.start();const fresh=c.load();await tick()
 p1.resolve(result([article]));o1.reject(Error('stale'));await old
 assert.equal(c.getSnapshot().loading,true);assert.equal(c.getSnapshot().error,'');assert.deepEqual(c.getSnapshot().items,[])
 p2.resolve(result());o2.resolve(null);await fresh;assert.equal(c.getSnapshot().ready,true)
})
