// Local component browser test. Fake translation transport; no Firebase/provider requests.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,isAbsolute} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright'
const root=resolve(import.meta.dirname,'../..'),out=process.env.HOLALOCAL_TEST_OUTPUT
assert.ok(out&&isAbsolute(out),'Set an absolute durable HOLALOCAL_TEST_OUTPUT directory')
await mkdir(out,{recursive:true})
const server=await createServer({root,configFile:false,envDir:false,server:{host:'127.0.0.1',port:0},plugins:[{
 name:'isolated-review-translation-test',resolveId(id){if(id==='/review-translation-fixture.js')return '\0review-translation-fixture';if(/^(firebase|@firebase)/.test(id))throw new Error('Firebase forbidden in this component fixture')},
 load(id){if(id==='\0review-translation-fixture')return `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import i18n from 'i18next';import {initReactI18next} from 'react-i18next';import ReviewText from '${root}/src/components/reviews/ReviewText.jsx';import {customerReviewTranslations as rows} from '${root}/src/i18n/customerReviewTranslations.js';import '${root}/src/styles/global.css';import '${root}/src/styles/customerReviews.css';
 await i18n.use(initReactI18next).init({lng:'es',fallbackLng:'en',resources:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{translation:{customerReviews:v}}]))});
 window.pending=[];window.behavior='success';const answer=p=>({...p,status:'translated',translatedText:'translated-'+p.targetLanguage+'-r'+p.publishedRevision+' <img src=x onerror=alert(1)>'});
 const api={translate:async p=>{if(window.behavior==='fail')throw new Error('private upstream diagnostic');if(window.behavior==='defer')return new Promise(resolve=>window.pending.push({language:p.targetLanguage,revision:p.publishedRevision,resolve:()=>resolve(answer(p))}));return answer(p)}};
 function App(){const [revision,setRevision]=useState(1);window.control={language:l=>i18n.changeLanguage(l),revision:setRevision};return React.createElement('article',null,React.createElement('h3',null,'Unchanged public name'),React.createElement(ReviewText,{api,review:{publicReviewId:'synthetic-public-review',publishedRevision:revision,originalText:'Original synthetic review r'+revision,declaredSourceLanguage:null}}))};createRoot(document.getElementById('root')).render(React.createElement(App));`
 },configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url!=='/translation-test')return next();res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/review-translation-fixture.js"></script></body></html>'))})}
}]})
await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});const results=[]
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort())
  const page=await context.newPage();await page.goto(origin+'/translation-test');await page.waitForFunction(()=>!!window.control)
  for(const language of 'en es fr de it pt nl sv no da fi pl cs sk hu ro uk'.split(' ')){
   await page.evaluate(l=>window.control.language(l),language);await page.waitForFunction(l=>document.querySelector('.customer-reviews__text')?.textContent.startsWith('translated-'+l+'-r1'),language)
   assert.equal(await page.locator('h3').textContent(),'Unchanged public name');assert.equal(await page.locator('img').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   await page.locator('button').click();assert.equal(await page.locator('.customer-reviews__text').textContent(),'Original synthetic review r1');await page.locator('button').focus();await page.keyboard.press('Enter');assert.match(await page.locator('.customer-reviews__text').textContent(),new RegExp('^translated-'+language))
  }
  await page.evaluate(()=>{window.behavior='defer';window.control.language('fr')});await page.waitForFunction(()=>window.pending.length===1)
  assert.equal(await page.locator('.customer-reviews__text').textContent(),'Original synthetic review r1')
  await page.evaluate(()=>window.control.language('es'));await page.waitForFunction(()=>window.pending.length===2)
  await page.evaluate(()=>window.pending.find(p=>p.language==='es').resolve());await page.waitForFunction(()=>document.querySelector('.customer-reviews__text').textContent.startsWith('translated-es'))
  await page.evaluate(()=>window.pending.find(p=>p.language==='fr').resolve());await page.waitForTimeout(30);assert.match(await page.locator('.customer-reviews__text').textContent(),/^translated-es/)
  await page.evaluate(()=>{window.control.revision(2);window.behavior='success'});await page.waitForFunction(()=>document.querySelector('.customer-reviews__text').textContent.startsWith('translated-es-r2'))
  await page.evaluate(()=>{window.behavior='fail';window.control.language('de')});await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Original'))
  assert.equal(await page.locator('.customer-reviews__text').textContent(),'Original synthetic review r2');assert.ok(!(await page.locator('body').textContent()).includes('private upstream'))
  await page.screenshot({path:resolve(out,`failure-${width}.png`),fullPage:true});results.push({width,languages:17,originalToggle:true,keyboard:true,staleLanguageIgnored:true,revisionChanged:true,failureFallback:true,escaped:true});await context.close()
 }
 await writeFile(resolve(out,'results.json'),JSON.stringify({provider:'mocked browser transport, not real provider or Firebase',results},null,2));console.log('PASS17 languages at390/1440, original/keyboard/name preservation, stale response, revision, failure and escaping.')
}finally{await browser.close();await server.close()}
