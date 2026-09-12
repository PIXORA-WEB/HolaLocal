import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { analyticsPage, analyticsReferrer, clearAnalyticsCookies, privacyControlBlocksAnalytics } from '../src/services/analyticsPolicy.js'
import { analyticsEnglish } from '../src/i18n/analyticsEnglish.js'
import { analyticsTranslations } from '../src/i18n/locales/analyticsTranslations.js'

test('public allowlist omits private routes, identifiers, searches, titles and URL payloads', () => {
  for (const path of ['/profile','/messages','/admin','/my-reviews','/services/private-id','/login','/register','/business/dashboard','/services?email=private']) assert.equal(analyticsPage(path),null)
  assert.deepEqual(analyticsPage('/services'),{page_title:'Services',page_location:'https://www.holalocal.es/services'})
  assert.equal(analyticsReferrer('https://www.google.com/search?q=private&email=secret#token'),'https://www.google.com/')
  for(const url of ['https://private-person.example/message/123','https://www.google.com.evil.test/','javascript:secret','https://holalocal.es/profile'])assert.equal(analyticsReferrer(url),'')
})
test('respects browser signals and only deletes Analytics cookies across applicable paths/domains',()=>{
  assert.equal(privacyControlBlocksAnalytics({globalPrivacyControl:true}),true)
  assert.equal(privacyControlBlocksAnalytics({doNotTrack:'1'}),true)
  assert.equal(privacyControlBlocksAnalytics({}),false)
  const writes=[]
  clearAnalyticsCookies({get cookie(){return '_ga=old; _ga_TEST=old; _gid=old; session=keep; preference=keep'},set cookie(v){writes.push(v)}},'www.holalocal.es','/services/example')
  assert.ok(writes.some(v=>v.includes('domain=holalocal.es;')))
  assert.ok(writes.every(v=>/^_ga|^_gid/.test(v)))
  assert.ok(writes.every(v=>v.includes('Max-Age=0')))
})
test('17 consent translations have complete aligned keys without placeholders',()=>{
  assert.equal(Object.keys(analyticsTranslations).length,16)
  for(const [code,copy]of Object.entries({en:analyticsEnglish,...analyticsTranslations})){
    assert.deepEqual(Object.keys(copy),Object.keys(analyticsEnglish),code)
    for(const value of Object.values(copy))assert.ok(value.trim()&&!/\[.*\]|TODO|undefined/.test(value),code)
    assert.notEqual(copy.accept,copy.reject)
  }
})
async function controller({enabled=true,privacy=false}={}) {
  let choice=null, listener
  const calls=[], cookies=[]
  const context=vm.createContext({window:{},document:{referrer:'https://www.google.com/?secret=x',get cookie(){return ''},set cookie(v){cookies.push(v)}},location:{hostname:'www.holalocal.es',pathname:'/'},navigator:{globalPrivacyControl:privacy}})
  const sdk={startAnalytics:async(still,page)=>still()?{}:null,stopAnalytics:()=>calls.push('stop'),recordAnalyticsPage:(page,referrer)=>calls.push({page,referrer})}
  let imports=0, release
  let delayed=false
  const transport=new vm.SyntheticModule(Object.keys(sdk),function(){for(const k of Object.keys(sdk))this.setExport(k,(...args)=>sdk[k](...args))},{context})
  await transport.link(()=>{});await transport.evaluate()
  const source=await readFile(new URL('../src/services/analyticsController.js',import.meta.url),'utf8')
  const main=new vm.SourceTextModule(source,{context,initializeImportMeta(meta){meta.env={VITE_ANALYTICS_CONSENT_ENABLED:String(enabled),MODE:'production',VITE_FIREBASE_MEASUREMENT_ID:'G-TEST'}},importModuleDynamically:async()=>{imports++;if(delayed)await new Promise(r=>release=r);return transport}})
  await main.link(async name=>{
    const exports=name.includes('Consent')?{getAnalyticsChoice:()=>choice,subscribeAnalyticsChoice:fn=>{listener=fn;return()=>{}}}:{analyticsPage,analyticsReferrer,clearAnalyticsCookies,privacyControlBlocksAnalytics}
    return new vm.SyntheticModule(Object.keys(exports),function(){for(const k of Object.keys(exports))this.setExport(k,exports[k])},{context})
  });await main.evaluate();main.namespace.watchAnalyticsChoice()
  const flush=()=>new Promise(r=>setImmediate(r))
  return {calls,context,flush,get imports(){return imports},route:path=>main.namespace.updateAnalyticsRoute(path),choose:value=>{choice=value;listener()},delay:()=>{delayed=true},release:()=>release()}
}
test('fresh/rejected/private visits never import Analytics; acceptance is single-init, public-only, duplicate-free',async()=>{
  const c=await controller();c.route('/');await c.flush();assert.equal(c.imports,0)
  c.choose('rejected');c.route('/services');await c.flush();assert.equal(c.imports,0)
  c.route('/profile');c.choose('accepted');await c.flush();assert.equal(c.imports,0)
  c.route('/services');await c.flush();c.route('/services');await c.flush()
  assert.equal(c.imports,1);assert.equal(c.calls.filter(v=>v.page).length,1)
  assert.equal(c.context.window['ga-disable-G-TEST'],false)
  c.route('/events');await c.flush();assert.equal(c.calls.filter(v=>v.page).length,2)
  c.route('/messages');await c.flush();assert.equal(c.context.window['ga-disable-G-TEST'],true)
  c.choose('rejected');c.route('/');await c.flush();assert.equal(c.calls.filter(v=>v.page).length,2)
})
test('withdrawal during loading cancels pending page and a later explicit acceptance can recover',async()=>{
  const c=await controller();c.delay();c.route('/');c.choose('accepted');await c.flush()
  c.choose('rejected');c.release();await c.flush();assert.equal(c.calls.filter(v=>v.page).length,0)
  assert.equal(c.context.window['ga-disable-G-TEST'],true)
  c.choose('accepted');await c.flush();assert.equal(c.calls.filter(v=>v.page).length,1)
})
test('deployment switch and privacy controls fail closed even with acceptance',async()=>{
  for(const options of [{enabled:false},{privacy:true}]){
    const c=await controller(options);c.choose('accepted');c.route('/');await c.flush();assert.equal(c.imports,0)
  }
})

test('authoritative consent storage survives returning visits, supports tab-only choice and cross-tab withdrawal',async()=>{
 const store=new Map(), handlers=new Set()
 const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}
 const source=await readFile(new URL('../src/services/analyticsConsent.js',import.meta.url),'utf8')
 const load=async()=>{const m=new vm.SourceTextModule(source,{context:vm.createContext({localStorage:storage,window:{addEventListener:(type,fn)=>handlers.add(fn),removeEventListener:(type,fn)=>handlers.delete(fn)}})});await m.link(()=>{});await m.evaluate();return m.namespace}
 const first=await load();assert.equal(first.getAnalyticsChoice(),null);first.setAnalyticsChoice('accepted')
 const returning=await load();assert.equal(returning.getAnalyticsChoice(),'accepted')
 let observed
 returning.subscribeAnalyticsChoice(()=>observed=returning.getAnalyticsChoice())
 first.setAnalyticsChoice('rejected');for(const fn of handlers)fn({key:first.ANALYTICS_CHOICE_KEY})
 assert.equal(observed,'rejected')
 storage.setItem=()=>{throw Error('Storage blocked')}
 first.setAnalyticsChoice('accepted');assert.equal(first.getAnalyticsChoice(),'accepted')
 assert.throws(()=>first.setAnalyticsChoice('yes'))
})
test('SDK initialization denies all advertising, strips campaign attribution and does not bind an account',async()=>{
 const calls=[]
 const sdk={isSupported:async()=>true,initializeAnalytics:(app,options)=>{calls.push(['initialize',options]);return {}},setConsent:value=>calls.push(['consent',value]),setDefaultEventParameters:value=>calls.push(['defaults',value]),setAnalyticsCollectionEnabled:(client,value)=>calls.push(['enabled',value]),logEvent:(client,name,value)=>calls.push([name,value])}
 const context=vm.createContext({})
 const m=new vm.SourceTextModule(await readFile(new URL('../src/firebase/analyticsClient.js',import.meta.url),'utf8'),{context})
 await m.link(name=>{const values=name==='firebase/analytics'?sdk:{getFirebaseApp:()=>({})};return new vm.SyntheticModule(Object.keys(values),function(){for(const k in values)this.setExport(k,values[k])},{context})});await m.evaluate()
 const page=analyticsPage('/events')
 await m.namespace.startAnalytics(()=>false,page,'');assert.equal(calls.length,0)
 await m.namespace.startAnalytics(()=>true,page,'');await m.namespace.startAnalytics(()=>true,page,'')
 assert.equal(calls.filter(v=>v[0]==='initialize').length,1)
 const settings=calls.find(v=>v[0]==='initialize')[1].config
 for(const key of ['send_page_view','allow_google_signals','allow_ad_personalization_signals'])assert.equal(settings[key],false)
 assert.equal(settings.user_id,null);assert.equal(settings.campaign_term,'')
 assert.equal(calls.find(v=>v[0]==='consent')[1].ad_storage,'denied')
 m.namespace.recordAnalyticsPage(page,'')
 assert.equal(calls.some(v=>v[0]==='enabled'),false,'never queue asynchronous SDK enable operations')
 assert.equal(calls.filter(v=>v[0]==='consent').length,1,'no denied consent-mode pings on withdrawal')
})
