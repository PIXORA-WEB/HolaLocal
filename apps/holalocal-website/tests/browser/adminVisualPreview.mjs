// Real components, protected emulator only; screenshots never use production accounts.
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const output=resolve(process.env.HOLALOCAL_ADMIN_PREVIEW_EVIDENCE ?? '../../../review-evidence/admin-visual-preview')
await mkdir(output,{recursive:true})
const browser=await chromium.launch({args:['--disable-dev-shm-usage']})
const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true})
await context.route('**/*',r=>/^http:\/\/127\.0\.0\.1:/.test(r.request().url())?r.continue():r.abort())
const page=await context.newPage();page.setDefaultTimeout(30000)
await page.goto('http://127.0.0.1:4175/login')
await page.locator('input[type=email]').fill('admin.browser@example.invalid')
await page.locator('input[type=password]').fill('BrowserSmoke!234')
await page.getByRole('button',{name:'Log in',exact:true}).click()
await page.waitForURL(u=>!u.pathname.includes('/login'))
const results=[]
for(const width of [1440,390]){
 await page.setViewportSize({width,height:900})
 for(const [name,path] of [['overview','/admin'],['businesses','/admin/businesses'],['business-detail','/admin/businesses/browser-smoke-business'],['deletions','/admin/account-deletions'],['reviews-disabled','/admin/customer-reviews']]){
  await page.goto('http://127.0.0.1:4175'+path);await page.waitForTimeout(2000)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow')
  await page.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:true});results.push({name,width,overflow:false})
 }
}
await page.goto('http://127.0.0.1:4175/admin/businesses');await page.waitForTimeout(1500)
const button=page.locator('.admin-status-tabs button').first()
const state=()=>button.evaluate(n=>({tapHighlight:getComputedStyle(n).webkitTapHighlightColor,outline:getComputedStyle(n).outline,background:getComputedStyle(n).backgroundColor,focusVisible:n.matches(':focus-visible')}))
results.push({touchBefore:await state()})
const rect=await button.boundingBox(); const cdp=await context.newCDPSession(page)
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]})
await page.waitForTimeout(100);await page.screenshot({path:resolve(output,'touch-held.png')})
results.push({touchHeld:await state()})
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200)
results.push({touchAfter:await state()});await page.keyboard.press('Tab');results.push({keyboard:await page.evaluate(()=>({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outline,focusVisible:document.activeElement.matches(':focus-visible')}))})
await page.getByRole('button',{name:'Open admin menu'}).click().catch(()=>page.locator('.admin-menu-button').click())
await page.getByRole('dialog').waitFor();await page.screenshot({path:resolve(output,'mobile-menu.png')})
await page.keyboard.press('Escape');assert.equal(await page.locator('.admin-menu-button').evaluate(n=>n===document.activeElement),true)
await writeFile(resolve(output,'checks.json'),JSON.stringify(results,null,2));await browser.close();console.log('Admin layout and touch inspection complete:',output)
