import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname,resolve,extname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {build} from 'vite'
import {chromium} from '@playwright/test'
const here=dirname(fileURLToPath(import.meta.url)), src=resolve(here,'../../../src'), out=await mkdtemp(resolve(tmpdir(),'holalocal-featured-browser-'))
const replacements={
 'firebase/firestoreClient.js':'export const db={}',
 'firebase/functionsClient.js':`export const listPublicBusinessesCallable=async({maxResults})=>{if(maxResults!==60)throw Error('limit changed');return {data:{businesses:window.fixture.businesses}}};export const getPublicBusinessCallable=async({businessId})=>({data:{business:window.fixture.businesses.find(b=>b.businessId===businessId)}});export const ensureOwnerBusinessCallable=()=>{throw Error('unexpected')};export const getOwnerSubscriptionStatusCallable=ensureOwnerBusinessCallable;export const manageBusinessMediaCallable=ensureOwnerBusinessCallable;`,
 'firebase/storageClient.js':`export async function getCanonicalImageBlob(path){window.fixture.calls.push(path);return new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="navy"/></svg>'],{type:'image/svg+xml'})}`,
 'hooks/useAuthentication.js':'export default ()=>({user:null,userProfile:null})',
}
await writeFile(resolve(out,'index.html'),`<div id="root"></div><script type="module" src="${resolve(here,'fixture.jsx')}"></script>`)
await build({root:out,configFile:false,envDir:false,plugins:[{name:'synthetic-transport',enforce:'pre',transform(code,id){for(const [path,source] of Object.entries(replacements))if(id===resolve(src,path))return source}}],build:{outDir:resolve(out,'dist')}})
const browser=await chromium.launch({args:['--disable-dev-shm-usage']}), results=[]
try {
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],blocked=[]
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:18469'){blocked.push(url.href);return route.abort()}
   const path=url.pathname.startsWith('/assets/')?url.pathname:'/index.html'
   return route.fulfill({body:await readFile(resolve(out,'dist')+path),contentType:({'.js':'text/javascript','.css':'text/css','.webp':'image/webp'})[extname(path)]??'text/html'})
  })
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000)
  try {
   await page.goto('http://127.0.0.1:18469/');const cards=page.locator('.directory-business-card');await cards.first().waitFor()
   assert.equal(await cards.count(),3)
   for(let n=0;n<3;n++)assert.ok((await cards.nth(n).textContent()).includes(`Business ${n} —`))
   assert.deepEqual(await page.evaluate(()=>[...window.fixture.calls].sort()),['b0','b1','b2'].map(id=>`businesses/${id}/logos/logo`))
   const styles=await cards.first().evaluate(el=>({display:getComputedStyle(el).display,padding:getComputedStyle(el).paddingTop,border:getComputedStyle(el).borderTopWidth}))
   assert.equal(styles.display,'grid');assert.equal(styles.padding,width===390?'17.6px':'20px');assert.equal(styles.border,'1px')
   await cards.first().screenshot({path:resolve(out,`home-${width}.png`)})
   await cards.first().click();await page.locator('.business-detail').waitFor()
   assert.ok(page.url().endsWith('/services/b0'))
   assert.equal(await page.locator('#business-photos img').count(),2)
   assert.equal(await page.evaluate(()=>window.fixture.calls.length),5)
   await page.locator('.business-detail__back').click();await cards.first().waitFor()
   assert.equal(await cards.count(),3);assert.equal(await page.evaluate(()=>window.fixture.calls.length),5)
   assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);results.push({width,pass:true,styles,operations:5})
  }catch(error){results.push({width,pass:false,error:error.stack,errors,blocked})}finally{await context.close()}
 }
}finally{await browser.close()}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({out,results},null,2))
if(results.some(r=>!r.pass))process.exitCode=1
