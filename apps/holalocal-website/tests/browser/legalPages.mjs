// Public legal pages only, using the real app and loopback-only requests.
import {chromium} from 'playwright'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {BROWSER_TEST_CORE_ENVIRONMENT} from './browserTestEnvironment.mjs'
import {analyticsEnglish} from '../../src/i18n/analyticsEnglish.js'
import {analyticsTranslations} from '../../src/i18n/locales/analyticsTranslations.js'
import {legalPageContent} from '../../src/i18n/locales/legalContent.js'
Object.assign(process.env,BROWSER_TEST_CORE_ENVIRONMENT,{VITE_CUSTOMER_REVIEWS_ENABLED:'false'})
const output=resolve(process.env.HOLALOCAL_LEGAL_EVIDENCE??'../../../review-evidence/legal-review-launch/browser')
await mkdir(output,{recursive:true})
const server=await createServer({mode:'browser-test',server:{host:'127.0.0.1',port:4193,strictPort:true}})
await server.listen()
const browser=await chromium.launch({args:['--disable-dev-shm-usage']})
const results=[]
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390})
  await context.route('**/*',route=>/^http:\/\/127\.0\.0\.1:/.test(route.request().url())?route.continue():route.abort())
  const page=await context.newPage()
  await page.goto('http://127.0.0.1:4193/privacy')
  for(const [code,content] of Object.entries(legalPageContent)) {
   await page.evaluate(language=>localStorage.setItem('holalocal.uiLanguage',language),code)
   for(const route of ['privacy','terms']) {
    await page.goto(`http://127.0.0.1:4193/${route}`)
    await page.locator('.legal-content__contents').waitFor()
    await page.waitForFunction(label=>document.querySelector('.placeholder__label')?.textContent===label+' · 1.1',content.revisionNotice)
    const headings=page.locator('.legal-content__sections h2')
    assert.deepEqual(await headings.allTextContents(),content[route].sections.map(s=>s.title),`${code}/${route}`)
    assert.equal(await page.locator('h1').count(),1)
    assert.equal(await page.locator('.legal-content__contents a').count(),await headings.count())
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${code}/${route}/${width} overflow`)
    const link=page.locator('.legal-content__contents a').last()
    await link.focus();await page.keyboard.press('Enter')
    const anchor=content[route].sections.at(-1).key
    await page.waitForURL(`**/${route}#${anchor}`)
    assert.equal(await page.evaluate(()=>document.activeElement?.id),anchor)
    await page.reload();await page.locator(`#${anchor}`).waitFor()
    assert.ok(page.url().endsWith('#'+anchor))
    assert.equal(await page.locator(`a[href="mailto:hello@holalocal.es"]`).count()>0,true)
    if(route==='privacy') {
     assert.equal(await page.locator('a[href="https://www.aepd.es/"]').count(),1)
     const analytics = code === 'en' ? analyticsEnglish : analyticsTranslations[code]
     assert.equal(await page.locator('#optional-analytics').count(),1)
     assert.equal(await page.locator('#optional-analytics h2').textContent(),analytics.title)
     const settings=page.locator('#optional-analytics button')
     await settings.focus();await page.keyboard.press('Enter')
     await page.getByRole('button',{name:analytics.reject,exact:true}).click()
     assert.equal(await page.evaluate(()=>localStorage.getItem('holalocal.analyticsChoice.v1')),'rejected')
     assert.equal(await page.locator('.analytics-choice').count(),0)
    }
    if(code==='en') {await page.goto(`http://127.0.0.1:4193/${route}`);await page.locator('.legal-content__contents').waitFor();await page.screenshot({path:resolve(output,`${route}-${width}.png`),fullPage:true});await page.screenshot({path:resolve(output,`${route}-${width}-top.png`)})}
    results.push({code,route,width,headings:content[route].sections.length,anchorReload:true,keyboardAnchor:true,overflow:false})
   }
  }
  await page.evaluate(()=>localStorage.setItem('holalocal.uiLanguage','en'))
  await page.goto('http://127.0.0.1:4193/register');await page.locator('#register-consent').waitFor()
  for(const field of await page.locator('#register-consent input[type=checkbox]').all())assert.equal(await field.isChecked(),false)
  assert.ok(await page.locator('#register-consent a[href="/privacy"]').count())
  assert.ok(await page.locator('#register-consent a[href="/terms"]').count())
  await context.close()
 }
 await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2))
 console.log(`PASS ${results.length} real legal-page/language/viewport checks; keyboard anchor navigation, reload, email links and unchecked registration acknowledgments.`)
}finally {await browser.close();await server.close()}
