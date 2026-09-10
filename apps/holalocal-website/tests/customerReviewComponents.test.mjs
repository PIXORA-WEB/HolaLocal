import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'vite'
import react from '@vitejs/plugin-react'
const root=resolve(import.meta.dirname,'..'),output=await mkdtemp(resolve(tmpdir(),'holalocal-review-components-'))
await build({root,configFile:false,envDir:false,publicDir:false,logLevel:'silent',plugins:[{
  name:'isolated-review-components',enforce:'pre',resolveId(id,importer){
    if(id==='review-harness'||id===resolve(root,'review-harness'))return '\0review-harness'
    if(id==='review-test-hooks')return '\0hooks'
    if(id==='react-i18next')return '\0translation'
    if(id==='react'&&importer?.endsWith('/CustomerReviews.jsx'))return '\0hooks'
    if(/^(firebase|@firebase)/.test(id))throw new Error('Firebase forbidden in component tests')
  },load(id){
    if(id==='\0hooks')return `let states=[],saved=[],refs=[],refIndex=0;export const changes=[],effects=[];export const setStates=value=>{states=[...value];saved=[];refs=[];refIndex=0;changes.length=0;effects.length=0};export const rerender=()=>{states=[...saved];saved=[];refIndex=0;effects.length=0};export const useState=value=>{const index=saved.length,current=states.length?states.shift():value;saved.push(current);return [current,value=>{saved[index]=typeof value==='function'?value(saved[index]):value;changes.push(saved[index])}]};export const useRef=value=>refs[refIndex++]??(refs[refIndex-1]={current:value});export const useId=()=> 'review-test';export const useMemo=fn=>fn();export const useEffect=fn=>effects.push(fn);export const useSyncExternalStore=(a,get)=>get();`
    if(id==='\0translation')return `export const useTranslation=()=>({t:(key)=>key,i18n:{resolvedLanguage:'en'}})`
    if(id==='\0review-harness')return `export * from '${root}/src/components/reviews/CustomerReviews.jsx';export {setStates,changes,rerender,effects} from 'review-test-hooks';export {createElement} from 'react';import {createElement as h} from 'react';import {MemoryRouter} from 'react-router-dom';import {renderToStaticMarkup as render} from 'react-dom/server';export const renderToStaticMarkup=tree=>render(h(MemoryRouter,null,tree));`
  }
},react()],ssr:{noExternal:true},build:{ssr:'review-harness',outDir:output,emptyOutDir:false,rolldownOptions:{output:{entryFileNames:'harness.mjs'}}}})
const {AuthorForm,OwnStatus,ReportDialog,ReviewRatingSummary,setStates,changes,rerender,effects,createElement,renderToStaticMarkup}=await import(pathToFileURL(resolve(output,'harness.mjs')))
const nodes=(tree,out=[])=>{if(!tree||typeof tree!=='object')return out;if(tree.type)out.push(tree);for(const child of [tree.props?.children].flat(Infinity))nodes(child,out);return out}
const own={publicReviewId:'opaque-review',businessId:'b',version:8,status:'published',businessAvailable:true,published:{revision:3,rating:4,displayName:'Test reviewer',originalText:'<script>Fictional literal review text.</script>',declaredSourceLanguage:null}}
const state={busy:false,loading:false,error:'',uncertain:false}
test('actual form escapes originals and wires edit/withdraw to expected versions',()=>{
  const calls=[];const controller={execute:(...args)=>calls.push(args)}
  const tree=AuthorForm({own,state,controller,user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b'})
  const elements=nodes(tree);elements.find(node=>node.type==='form').props.onSubmit({preventDefault(){}})
  assert.deepEqual(calls[0],['edit',{businessId:'b',expectedVersion:8,rating:4,displayName:'Test reviewer',originalText:own.published.originalText,declaredSourceLanguage:null}])
  elements.filter(node=>node.type==='button'&&node.props.children==='customerReviews.withdraw').at(-1).props.onClick()
  assert.deepEqual(calls[1],['withdraw',{publicReviewId:'opaque-review',expectedVersion:8}])
  const html=renderToStaticMarkup(tree)
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'))
  assert.equal((html.match(/type="radio"/g)||[]).length,5)
  assert.ok(html.includes('aria-describedby="review-test-count review-test-translation-notice"'))
})
test('pending edits retain approved text and withdrawal; summaries cannot use legacy fields',()=>{
  const pending={...own,status:'pending',pending:{revision:4,rating:5,displayName:'Test reviewer',originalText:'Pending original'},lastSubmitted:{revision:4,rating:5,displayName:'Test reviewer',originalText:'Pending original'}}
  const html=renderToStaticMarkup(createElement(OwnStatus,{own:pending}))
  assert.ok(html.includes('customerReviews.pendingEdit'));assert.ok(html.includes('Pending original'));assert.ok(html.includes('&lt;script&gt;'))
  const form=AuthorForm({own:pending,state,controller:{execute(){}},user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b'})
  assert.equal(nodes(form).filter(node=>node.type==='form').length,0)
  const unknown=renderToStaticMarkup(createElement(ReviewRatingSummary,{summary:{ratingAverage:5,ratingCount:999}}))
  assert.ok(unknown.includes('statsUnavailable'));assert.ok(!unknown.includes('999'))
})


test('actual report form sends observed revision, reason, normalized details and an idempotency key',()=>{
  const calls=[];setStates(['spam','  Fictional report details  '])
  const tree=ReportDialog({review:{publicReviewId:'opaque-public',publishedRevision:7},api:{report:p=>{calls.push(p);return Promise.resolve({status:'open'})}},user:{uid:'u',emailVerified:true},profile:{accountStatus:'active'},onClose(){},open:true})
  nodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}})
  assert.equal(calls.length,1);assert.equal(calls[0].publicReviewId,'opaque-public');assert.equal(calls[0].observedPublishedRevision,7)
  assert.equal(calls[0].reasonCode,'spam');assert.equal(calls[0].details,'Fictional report details');assert.equal(typeof calls[0].requestId,'string')
  assert.equal(calls[0].reporterUid,undefined)
})


test('star choices retain labelled native radio semantics and selected numeric feedback',()=>{
  setStates([{rating:3,text:'A thoughtful and carefully completed job.'},true,false,false])
  const tree=AuthorForm({own:null,state,controller:{execute(){}},user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b'})
  const radios=nodes(tree).filter(node=>node.type==='input'&&node.props.type==='radio')
  assert.equal(radios.length,5)
  assert.equal(radios.filter(node=>node.props.checked).length,1)
  assert.equal(radios[2].props.checked,true)
  for(const [index,radio] of radios.entries())assert.equal(radio.props['aria-label'],`customerReviews.rating: ${index+1} / 5`)
  radios[4].props.onChange();assert.deepEqual(changes.at(-1),{rating:5,text:'A thoughtful and carefully completed job.',displayName:''})
  const html=renderToStaticMarkup(tree)
  assert.ok(html.includes('customer-reviews__selected'))
  assert.ok(html.includes('3 / 5'))
})

test('published status is not repeated, while pending-edit distinction remains explicit',()=>{
  const html=renderToStaticMarkup(createElement(OwnStatus,{own}))
  assert.equal((html.match(/customerReviews.published/g)||[]).length,1)
})


test('collapsed editor keeps draft across Cancel/reopen and returns focus to its trigger (simulated hooks)',()=>{
  setStates([])
  const props={own,state,controller:{execute(){},clearSuccessFeedback(){}},user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b',heading:true}
  let tree=AuthorForm(props)
  let trigger=nodes(tree).find(n=>n.props['aria-controls'])
  assert.equal(trigger.props['aria-expanded'],false)
  assert.equal(trigger.props.children,'customerReviews.editTrigger')
  assert.equal(nodes(tree).find(n=>n.props.id==='review-test-editor').props.hidden,true)
  trigger.props.onClick();rerender();tree=AuthorForm(props)
  assert.equal(nodes(tree).find(n=>n.props.id==='review-test-editor').props.hidden,false)
  let focusedInput=0,focusedTrigger=0
  nodes(tree).find(n=>n.props.id==='review-test-editor').props.ref.current={querySelector:()=>({focus:()=>focusedInput++})}
  assert.equal(nodes(tree).filter(n=>n.props['aria-controls']).length,0)
  effects[0]();assert.equal(focusedInput,1)
  nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'A private draft that must survive cancellation.'}})
  nodes(tree).find(n=>n.type==='button'&&n.props.children==='common.cancel').props.onClick()
  rerender();tree=AuthorForm(props)
  nodes(tree).find(n=>n.props['aria-controls']).props.ref.current={focus:()=>focusedTrigger++}
  effects[0]();assert.equal(focusedTrigger,1)
  assert.equal(nodes(tree).find(n=>n.props.id==='review-test-editor').props.hidden,true)
  nodes(tree).find(n=>n.props['aria-controls']).props.onClick();rerender();tree=AuthorForm(props)
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'A private draft that must survive cancellation.')
})

test('only confirmed success for this review collapses and clears the editor (simulated subscription)',()=>{
  setStates([{rating:5,text:'Private draft with an uncertain response.'},true,false,false])
  let snapshot={feedback:''},notify
  const controller={execute(){},getSnapshot:()=>snapshot,subscribe:fn=>{notify=fn;return()=>{}}}
  const props={own,state,controller,user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b'}
  AuthorForm(props);effects[1]()
  snapshot={feedback:'',uncertain:true};notify();assert.equal(changes.length,0)
  snapshot={feedback:'edit',feedbackTarget:'another-review'};notify();assert.equal(changes.length,0)
  snapshot={feedback:''};notify()
  snapshot={feedback:'edit',feedbackTarget:'b'};notify()
  rerender();const tree=AuthorForm(props)
  assert.equal(nodes(tree).find(n=>n.props.id==='review-test-editor').props.hidden,true)
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,own.published.originalText)
})

test('withdrawal explanations distinguish pending, published and published-with-edit',()=>{
  const cases=[{value:{...own,published:null,pending:{revision:1},status:'pending'},key:'withdrawPending'},{value:own,key:'withdrawPublished'},{value:{...own,pending:{revision:4},status:'pending'},key:'withdrawBoth'}]
  for(const {value,key} of cases){
    setStates([])
    const tree=AuthorForm({own:value,state,controller:{execute(){}},user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b'})
    assert.ok(renderToStaticMarkup(tree).includes(`customerReviews.${key}`))
    if(value.pending)assert.equal(nodes(tree).filter(n=>n.props['aria-controls']).length,0)
  }
})


test('opening invokes success-only dismissal while keeping lifecycle status and draft',()=>{
  let cleared=0
  setStates([{rating:4,text:'The draft is kept for a safe retry.'},false,false,false])
  const props={own:{...own,status:'withdrawn',published:null},state:{...state,error:'failure',uncertain:true},controller:{clearSuccessFeedback(){cleared++}},user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b'}
  let tree=AuthorForm(props)
  nodes(tree).find(n=>n.props['aria-controls']).props.onClick()
  assert.equal(cleared,1)
  rerender();tree=AuthorForm(props)
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'The draft is kept for a safe retry.')
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.disabled,true)
  assert.ok(renderToStaticMarkup(tree).includes('customerReviews.withdrawn'))
})

test('19 normalized code points produce an associated accessible field error and no command',()=>{
  const calls=[]
  // 38 decomposed code points become 19 after trim/NFC, not 38 characters.
  setStates([{rating:4,text:'  '+ 'e\u0301'.repeat(19)+'  '},true,false,false])
  const props={own:null,state,controller:{execute:(...args)=>calls.push(args)},user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b'}
  let tree=AuthorForm(props)
  nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
  assert.equal(calls.length,0)
  rerender();tree=AuthorForm(props)
  const field=nodes(tree).find(n=>n.type==='textarea'),error=nodes(tree).find(n=>n.props.id==='review-test-error')
  assert.equal(field.props['aria-invalid'],true)
  assert.ok(field.props['aria-describedby'].split(' ').includes(error.props.id))
  assert.equal(error.props.role,'alert')
  assert.equal(error.props.children,'customerReviews.validation')
})


test('author sees only matching rejected-revision guidance, never an internal note',()=>{
 const item={...own,status:'rejected',lastSubmitted:{revision:4,rating:2,displayName:'Test reviewer',originalText:'Rejected edit text'},rejection:{revision:4,reasonCode:'personal_information'},moderationNote:'PRIVATE admin note'}
 const html=renderToStaticMarkup(createElement(OwnStatus,{own:item}))
 assert.ok(html.includes('customerReviews.rejection_personal_information'))
 assert.ok(!html.includes('PRIVATE admin note'))
 const later=renderToStaticMarkup(createElement(OwnStatus,{own:{...item,status:'pending',pending:{revision:5},lastSubmitted:{...item.lastSubmitted,revision:5}}}))
 assert.ok(!later.includes('customerReviews.rejection_personal_information'))
})


test('new name field is blank despite private account values and discloses publication',()=>{
 setStates([null,true,false,false])
 const tree=AuthorForm({own:null,state,controller:{execute(){}},user:{uid:'u',emailVerified:true,displayName:'PRIVATE ACCOUNT',email:'private@example.invalid'},profile:{accountStatus:'active',roles:['customer'],displayName:'PRIVATE PROFILE'},businessId:'b'})
 const field=nodes(tree).find(n=>n.type==='input'&&n.props.name==='displayName')
 assert.equal(field.props.value,'');assert.equal(field.props.autoComplete,'off')
 const html=renderToStaticMarkup(tree)
 assert.ok(html.includes('customerReviews.displayNameNotice'))
 assert.ok(!html.includes('PRIVATE ACCOUNT'));assert.ok(!html.includes('PRIVATE PROFILE'));assert.ok(!html.includes('private@example.invalid'))
})


test('quota exhaustion does not disable withdrawal of the current review',()=>{
 setStates([null,false,false,false])
 const tree=AuthorForm({own,state:{...state,error:'quota'},controller:{execute(){}},user:{uid:'u',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'b'})
 const button=nodes(tree).find(n=>n.type==='button'&&n.props.children==='customerReviews.withdraw')
 assert.ok(button);assert.equal(button.props.disabled,false)
})
