// Actual legal/form/router components; local synthetic state, no Firebase/provider transport.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,isAbsolute} from 'node:path'
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import {chromium} from 'playwright'
const root=resolve(import.meta.dirname,'../..'),out=process.env.HOLALOCAL_TEST_OUTPUT
assert.ok(out&&isAbsolute(out));await mkdir(out,{recursive:true})
const server=await createServer({root,configFile:false,envDir:false,plugins:[react(),{
 name:'review-disclosure-test',resolveId(id){if(id==='/disclosure-fixture.js')return '\0fixture';if(/^(firebase|@firebase)/.test(id))throw new Error('Firebase forbidden')},
 load(id){if(id==='\0fixture')return `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';import i18n from 'i18next';import {initReactI18next} from 'react-i18next';import PrivacyPage from '${root}/src/pages/PrivacyPage.jsx';import {AuthorForm} from '${root}/src/components/reviews/CustomerReviews.jsx';import {legalPageContent} from '${root}/src/i18n/locales/legalContent.js';import {customerReviewTranslations} from '${root}/src/i18n/customerReviewTranslations.js';import '${root}/src/styles/global.css';
await i18n.use(initReactI18next).init({lng:sessionStorage.language||'en',fallbackLng:'en',resources:Object.fromEntries(Object.entries(legalPageContent).map(([code,legal])=>[code,{translation:{legalPages:legal,customerReviews:customerReviewTranslations[code],common:{cancel:'Cancel'}}}]))});window.language=async code=>{sessionStorage.language=code;await i18n.changeLanguage(code)};window.commands=0;
const controller={getSnapshot:()=>({}),subscribe:()=>()=>{},clearSuccessFeedback(){},execute(){window.commands++}};
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Routes,null,React.createElement(Route,{path:'/privacy',element:React.createElement(PrivacyPage)}),React.createElement(Route,{path:'*',element:React.createElement(AuthorForm,{own:null,state:{ready:true},controller,user:{uid:'synthetic',emailVerified:true},profile:{accountStatus:'active',roles:['customer']},businessId:'synthetic-business'})}))));`},
 configureServer(s){s.middlewares.use(async(req,res,next)=>{if(!['/privacy','/disclosure-test'].includes(req.url))return next();res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/disclosure-fixture.js"></script></body></html>'))})}
}],server:{host:'127.0.0.1',port:0}})
await server.listen();const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']}),errors=[]
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort())
  for(const lang of 'en es fr de nl pt pl ro cs sk hu uk it sv da fi no'.split(' ')){
   await page.goto(origin+'disclosure-test');await page.waitForFunction(()=>!!window.language);await page.evaluate(l=>window.language(l),lang)
   await page.locator('button[aria-expanded]').click()
   const notice=page.locator('[id$="-translation-notice"]');await notice.waitFor({state:'visible'});assert.match(await notice.textContent(),/Google Cloud Translation/)
   const described=await page.locator('textarea').getAttribute('aria-describedby');assert.ok(described.includes(await notice.getAttribute('id')))
   assert.equal(await page.locator('input[name=displayName]').inputValue(),'')
   await notice.locator('a').focus();await page.keyboard.press('Enter');await page.waitForURL('**/privacy')
   await page.getByText('europe-west1',{exact:false}).waitFor();assert.equal(await page.locator('section h2').count()>=1,true)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   await page.reload();await page.getByText('europe-west1',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.commands),0)
  }
  await page.screenshot({path:resolve(out,`privacy-${width}.png`),fullPage:true});await context.close()
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'result.json'),JSON.stringify({widths:[390,1440],languages:17,keyboardLink:true,reload:true,provider:'none; synthetic local form state',errors}));console.log('PASS: 17 locales, mobile/desktop, actual privacy/form/router, keyboard link, reload, no provider or submit calls')
}finally{await browser.close();await server.close()}
