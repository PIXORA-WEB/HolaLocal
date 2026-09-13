import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const output=resolve('../../../review-evidence/business-insights')
await mkdir(output,{recursive:true})
const fixture=`
const scenario=new URLSearchParams(location.search).get('scenario')||'historical';
export const business={ownerId:'synthetic',managerIds:['synthetic'],name:'Synthetic',description:'Fixture',primaryCategoryId:'handyman',categoryIds:['handyman'],serviceAreas:['algeciras'],languages:['en'],primaryLanguage:'en',location:{locality:'Algeciras',region:'Cadiz',countryCode:'ES'},status:scenario==='empty'?'draft':scenario==='inactive'?'suspended':'active',publishedAt:'2026-09-01',contact:scenario==='multiple'?{phone:'123',phoneVisible:true,email:'test@example.invalid',emailVisible:true,website:'https://example.invalid',websiteVisible:true,whatsappNumber:'456',whatsappVisible:true}:{phone:'private',phoneVisible:false}};
business.publicContact=business.status==='active'?(scenario==='multiple'?business.contact:{}):null;
export async function getOwnerBusinessInsights(id,range){
 if(scenario==='error')throw new Error('fixture');
 const b={holalocal:0,phone:0,email:0,whatsapp:0,website:0};
 if(['historical','inactive'].includes(scenario)&&!range)Object.assign(b,{holalocal:4,phone:3});
 if(scenario==='multiple')Object.assign(b,{holalocal:3,email:2,website:1});
 const t={profileViews:scenario==='empty'?0:24,enquiries:scenario==='empty'?0:2,contactActions:Object.values(b).reduce((a,b)=>a+b,0),contactActionBreakdown:b};
 const startDate=range?.startDate||'2026-09-01',endDate=range?.endDate||'2026-09-13';
 return {selectedRange:t,allTime:{profileViews:140,enquiries:15,contactActions:90},range:{startDate,endDate},trackingStartedAt:'2026-09-01',days:Array.from({length:13},(_,i)=>({date:'2026-09-'+String(i+1).padStart(2,'0'),...(i===0?t:{profileViews:0,enquiries:0,contactActions:0})}))};}
`
const server=await createServer({server:{host:'127.0.0.1',port:4198,strictPort:true},plugins:[{name:'insights-fixture',enforce:'pre',resolveId(id){if(id.endsWith('businessInsightsService.js')||id==='virtual:insights-data')return '\0insights-data';if(id==='virtual:insights-entry')return '\0insights-entry'},load(id){if(id==='\0insights-data')return fixture;if(id==='\0insights-entry')return `import React from 'react';import {createRoot} from 'react-dom/client';import {i18nReady} from '/src/i18n/index.js';import '/src/styles/tokens.css';import '/src/styles/base.css';import '/src/styles/global.css';import Panel from '/src/components/business/BusinessInsightsPanel.jsx';import {business} from 'virtual:insights-data';await i18nReady;createRoot(document.getElementById('root')).render(React.createElement('main',{className:'business-dashboard'},React.createElement(Panel,{businessId:'synthetic',business,status:business.status})));`},configureServer(s){s.middlewares.use('/insights-preview',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/insights-preview','<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local synthetic insights preview</title></head><body><div id="root"></div><script type="module" src="/@id/virtual:insights-entry"></script></body></html>'))})}}]})
await server.listen();console.log('http://127.0.0.1:4198/insights-preview?scenario=historical')
if(process.argv.includes('--serve'))await new Promise(()=>{})
const browser=await chromium.launch({args:['--disable-dev-shm-usage']});const results=[]
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}});let external=0
 await context.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();external++;return r.abort()})
 const page=await context.newPage()
 for(const scenario of ['messaging','multiple','historical','inactive','empty','error']){
  await page.goto('http://127.0.0.1:4198/insights-preview?scenario='+scenario)
  await page.locator(scenario==='error'?'[role="alert"]':'.business-insights__all-time').waitFor()
  await page.screenshot({path:resolve(output,'debug.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.className,e.getBoundingClientRect().width]))))
  if(scenario!=='error'){
   assert.equal(await page.locator('.business-insights__grid article').count(),2)
   assert.equal(await page.locator('.business-insights__breakdown dd').count(),{messaging:1,multiple:5,historical:2,inactive:2,empty:0}[scenario])
   assert.deepEqual(await page.locator('.business-insights__all-time dd').allTextContents(),['140','15','90'])
   assert.equal(await page.locator('.business-insights__breakdown dt small').count(),scenario==='historical'?1:scenario==='inactive'?2:0)
   if(scenario==='historical'){
    await page.locator('#business-insights-range').focus();assert.ok(await page.locator('#business-insights-range').evaluate(e=>e.matches(':focus-visible')))
    await page.keyboard.press('Enter');await page.getByRole('option',{name:'Last 7 days',exact:true}).click()
    await page.waitForFunction(()=>document.querySelectorAll('.business-insights__breakdown dd').length===1)
    assert.equal(await page.locator('.business-insights__all-time dd').last().textContent(),'90')
    await page.reload();await page.locator('.business-insights__breakdown dt small').waitFor()
   }
  }
  await page.screenshot({path:resolve(output,`${scenario}-${width}.png`),fullPage:true});results.push({width,scenario})
 }
 for(const language of ['en','es','fr','de','it','pt','nl','cs','da','fi','hu','no','pl','ro','sk','sv','uk']){
  await page.evaluate(l=>localStorage.setItem('holalocal.uiLanguage',l),language)
  await page.goto('http://127.0.0.1:4198/insights-preview?scenario=historical');await page.locator('.business-insights__breakdown dt small').waitFor()
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),language)
  assert.ok(!(await page.locator('.business-insights').textContent()).includes('server-counted'));results.push({width,language})
 }
 assert.equal(external,0);await context.close()
}await writeFile(resolve(output,'browser-results.json'),JSON.stringify(results,null,2));console.log(results.length+' checks passed; zero external requests')
}finally{await browser.close();await server.close()}
