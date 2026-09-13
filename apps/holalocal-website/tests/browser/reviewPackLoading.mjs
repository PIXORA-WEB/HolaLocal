// Real locale loader, loopback-only traffic: no Firebase/provider requests.
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {chromium} from 'playwright'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {BROWSER_TEST_CORE_ENVIRONMENT} from './browserTestEnvironment.mjs'
import {customerReviewTranslations} from '../../src/i18n/customerReviewTranslations.js'
Object.assign(process.env,BROWSER_TEST_CORE_ENVIRONMENT,{VITE_CUSTOMER_REVIEWS_ENABLED:'false'})
const out=resolve(process.env.HOLALOCAL_TEST_OUTPUT);await mkdir(out,{recursive:true})
const server=await createServer({server:{host:'127.0.0.1',port:0},mode:'browser-test'});await server.listen()
const origin=`http://127.0.0.1:${server.httpServer.address().port}`
const browser=await chromium.launch({args:['--disable-dev-shm-usage']});const results=[]
async function session(width=390){const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());return {context,page:await context.newPage()}}
async function change(page,code){return page.evaluate(async code=>{const {changeAppLanguage}=await import('/src/i18n/index.js');return changeAppLanguage(code)},code)}
async function current(page){return page.evaluate(async()=>{const {default:i18n}=await import('/src/i18n/index.js');return {language:i18n.resolvedLanguage,copy:i18n.getResourceBundle(i18n.resolvedLanguage,'translation').customerReviews}})}
async function open(page){await page.goto(origin+'/privacy');await page.locator('.legal-content__contents').waitFor()}
try{
 for(const width of [390,1440]){
  const {context,page}=await session(width);const requests=[];page.on('request',r=>requests.push(r.url()));await open(page)
  assert.equal(requests.some(u=>u.includes('/customerReviewTranslations.js')),false)
  assert.deepEqual((await current(page)).copy,customerReviewTranslations.en)
  for(const [code,expected]of Object.entries(customerReviewTranslations)){
   await change(page,code);const actual=await current(page);assert.equal(actual.language,code);assert.deepEqual(actual.copy,expected)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  }
  results.push({width,all17ResourcesEqual:true,noEagerNonEnglishPack:true});await context.close()
 }
 {
  const {context,page}=await session();await open(page)
  let release;const held=new Promise(resolve=>{release=resolve})
  await page.route('**/locales/es.json*',async route=>{await held;await route.continue()})
  await page.evaluate(async()=>{const {changeAppLanguage}=await import('/src/i18n/index.js');window.oldLanguageRequest=changeAppLanguage('es');window.latestLanguageRequest=changeAppLanguage('de')})
  await page.evaluate(()=>window.latestLanguageRequest);release();await page.evaluate(()=>window.oldLanguageRequest)
  assert.equal((await current(page)).language,'de');results.push({staleResponseIgnored:true});await context.close()
 }
 {
  const {context,page}=await session();await open(page)
  await page.route('**/customerReviewTranslations.js*',r=>r.abort())
  assert.equal(await change(page,'es'),'en');assert.deepEqual((await current(page)).copy,customerReviewTranslations.en)
  await page.locator('.legal-content__contents').waitFor()
  await page.unroute('**/customerReviewTranslations.js*');await page.evaluate(()=>localStorage.setItem('holalocal.uiLanguage','es'))
  await page.reload();await page.locator('.legal-content__contents').waitFor();assert.equal((await current(page)).language,'es');assert.deepEqual((await current(page)).copy,customerReviewTranslations.es)
  results.push({failedPackFallsBackToEnglish:true,savedLanguageReloadRecovers:true});await context.close()
 }
 await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2)+'\n')
 console.log('PASS: real locale loader;17languages/two widths, no eager full pack, stale responses ignored, failed chunk fallback and saved-language reload recovery.')
}finally{await browser.close();await server.close()}
