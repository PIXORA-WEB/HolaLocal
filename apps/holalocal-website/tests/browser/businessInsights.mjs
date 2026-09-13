import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const output=resolve('../../../review-evidence/business-insights')
await mkdir(output,{recursive:true})
const fixture=`
const scenario=new URLSearchParams(location.search).get('scenario')||'historical';
export const business={businessId:'synthetic',verificationStatus:'unverified',subscription:{planId:'early_access'},entitlements:{features:{businessInsights:true}},ownerId:'synthetic',managerIds:['synthetic'],name:'Costa Home & Garden · Synthetic preview',description:'Fixture',primaryCategoryId:'handyman',categoryIds:['handyman'],serviceAreas:['algeciras'],languages:['en'],primaryLanguage:'en',location:{locality:'Algeciras',region:'Cadiz',countryCode:'ES'},status:scenario==='empty'?'draft':scenario==='inactive'?'suspended':'active',publishedAt:'2026-09-01',contact:['multiple','populated'].includes(scenario)?{phone:'123',phoneVisible:true,email:'test@example.invalid',emailVisible:true,website:'https://example.invalid',websiteVisible:true,whatsappNumber:'456',whatsappVisible:true}:{phone:'private',phoneVisible:false}};
business.publicContact=business.status==='active'?(['multiple','populated'].includes(scenario)?business.contact:{}):null;
export async function getOwnerBusinessInsights(id,range){
 if(scenario==='error')throw new Error('fixture');
 const b={holalocal:0,phone:0,email:0,whatsapp:0,website:0};
 if(['historical','inactive','sparse'].includes(scenario)&&!range)Object.assign(b,{holalocal:4,phone:3});
 if(['multiple','populated'].includes(scenario))Object.assign(b,{holalocal:3,email:2,website:1});
 const t={profileViews:scenario==='empty'?0:24,enquiries:scenario==='empty'?0:2,contactActions:Object.values(b).reduce((a,b)=>a+b,0),contactActionBreakdown:b};
 const startDate=range?.startDate||(scenario==='unrecorded'?'2026-08-01':'2026-08-15'),endDate=range?.endDate||(scenario==='unrecorded'?'2026-08-14':'2026-09-13');
 const days=Array.from({length:Math.round((Date.parse(endDate)-Date.parse(startDate))/86400000)+1},(_,i)=>{
  const date=new Date(Date.parse(startDate)+i*86400000).toISOString().slice(0,10),n=Number(date.slice(8));
  const counts=scenario==='populated'?{profileViews:n>=3&&n<9?4:0,enquiries:n>=3&&n<5?1:0,contactActions:n===3?6:0}:date==='2026-09-03'?t:{profileViews:0,enquiries:0,contactActions:0};
  return {date,...counts};
 });
 const selectedRange={...t,...Object.fromEntries(['profileViews','enquiries','contactActions'].map(k=>[k,days.reduce((sum,d)=>sum+d[k],0)]))};
 if(!days.some(d=>d.contactActions>0))selectedRange.contactActionBreakdown={holalocal:0,phone:0,email:0,whatsapp:0,website:0};
 return {selectedRange,allTime:{profileViews:140,enquiries:15,contactActions:90},range:{startDate,endDate},trackingStartedAt:scenario==='empty'?'2026-08-01':'2026-09-03',days};}

`
const authFixture=`const state={user:{uid:'synthetic',emailVerified:true},userProfile:{businessId:'synthetic',roles:['business'],displayName:'Alex · Preview',accountStatus:'active',termsAccepted:true,termsVersion:'1.1',privacyAccepted:true,privacyVersion:'1.1'},refreshUserProfile:async()=>{},signOutUser:async()=>{},updateUserProfile:async()=>{}};export default function useAuthentication(){return state}`
const server=await createServer({server:{host:'127.0.0.1',port:4198,strictPort:true},plugins:[{name:'insights-fixture',enforce:'pre',resolveId(id){if(id.endsWith('useAuthentication.js'))return '\0auth-fixture';if(id.endsWith('useUnreadMessageCount.js'))return '\0unread-fixture';if(id.endsWith('/firebase/auth.js'))return '\0firebase-auth-fixture';if(id.endsWith('businessService.js'))return '\0business-fixture';if(id.endsWith('businessInsightsService.js')||id==='virtual:insights-data')return '\0insights-data';if(id==='virtual:insights-entry')return '\0insights-entry'},load(id){if(id==='\0auth-fixture')return authFixture;if(id==='\0unread-fixture')return 'export default function useUnreadMessageCount(){return 0}';if(id==='\0firebase-auth-fixture')return 'export const getAuthenticationErrorMessage=()=>"Fixture only"';if(id==='\0business-fixture')return `import {business} from 'virtual:insights-data';export const ensureBusinessProfile=async()=>business;export const getOwnerSubscriptionStatus=async()=>business.entitlements;export const submitBusinessForReview=async()=>{throw new Error('No writes allowed')};`;if(id==='\0insights-data')return fixture;if(id==='\0insights-entry')return `import React from 'react';import {createRoot} from 'react-dom/client';import {i18nReady} from '/src/i18n/index.js';import '/src/styles/tokens.css';import '/src/styles/base.css';import '/src/styles/global.css';import Dashboard from '/src/pages/business/BusinessDashboardPage.jsx';import Layout from '/src/components/layout/SiteLayout.jsx';import BusinessLayout from '/src/components/layout/BusinessLayout.jsx';import {BrowserRouter,Routes,Route} from 'react-router-dom';await i18nReady;createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(Layout)},React.createElement(Route,{element:React.createElement(BusinessLayout)},React.createElement(Route,{path:'*',element:React.createElement(Dashboard)}))))));`},configureServer(s){s.middlewares.use('/insights-preview',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/insights-preview','<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local synthetic insights preview</title></head><body><div id="root"></div><script type="module" src="/@id/virtual:insights-entry"></script></body></html>'))})}}]})
await server.listen();console.log('http://127.0.0.1:4198/insights-preview?scenario=historical')
if(process.argv.includes('--serve'))await new Promise(()=>{})
const browser=await chromium.launch({args:['--disable-dev-shm-usage']});const results=[]
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}});let external=0
 await context.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();external++;return r.abort()})
 const page=await context.newPage();page.on('pageerror',e=>console.log('Browser error:',e.message))
 async function selectMetric(panel, metric) {
  const trigger=panel.locator('#business-insights-metric')
  await trigger.focus();await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Home')
  for(let i=0;i<['profileViews','enquiries','contactActions'].indexOf(metric);i++)await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  assert.equal(await trigger.getAttribute('aria-expanded'),'false')
  assert.ok(await trigger.evaluate(e=>e===document.activeElement&&e.matches(':focus-visible')))
 }

 for(const scenario of (process.argv.includes('--calendar-only')?['historical']:['messaging','populated','sparse','historical','inactive','empty','unrecorded','error'])){
  await page.goto('http://127.0.0.1:4198/insights-preview?scenario='+scenario)
  const panel=page.locator('.business-insights');await panel.locator(scenario==='error'?'[role="alert"]':'.business-insights__all-time').waitFor()
  assert.equal(await page.locator('.site-content .business-area__content > .business-dashboard').count(),1)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),scenario)
  if(scenario!=='error'){
   assert.equal(await panel.locator('.business-insights__grid article').count(),3)
   assert.equal(await panel.locator('.business-insights__breakdown dd').count(),{messaging:1,populated:5,sparse:2,historical:2,inactive:2,empty:0,unrecorded:1}[scenario])
   assert.deepEqual(await panel.locator('.business-insights__all-time dd').allTextContents(),['140','15','90'])
   assert.equal(await panel.locator('.business-insights__breakdown dt small').count(),['historical','sparse'].includes(scenario)?1:scenario==='inactive'?2:0)
   assert.equal(await panel.locator('.business-insights__chart').count(),scenario==='empty'?0:1)
   assert.equal(await panel.locator('details[open]').count(),0)
   if(scenario!=='empty')await page.waitForFunction(()=>{const s=document.querySelector('.business-insights__chart');return s&&Math.abs(s.viewBox.baseVal.width-s.getBoundingClientRect().width)<2})
   await panel.getByText('About these numbers',{exact:true}).focus();await page.keyboard.press('Enter')
   assert.ok(await panel.getByText('About these numbers',{exact:true}).evaluate(e=>e.parentElement.open))
   await page.keyboard.press('Enter')
   await panel.getByText('Exact daily values',{exact:true}).focus();await page.keyboard.press('Enter')
   for(const metric of ['profileViews','enquiries','contactActions']){
    await selectMetric(panel,metric)
    assert.equal(await panel.locator('tbody tr').count(),scenario==='unrecorded'?14:30)
    const values=await panel.locator('tbody td').allTextContents()
    const unrecorded=values.filter(v=>v==='Not recorded').length
    assert.equal(unrecorded,scenario==='empty'?0:scenario==='unrecorded'?14:19)
    const recordedValues=values.filter(v=>v!=='Not recorded')
    const bars=await panel.locator('.business-insights__bar').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('height'))))
    if(bars.length) {
     assert.equal(bars.length,recordedValues.length)
     for(let i=0;i<recordedValues.length;i++)assert.equal(bars[i]===0,Number(recordedValues[i])===0)
    }
    assert.equal(await panel.locator('.business-insights__unrecorded').count(),unrecorded)
    const region=panel.getByRole('region',{name:'Exact daily values'})
    await region.focus();await page.keyboard.press('End')
    await page.waitForFunction(()=>{const e=document.querySelector('.business-insights__table');return e.scrollTop+e.clientHeight>=e.scrollHeight-2})
    assert.ok(await panel.locator('tbody tr').last().isVisible())

   }
   await selectMetric(panel,'profileViews');await panel.getByText('Exact daily values',{exact:true}).click()
   if(scenario==='historical') {
    await panel.locator('#business-insights-range').click();await page.getByRole('option',{name:'Custom dates',exact:true}).click()
    const from=panel.locator('.date-picker').first(), trigger=from.getByRole('button',{name:'From: Choose date'})
    await trigger.click();const calendar=page.getByRole('dialog',{name:'From: Choose date'})
    await calendar.waitFor();await page.waitForTimeout(100)
    const calendarBox=await calendar.boundingBox();assert.ok(calendarBox.x>=0&&calendarBox.x+calendarBox.width<=width)
    await page.screenshot({path:resolve(output,`calendar-open-${width}.png`),fullPage:false})
    await page.keyboard.press('ArrowRight');assert.equal(await page.locator(':focus').getAttribute('data-date'),'2026-08-16')
    await page.keyboard.press('PageUp');assert.equal(await page.locator(':focus').getAttribute('data-date'),'2026-07-16')
    await page.keyboard.press('Shift+PageDown');assert.equal(await page.locator(':focus').getAttribute('data-date'),'2027-07-16')
    assert.equal(await page.locator(':focus').getAttribute('aria-disabled'),'true');await page.keyboard.press('Enter');assert.ok(await calendar.isVisible())
    await page.keyboard.press('Escape');assert.ok(await trigger.evaluate(e=>e===document.activeElement))
    await trigger.click();await calendar.getByRole('button',{name:'Previous month'}).click();await calendar.getByRole('button',{name:'Next month'}).click()
    await calendar.getByRole('spinbutton',{name:'Year',exact:true}).fill('2025');await page.keyboard.press('Enter')
    assert.ok((await calendar.getByRole('grid').getAttribute('aria-label')).includes('2025'))
    await page.keyboard.press('Escape')
    await trigger.click();await calendar.locator('[data-date="2026-08-14"]').click()
    assert.equal(await from.locator('input').inputValue(),'08/14/2026')
    assert.deepEqual(await panel.locator('.business-insights__grid strong').allTextContents(),['24','2','7'])
    await panel.locator('.date-picker').last().locator('.date-picker__field button').click()
    const toCalendar=page.getByRole('dialog');assert.equal(await toCalendar.locator('[aria-current="date"]').count(),1)
    assert.ok(await toCalendar.locator('[aria-disabled="true"]').count()>0)
    await page.screenshot({path:resolve(output,`calendar-open-${width}.png`),fullPage:false});await page.keyboard.press('Escape')
    await from.locator('input').fill('2026-02-30');await from.locator('input').blur();assert.ok(await from.getByRole('alert').isVisible())
    await panel.locator('.date-picker__field input').first().fill('2026-09-13');await panel.locator('.date-picker__field input').last().fill('2026-09-07')
    await panel.getByRole('button',{name:'Apply',exact:true}).click();assert.ok(await panel.locator('#business-insights-range-error').isVisible())
    await panel.locator('.date-picker__field input').first().fill('2026-09-07');await panel.locator('.date-picker__field input').last().fill('2026-09-13')
    await panel.getByRole('button',{name:'Apply',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.business-insights__breakdown dd').length===1)
    assert.deepEqual(await panel.locator('.business-insights__grid strong').allTextContents(),['0','0','0'])
    assert.deepEqual(await panel.locator('.business-insights__all-time dd').allTextContents(),['140','15','90'])
    await page.reload();await panel.locator('.business-insights__breakdown dt small').waitFor()
   }
  }
  if(scenario==='populated'){await panel.locator('#business-insights-metric').click();await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));const box=await panel.boundingBox();await page.screenshot({path:resolve(output,`metric-open-${width}.png`),fullPage:true,clip:box});await page.keyboard.press('Escape')}
  await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'})});
  await page.screenshot({path:resolve(output,`dashboard-${scenario}-${width}.png`),fullPage:true});
  const bounds=await panel.boundingBox();await page.screenshot({path:resolve(output,`${scenario}-${width}.png`),fullPage:true,clip:bounds});results.push({width,scenario})
 }
 for(const language of ['en','es','fr','de','it','pt','nl','cs','da','fi','hu','no','pl','ro','sk','sv','uk']){
  await page.evaluate(l=>localStorage.setItem('holalocal.uiLanguage',l),language)
  await page.goto('http://127.0.0.1:4198/insights-preview?scenario=historical');await page.locator('.business-insights__breakdown dt small').waitFor()
  const panel=page.locator('.business-insights')
  for(const metric of ['profileViews','enquiries','contactActions']) {
   await selectMetric(panel,metric)
   await panel.locator('#business-insights-metric').click()
   const menu=panel.locator('#business-insights-metric-menu')
   assert.equal(await menu.getByRole('option').count(),3)
   assert.ok(await menu.evaluate(e=>e.scrollWidth<=e.clientWidth+1),language+' menu width')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),language)
   await page.keyboard.press('Escape')
  }
  const styles=await panel.evaluate(e=>['business-insights-range','business-insights-metric'].map(id=>{const s=getComputedStyle(e.querySelector('#'+id));return ['fontFamily','fontSize','fontWeight','minHeight','padding','borderRadius'].map(k=>s[k])}))
  assert.deepEqual(styles[0],styles[1],language+' authoritative dropdown styling')
  await panel.locator('#business-insights-range').click();await page.keyboard.press('End');await page.keyboard.press('Enter')
  const picker=panel.locator('.date-picker').first()
  await picker.locator('.date-picker__field button').click()
  const dialog=page.getByRole('dialog');await dialog.waitFor();const bounds=await dialog.boundingBox()
  assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,language+' calendar width')
  assert.equal(await dialog.getByRole('gridcell').count(),42)
  assert.ok(!(await dialog.getAttribute('aria-label')).includes('datePicker.'))
  await dialog.locator('.select-field__button').click();assert.equal(await dialog.getByRole('option').count(),12)
  await page.keyboard.press('Escape');await page.keyboard.press('Escape')
  results.push({width,language})
 }
 assert.equal(external,0);await context.close()
}await writeFile(resolve(output,'browser-results.json'),JSON.stringify(results,null,2));console.log(results.length+' checks passed; zero external requests')
}finally{await browser.close();await server.close()}
