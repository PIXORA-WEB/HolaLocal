import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname,resolve,extname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {build} from 'vite'
import {chromium} from '@playwright/test'
const here=dirname(fileURLToPath(import.meta.url)),website=resolve(here,'../../..')
// Independent approved-base capture provides wording and unrelated-route expectations.
const baseline=JSON.parse(await readFile(process.env.HOLALOCAL_EVENTS_BASE_SNAPSHOT,'utf8'))
const out=await mkdtemp(resolve(tmpdir(),'holalocal-events-metadata-'))
const replacements={'hooks/useAuthentication.js':'export default ()=>({user:null,userProfile:null})'}
if(process.env.HOLALOCAL_EVENTS_BASE_ROOT)for(const path of ['i18n/productLandingEnglishTranslations.js','i18n/locales/productLandingTranslations.js'])replacements[path]=await readFile(resolve(process.env.HOLALOCAL_EVENTS_BASE_ROOT,'src',path),'utf8')
await writeFile(resolve(out,'index.html'),`<html><head><meta name="description" content=""><meta property="og:description" content=""><meta name="twitter:description" content=""></head><body><div id="root"></div><script type="module" src="${resolve(here,'fixture.jsx')}"></script></body></html>`)
await build({root:out,configFile:false,envDir:false,define:{'process.env.NODE_ENV':'"production"'},esbuild:{jsx:'automatic'},plugins:[{name:'synthetic-auth-boundary',enforce:'pre',transform(code,id){for(const [path,text] of Object.entries(replacements))if(id===resolve(website,'src',path))return text}}],build:{outDir:resolve(out,'dist')}})
const browser=await chromium.launch({args:['--disable-dev-shm-usage']}),results=[]
for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),blocked=[],errors=[]
 await context.addInitScript(()=>localStorage.setItem('holalocal.uiLanguage','en'))
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:18475'){blocked.push(url.href);return route.abort()};const path=url.pathname.startsWith('/assets/')?url.pathname:'/index.html';await route.fulfill({body:await readFile(resolve(out,'dist')+path),contentType:extname(path)==='.js'?'text/javascript':extname(path)==='.css'?'text/css':'text/html'})})
 const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message))
 try{
  await page.goto('http://127.0.0.1:18475/events')
  for(const [code,label] of [['en',null],['de','Deutsch'],['uk','Українська']]){
   if(label){await page.locator('.select-field__button').click();await page.getByRole('option',{name:label,exact:false}).click();await page.waitForFunction(c=>document.documentElement.lang===c,code)}
   const original=baseline.resources[code].productLanding
   for(const route of ['events','community','events']){
    await page.getByRole('link',{name:route==='events'?'Events fixture route':'Community fixture route'}).click()
    const expected=route==='events'?original.comingSoon+'. '+original.events.description:original.community.description
    await page.waitForFunction(({expected})=>document.querySelector('meta[name="description"]')?.content===expected,{expected})
    for(const selector of ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]'])assert.equal(await page.locator(selector).getAttribute('content'),expected)
    assert.equal(await page.locator('.product-landing__description').textContent(),expected)
    assert.equal(await page.locator('.product-landing__status-label').textContent(),original.comingSoon)
    assert.equal(await page.locator('h1').textContent(),original[route].title)
   }
  }
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[])
  await page.screenshot({path:resolve(out,`events-${width}.png`),fullPage:true})
  results.push({width,pass:true})
 }catch(error){results.push({width,pass:false,error:error.message,description:await page.locator('meta[name="description"]').getAttribute('content'),blocked,errors})}
 await context.close()
}
await browser.close();await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({out,results},null,2));if(results.some(r=>!r.pass))process.exitCode=1
