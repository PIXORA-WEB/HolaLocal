// Test-only routing adapter for real vercel.json + fresh production build.
// No accounts/records: external browser requests are blocked.
// Also verify actual Vercel routing on the PR preview.
import assert from 'node:assert/strict'
import {readFile,stat} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,extname,sep} from 'node:path'
import {build} from 'vite'
import {chromium} from 'playwright'
const root=resolve(import.meta.dirname,'../..')
const config=JSON.parse(await readFile(resolve(root,'vercel.json'),'utf8'))
const routes=['/my-reviews','/admin/customer-reviews','/admin/customer-review-reports']
for(const route of routes)assert.deepEqual(config.rewrites.filter(r=>r.source===route),[{source:route,destination:'/index.html'}])
assert.equal(config.rewrites.some(r=>['/(.*)','/:path*'].includes(r.source)),false)
Object.assign(process.env,{
 VITE_FIREBASE_API_KEY:'synthetic-routing-key',VITE_FIREBASE_AUTH_DOMAIN:'routing.invalid',
 VITE_FIREBASE_PROJECT_ID:'holalocal-routing-fixture',VITE_FIREBASE_STORAGE_BUCKET:'routing.invalid',
 VITE_FIREBASE_MESSAGING_SENDER_ID:'123456789',VITE_FIREBASE_APP_ID:'1:123456789:web:routing',
 VITE_CUSTOMER_REVIEWS_ENABLED:'false',
})
const dist=resolve(root,'dist')
await build({root,mode:'production',logLevel:'warn'})
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'}
const server=createServer(async(req,res)=>{
 try{
  let path=new URL(req.url,'http://127.0.0.1').pathname
  const rewrite=config.rewrites.find(r=>new RegExp('^'+r.source.replace(/:[A-Za-z]+/g,'[^/]+')+'$').test(path))
  if(rewrite)path=rewrite.destination
  if(path==='/')path='/index.html'
  const file=resolve(dist,'.'+path)
  if(!file.startsWith(dist+sep)||!(await stat(file)).isFile())throw new Error('not-found')
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'});res.end(await readFile(file))
 }catch{res.writeHead(404);res.end('Not found')}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']})
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}})
  const reviewRequests=[]
  await context.route('**/*',route=>{
   if(/CustomerReview/.test(route.request().url()))reviewRequests.push(route.request().url())
   return new URL(route.request().url()).origin===origin?route.continue():route.abort()
  })
  const page=await context.newPage()
  for(const path of routes){
   const expected=path==='/my-reviews'?'/services':'/login'
   assert.equal((await fetch(origin+path)).status,200)
   assert.equal((await page.goto(origin+path,{waitUntil:'domcontentloaded'})).status(),200)
   await page.waitForURL(origin+expected)
   await page.evaluate(path=>history.replaceState(null,'',path),path)
   assert.equal((await page.reload({waitUntil:'domcontentloaded'})).status(),200)
   await page.waitForURL(origin+expected)
   assert.equal(await page.locator('section.customer-reviews').count(),0)
  }
  assert.deepEqual(reviewRequests,[])
  assert.equal((await fetch(origin+'/not-a-real-route')).status,404)
  await context.close()
 }
 console.log('PASS: three direct URLs and reloads at390/1440; disabled customer redirect, anonymous admin guards, no review requests, unknown route404.')
}finally{
 await browser.close()
 await new Promise(r=>server.close(r))
}
