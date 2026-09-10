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
    if(id==='react'&&(importer?.endsWith('/CustomerReviewModeration.jsx')||importer?.endsWith('/ReviewReasonSelect.jsx')))return '\0hooks'
    if(/^(firebase|@firebase)/.test(id))throw new Error('Firebase forbidden in component tests')
  },load(id){
    if(id==='\0hooks')return `let states=[],saved=[],refs=[],refIndex=0;export const changes=[],effects=[];export const setStates=value=>{states=[...value];saved=[];refs=[];refIndex=0;changes.length=0;effects.length=0};export const rerender=()=>{states=[...saved];saved=[];refIndex=0;effects.length=0};export const useState=value=>{const index=saved.length,current=states.length?states.shift():value;saved.push(current);return [current,value=>{saved[index]=typeof value==='function'?value(saved[index]):value;changes.push(saved[index])}]};export const useRef=value=>refs[refIndex++]??(refs[refIndex-1]={current:value});export const useId=()=> 'review-test';export const useMemo=fn=>fn();export const useEffect=fn=>effects.push(fn);export const useSyncExternalStore=(a,get)=>get();`
    if(id==='\0translation')return `export const useTranslation=()=>({t:(key)=>key,i18n:{resolvedLanguage:'en'}})`
    if(id==='\0review-harness')return `export * from '${root}/src/components/admin/CustomerReviewModeration.jsx';export {default as ReviewReasonSelect} from '${root}/src/components/admin/ReviewReasonSelect.jsx';export {setStates,changes,rerender,effects} from 'review-test-hooks';export {createElement} from 'react';export {renderToStaticMarkup} from 'react-dom/server';`
  }
},react()],ssr:{noExternal:true},build:{ssr:'review-harness',outDir:output,emptyOutDir:false,rolldownOptions:{output:{entryFileNames:'harness.mjs'}}}})
const {ReviewModerationCase,ReviewReasonSelect,setStates,changes,rerender,effects,renderToStaticMarkup}=await import(pathToFileURL(resolve(output,'harness.mjs')))
const nodes=(tree,out=[])=>{if(!tree||typeof tree!=='object')return out;if(tree.type)out.push(tree);for(const child of [tree.props?.children].flat(Infinity))nodes(child,out);return out}
const pending={publicReviewId:'r',businessId:'fictional-business',version:7,pending:{revision:3,rating:4,displayName:'Test reviewer',originalText:'<script>plain customer text</script>'},published:{revision:2,rating:3,displayName:'Test reviewer',originalText:'Previous original text'},businessAvailable:true}
const report={reportId:'report',publicReviewId:'r',version:2,status:'open',observedPublishedRevision:3,observedRevisionIsCurrent:true,targetState:'published',currentReview:{publishedRevision:3,version:9,rating:4,displayName:'Test reviewer',originalText:'Current original text'},reasonCode:'spam',details:'Details for moderation',reporterUid:'DO-NOT-DISPLAY',resolution:{moderationNote:'INTERNAL-NOTE'}}
test('actual pending case escapes originals, shows both revisions and requires a rejection reason',()=>{
 setStates([])
 const tree=ReviewModerationCase({item:pending,reports:false,onAction(){},blocked:false})
 const html=renderToStaticMarkup(tree)
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Previous original text'))
 assert.ok(html.includes('adminCustomerReviews.approveEdit'));assert.ok(html.includes('adminCustomerReviews.rejectEdit'))
 const reject=nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.reject')
 assert.equal(reject.props.disabled,false);reject.props.onClick();assert.equal(changes.at(-1),true)
})
test('actual confirmed approval carries expected review version',()=>{
 setStates([]);const calls=[],props={item:pending,reports:false,onAction:(...args)=>calls.push(args),blocked:false}
 let tree=ReviewModerationCase(props)
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.approve').props.onClick()
 assert.equal(calls.length,0);assert.deepEqual(changes.at(-1),{action:'approve',payload:{publicReviewId:'r',expectedVersion:7}})
 rerender();tree=ReviewModerationCase(props)
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.confirm').props.onClick()
 assert.deepEqual(calls,[['approve',{publicReviewId:'r',expectedVersion:7}]])
})
test('resolution and removal are separately confirmed; private identity and internal notes are not rendered',()=>{
 setStates(['A checked resolution reason',null,false]);const calls=[],props={item:report,reports:true,onAction:(...args)=>calls.push(args),blocked:false}
 let tree=ReviewModerationCase(props),html=renderToStaticMarkup(tree)
 assert.ok(!html.includes('DO-NOT-DISPLAY'));assert.ok(!html.includes('INTERNAL-NOTE'))
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.resolve').props.onClick()
 rerender();tree=ReviewModerationCase(props)
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.confirm').props.onClick()
 assert.deepEqual(calls,[['resolved',{reportId:'report',expectedVersion:2,disposition:'resolved',resolutionReason:'A checked resolution reason'}]])
 for(const item of [{...report,observedRevisionIsCurrent:false},{...report,targetState:'erased',currentReview:null,observedRevisionIsCurrent:false}]){
  setStates([]);const tree=ReviewModerationCase({...props,item})
  assert.equal(nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.remove').props.disabled,true)
 }
})


test('confirmed rejection separates author reason from optional private note and renders admin dates',()=>{
 setStates(['personal_information',null,false,'PRIVATE admin note'])
 const calls=[],props={item:{...pending,pendingSubmittedAt:{seconds:1788177600,nanoseconds:2000},publicationDates:{publishedAt:{seconds:1788004800,nanoseconds:1000},updatedAt:{seconds:1788004800,nanoseconds:1000}}},reports:false,onAction:(...args)=>calls.push(args),blocked:false}
 let tree=ReviewModerationCase(props)
 assert.ok(renderToStaticMarkup(tree).includes('adminCustomerReviews.submittedAt'))
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.reject').props.onClick()
 rerender();tree=ReviewModerationCase(props)
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.confirm').props.onClick()
 assert.deepEqual(calls,[['reject',{publicReviewId:'r',expectedVersion:7,rejectionReasonCode:'personal_information',moderationNote:'PRIVATE admin note'}]])
})


test('new submission uses publish/unpublished guidance and honest business ID fallback',()=>{
 setStates([])
 const props={item:{...pending,published:null,name:'PRIVATE-NAME',businessProfile:{name:'UNTRUSTED-NAME'}},reports:false,onAction(){},blocked:false}
 let tree=ReviewModerationCase(props),html=renderToStaticMarkup(tree)
 assert.ok(html.includes('fictional-business'));assert.ok(!html.includes('PRIVATE-NAME'));assert.ok(!html.includes('UNTRUSTED-NAME'))
 assert.ok(html.includes('adminCustomerReviews.approveNew'));assert.ok(html.includes('adminCustomerReviews.rejectNew'))
 assert.ok(!html.includes('adminCustomerReviews.approveEdit'));assert.ok(!html.includes('adminCustomerReviews.publishedVersion'))
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.approve').props.onClick()
 rerender();tree=ReviewModerationCase(props)
 const dialog=nodes(tree).find(n=>typeof n.type==='function'&&n.props.ariaLabelledBy==='admin-review-confirm-title')
 assert.ok(renderToStaticMarkup(dialog.props.children).includes('adminCustomerReviews.newPolicy'))
})

test('edit comparison orders published before proposed and separates approval from rejection inputs',()=>{
 setStates([])
 const tree=ReviewModerationCase({item:pending,reports:false,onAction(){},blocked:false}),html=renderToStaticMarkup(tree)
 assert.ok(html.indexOf('adminCustomerReviews.publishedVersion')<html.indexOf('adminCustomerReviews.proposed'))
 const all=nodes(tree),comparison=all.find(n=>n.props.className?.includes('comparison--edit'))
 assert.ok(comparison)
 const approve=all.find(n=>n.type==='section'&&n.props['aria-labelledby']==='admin-review-approve-title')
 assert.ok(nodes(approve).some(n=>n.type==='button'&&n.props.children==='adminCustomerReviews.approve'))
 assert.ok(!nodes(approve).some(n=>n.type==='select'||n.type==='textarea'))
 const reject=all.find(n=>n.type==='fieldset'),inputs=nodes(reject)
 assert.equal(inputs.find(n=>n.type===ReviewReasonSelect).props.options[0].label,'adminCustomerReviews.selectReason')
 assert.equal(inputs.find(n=>n.type==='textarea').props['aria-describedby'],'admin-review-note-help')
 assert.ok(inputs.some(n=>n.props.id==='admin-review-note-help'))
})


test('reason combobox keyboard selection, type-ahead, focus return and normal Tab behaviour',()=>{
 setStates([])
 const selected=[],options=[{value:'',label:'Select a reason'},{value:'spam',label:'Spam'},{value:'abusive_content',label:'Abusive content'},{value:'personal_information',label:'Personal information'}]
 const props={label:'Reason',options,value:'spam',onChange:value=>selected.push(value),disabled:false,invalid:true,errorId:'reason-error',language:'en'}
 let tree=ReviewReasonSelect(props),focus=0
 const button=()=>nodes(tree).find(n=>n.props.role==='combobox')
 button().props.ref.current={focus(){focus++},getBoundingClientRect(){return null}}
 const key=value=>{let prevented=false;button().props.onKeyDown({key:value,preventDefault(){prevented=true}});rerender();tree=ReviewReasonSelect(props);return prevented}
 assert.equal(button().props.type,'button');assert.equal(button().props['aria-describedby'],'reason-error')
 key('ArrowDown');assert.equal(button().props['aria-expanded'],true)
 key('p');assert.ok(button().props['aria-activedescendant'].endsWith('-3'))
 key('Enter');assert.deepEqual(selected,['personal_information']);assert.equal(focus,1);assert.equal(button().props['aria-expanded'],false)
 key(' ');assert.equal(button().props['aria-expanded'],true)
 key('Home');assert.ok(button().props['aria-activedescendant'].endsWith('-0'))
 key('End');assert.ok(button().props['aria-activedescendant'].endsWith('-3'))
 key('Escape');assert.equal(button().props['aria-expanded'],false)
 key('ArrowUp');assert.equal(key('Tab'),false);assert.equal(button().props['aria-expanded'],false)
 for(const option of nodes(tree).filter(n=>n.props.role==='option')){assert.equal(option.props.tabIndex,-1);assert.equal(option.props.type,'button')}
})

test('reason combobox outside click, disabled state and selection callbacks',()=>{
 const handlers=new Map(),oldDocument=globalThis.document,oldWindow=globalThis.window
 globalThis.document={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)}
 globalThis.window={addEventListener(){},removeEventListener(){}}
 try{
  setStates([true,1,{}]);const calls=[],props={label:'Reason',options:[{value:'',label:'Select'},{value:'spam',label:'Spam'}],value:'',onChange:value=>calls.push(value)}
  let tree=ReviewReasonSelect(props)
  const cleanups=effects.map(effect=>effect())
  handlers.get('pointerdown')({target:{}});rerender();tree=ReviewReasonSelect(props)
  assert.equal(nodes(tree).find(n=>n.props.role==='combobox').props['aria-expanded'],false)
  nodes(tree).find(n=>n.props.role==='option'&&n.props['data-option-index']===1).props.onClick()
  assert.deepEqual(calls,['spam'])
  cleanups.forEach(cleanup=>cleanup?.())
  setStates([true,1,{}]);tree=ReviewReasonSelect({...props,disabled:true})
  const button=nodes(tree).find(n=>n.props.role==='combobox');assert.equal(button.props.disabled,true);assert.equal(button.props['aria-expanded'],false)
  button.props.onKeyDown({key:'Enter',preventDefault(){assert.fail('Disabled')}})
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow}
})
