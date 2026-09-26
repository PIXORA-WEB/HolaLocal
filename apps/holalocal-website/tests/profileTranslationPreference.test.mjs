import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from 'playwright'
const web=fileURLToPath(new URL('../',import.meta.url)),src=web+'src/'
const en=JSON.parse(await readFile(src+'i18n/locales/en.json','utf8'))
const packs={en}
for(const lang of 'es fr de nl pt pl ro cs sk hu uk it sv da fi no'.split(' ')) packs[lang]=(await import(`../src/i18n/locales/authenticated/authenticated-${lang}.js`)).default
for(const [lang,pack] of Object.entries(packs))test(`${lang}: complete localized Profile translation copy`,()=>{
 for(const key of ['title','description','privacy']){const text=pack.profile.messageTranslation[key];assert.equal(typeof text,'string');assert(text.length>10);if(lang!=='en')assert.notEqual(text,en.profile.messageTranslation[key])}
 assert(pack.profile.messageTranslation.privacy.includes('Google Cloud Translation'))
})
test('offline Profile and preference interactions, three widths and localized layout',async()=>{
 const entry='virtual:profile-preference';const blocked='()=>{throw Error("Unexpected offline action")}'
 const replacements={
 'hooks/useAuthentication.js':`export default ()=>({user:window.h.user,userProfile:window.h.profile,refreshUserProfile:async()=>{},enableBusinessAccess:${blocked},signOutUser:${blocked},updateUserProfile:${blocked}})`,
 'hooks/useMediaSelectionPreview.js':'export default ()=>({items:[]})',
 'services/userService.js':`export const uploadUserProfilePhoto=${blocked};export const saveMessageTranslationPreference=async(uid,enabled)=>{window.h.calls.push({uid,enabled});await new Promise(resolve=>window.h.resolve=resolve);if(window.h.fail)throw Error('synthetic failure');return {enabled,changed:true}}`,
 'services/accountDeletionService.js':`export const accountDeletionErrorReason=${blocked},requestAccountDeletion=${blocked}`,
 'services/profileMediaPresentation.js':'export const loadProfileMediaPresentation=async()=>null',
 'firebase/auth.js':`export const getAuthenticationErrorMessage=${blocked},reauthenticateUserWithPassword=${blocked}`,
 }
 const result=await build({root:web,configFile:false,envDir:false,logLevel:'silent',esbuild:{jsx:'automatic'},resolve:{alias:{'@holalocal/firebase-contract':fileURLToPath(new URL('../../../shared/firebase-contract/index.js',import.meta.url))}},plugins:[{name:'offline-profile',enforce:'pre',resolveId(id){if(id===entry)return '\0'+entry;if(id==='react-i18next')return '\0translation'},load(id){if(id==='\0translation')return 'export const useTranslation=()=>({t:window.t});';if(id==='\0'+entry)return `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import Profile from ${JSON.stringify(src+'pages/customer/ProfilePage.jsx')};import Preference from ${JSON.stringify(src+'components/common/MessageTranslationPreference.jsx')};import ${JSON.stringify(src+'styles/tokens.css')};import ${JSON.stringify(src+'styles/base.css')};import ${JSON.stringify(src+'styles/global.css')};const root=createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(MemoryRouter,null,window.h.full?React.createElement(Profile,{key:window.h.key}):React.createElement(Preference,{key:window.h.key,uid:window.h.user?.uid,profile:window.h.profile,t:window.t})));window.render();`},transform(code,id){for(const [file,replacement]of Object.entries(replacements))if(id===src+file)return replacement}}],build:{write:false,minify:false,rolldownOptions:{input:entry,output:{inlineDynamicImports:true}}}})
 const script=result.output.find(x=>x.type==='chunk'&&x.isEntry).code
 const css=result.output.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n')
 const browser=await chromium.launch({headless:true});const records=[]
 try{
 const context=await browser.newContext({serviceWorkers:'block'});const unexpected=[]
 await context.route('**/*',async route=>{
 const url=new URL(route.request().url())
 if(url.hostname==='profile.test'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/fixture.css"><script type="module" src="/fixture.js"></script>'})
 if(url.hostname==='profile.test'&&url.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:script})
 if(url.hostname==='profile.test'&&url.pathname==='/fixture.css')return route.fulfill({contentType:'text/css',body:css})
 if(url.hostname==='profile.test'&&url.pathname.startsWith('/fonts/')&&!url.pathname.includes('..'))return route.fulfill({body:await readFile(web+'public'+url.pathname)})
 unexpected.push(url.href);return route.abort()
 })
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(({packs,en})=>{window.packs=packs;window.en=en;window.h={user:{uid:'owner'},profile:{uid:'owner'},key:0,calls:[],lang:'en'};window.t=key=>{const read=o=>key.split('.').reduce((v,k)=>v?.[k],o);return read(window.packs[window.h.lang])??read(window.en)??key}},{packs,en})
 await page.goto('http://profile.test/');const checkbox=page.getByRole('checkbox',{name:en.profile.messageTranslation.title});const save=page.locator('.profile-translation-preference button')
 async function reset(profile,full=false,lang='en'){await page.evaluate(({profile,full,lang})=>{Object.assign(window.h,{profile,full,lang,calls:[],fail:false});window.h.key++;window.render()},{profile,full,lang});await page.waitForTimeout(20)}
 for(const [profile,expected]of [[{uid:'owner'},true],[{uid:'owner',messageTranslationEnabled:true},true],[{uid:'owner',messageTranslationEnabled:false},false],[{uid:'owner',messageTranslationEnabled:'yes'},false],[null,false]]){
 await reset(profile);assert.equal(await checkbox.isChecked(),expected);assert.equal(await checkbox.isDisabled(),profile===null);assert.equal(await save.isDisabled(),profile===null)
 }
 await reset({uid:'owner'});await checkbox.focus();await page.keyboard.press('Space');assert.equal(await checkbox.isChecked(),false)
 await save.click();assert.equal(await save.isDisabled(),true);assert.equal(await checkbox.isDisabled(),true);await page.locator('form').evaluate(form=>form.requestSubmit());assert.equal(await page.evaluate(()=>window.h.calls.length),1)
 assert.equal(await page.getByRole('status').count(),0);await page.evaluate(()=>window.h.resolve());await page.getByRole('status').waitFor();assert.equal(await checkbox.isChecked(),false)
 // Failure retains selected value, shows no success, and allows retry.
 await checkbox.check();await page.evaluate(()=>window.h.fail=true);await save.click();await page.evaluate(()=>window.h.resolve());await page.getByRole('alert').waitFor();assert.equal(await checkbox.isChecked(),true);assert.equal(await page.getByRole('status').count(),0);assert.equal(await save.isEnabled(),true)
 await page.evaluate(()=>window.h.fail=false);await save.click();await page.evaluate(()=>window.h.resolve());await page.getByRole('status').waitFor()
 // Unchanged selection can still save after another session changes authoritative state.
 await save.click();assert.equal(await page.evaluate(()=>window.h.calls.at(-1).enabled),true);await page.evaluate(()=>window.h.resolve());await page.getByRole('status').waitFor()
 // Full actual Profile, incomplete required fields, independent preference form.
 for(const width of [1280,390,320])for(const lang of ['de','es','uk']){
 await page.setViewportSize({width,height:width===1280?900:width===390?844:700})
 await reset({uid:'owner',preferredLocale:lang,firstName:'',lastName:'',city:'',accountType:'customer',roles:['customer']},true,lang)
 const control=page.locator('#message-translation-enabled');await control.scrollIntoViewIfNeeded();await page.keyboard.press('Tab');await control.focus()
 const layout=await page.evaluate(()=>{const el=document.querySelector('.profile-translation-preference__label');const input=el.querySelector('input');return {overflow:document.documentElement.scrollWidth>innerWidth,labelHeight:el.getBoundingClientRect().height,focused:document.activeElement===input,outline:getComputedStyle(input).outlineStyle,text:el.textContent}})
 assert.equal(layout.overflow,false);assert(layout.labelHeight>=44);assert(layout.focused);assert.notEqual(layout.outline,'none');assert(layout.text.includes(packs[lang].profile.messageTranslation.title))
 await control.uncheck();await save.click();assert.equal(await page.evaluate(()=>window.h.calls.length),1);await page.evaluate(()=>window.h.resolve());await page.locator('.profile-translation-preference [role=status]').waitFor()
 records.push({width,lang,...layout,independentSave:true})
 if(process.env.PROFILE_EVIDENCE_DIR)await page.screenshot({path:process.env.PROFILE_EVIDENCE_DIR+`/profile-${width}-${lang}.png`,fullPage:true})
 }
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[])
 if(process.env.PROFILE_EVIDENCE_DIR)await writeFile(process.env.PROFILE_EVIDENCE_DIR+'/browser-results.json',JSON.stringify({records,errors,unexpected,interactions:'PASS'},null,2))
 }finally{await browser.close()}
})
