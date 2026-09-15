import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname,resolve,extname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {build} from 'vite'
import {chromium} from '@playwright/test'
const here=dirname(fileURLToPath(import.meta.url)),website=resolve(here,'../../..')
const out=await mkdtemp(resolve(tmpdir(),'holalocal-brand-images-'))
const replacements={
 'hooks/useAuthentication.js':'export default ()=>({user:null,userProfile:null,sessionError:null,signOutUser:async()=>{},completeOnboarding:async()=>{throw Error("No submission")}})',
 'hooks/useUnreadMessageCount.js':'export default ()=>0',
 'firebase/auth.js':'export const getAuthenticationErrorMessage=()=>"synthetic error"',
}
if(process.env.HOLALOCAL_BRAND_BASE)replacements['components/common/BrandLockup.jsx']=await readFile(resolve(process.env.HOLALOCAL_BRAND_BASE,'src/components/common/BrandLockup.jsx'),'utf8')
await writeFile(resolve(out,'index.html'),`<html><head><meta name="description" content=""><meta property="og:description" content=""><meta name="twitter:description" content=""></head><body><div id="root"></div><script type="module" src="${resolve(here,'fixture.jsx')}"></script></body></html>`)
await build({root:out,configFile:false,envDir:false,define:{'process.env.NODE_ENV':'"production"'},esbuild:{jsx:'automatic'},plugins:[{name:'synthetic-auth-boundary',enforce:'pre',transform(code,id){for(const [path,text] of Object.entries(replacements))if(id===resolve(website,'src',path))return text}}],build:{outDir:resolve(out,'dist')}})
const browser=await chromium.launch({args:['--disable-dev-shm-usage']}),results=[]
for(const width of [1440,390])for(const density of [1,3])for(const path of ['/','/onboarding','/admin']){
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:density,serviceWorkers:'block'}),requests=[],errors=[]
 await context.addInitScript(()=>localStorage.setItem('holalocal.uiLanguage','en'))
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:18475'){errors.push(u.href);return route.abort()};const file=u.pathname.startsWith('/assets/')?u.pathname:'/index.html';const body=await readFile(resolve(out,'dist')+file);if(/\.(png|webp)$/.test(file))requests.push({file,bytes:body.length});await route.fulfill({body,contentType:extname(file)==='.js'?'text/javascript':extname(file)==='.css'?'text/css':extname(file)==='.webp'?'image/webp':extname(file)==='.png'?'image/png':'text/html'})})
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000)
 try{
  await page.goto('http://127.0.0.1:18475'+path)
  await page.locator('.brand-lockup:visible').first().waitFor()
  await page.waitForFunction(()=>[...document.querySelectorAll('.brand-lockup img')].every(i=>i.complete&&i.naturalWidth))
  const images=await page.locator('.brand-lockup img').evaluateAll(imgs=>imgs.map(i=>{const r=i.getBoundingClientRect();return {src:i.currentSrc.split('/').pop(),natural:[i.naturalWidth,i.naturalHeight],rect:[r.x,r.y,r.width,r.height],alt:i.alt,label:i.parentElement.getAttribute('aria-label'),background:getComputedStyle(i.parentElement).backgroundColor}}))
  assert.deepEqual(errors,[]);assert.ok(images.length)
  for(const im of images){assert.equal(im.alt,'');assert.ok(im.label);assert.deepEqual(im.natural,im.src.includes('icon')?[758,824]:[1813,329])}
  const extension=process.env.HOLALOCAL_BRAND_BASE?'.png':'.webp'
  assert.ok(requests.every(r=>r.file.endsWith(extension)))
  assert.equal(requests.filter(r=>r.file.includes('logo-icon')).length,1)
  assert.equal(requests.filter(r=>r.file.includes('logo-text')).length,path==='/onboarding'?0:1)
  const shot=`${width}-${density}-${path.replaceAll('/','')||'site'}.png`
  await page.screenshot({path:resolve(out,shot),fullPage:true})
  results.push({width,density,path,images,requests,shot,pass:true})
 }catch(error){results.push({width,density,path,pass:false,error:error.message,errors})}
 await context.close()
}
await browser.close();await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({out,results},null,2));if(results.some(r=>!r.pass))process.exitCode=1
