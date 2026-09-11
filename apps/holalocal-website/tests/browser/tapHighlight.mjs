// Real application, loopback-only browser requests. No production writes.
import {chromium} from 'playwright'
import {createServer} from 'vite'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {BROWSER_TEST_CORE_ENVIRONMENT} from './browserTestEnvironment.mjs'
Object.assign(process.env,BROWSER_TEST_CORE_ENVIRONMENT,{VITE_CUSTOMER_REVIEWS_ENABLED:'false'})
const output=resolve('../../../review-evidence/tap-highlight');await mkdir(output,{recursive:true})
const server=await createServer({mode:'browser-test',server:{host:'127.0.0.1',port:4192,strictPort:true}});await server.listen()
const browser=await chromium.launch({args:['--disable-dev-shm-usage']});const results=[]
try{
 for(const hasTouch of [false,true]){
  const c=await browser.newContext({viewport:{width:390,height:844},hasTouch,isMobile:hasTouch})
  await c.route('**/*',r=>/^http:\/\/127\.0\.0\.1:/.test(r.request().url())?r.continue():r.abort())
  const p=await c.newPage();await p.goto('http://127.0.0.1:4192/events');await p.locator('.mobile-navigation > summary').waitFor()
  const menu=p.locator('.mobile-navigation'),toggle=menu.locator('summary')
  const tap=locator=>hasTouch?locator.tap():locator.click()
  const native=await toggle.evaluate(n=>getComputedStyle(n).webkitTapHighlightColor)
  assert.equal(native==='rgba(0, 0, 0, 0)',hasTouch)
  await tap(toggle);assert.equal(await menu.getAttribute('open'),'')
  const active=menu.locator('a[href="/events"]');assert.equal(await active.getAttribute('aria-current'),'page')
  const selected=await active.evaluate(n=>({background:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color}))
  assert.notEqual(selected.background,'rgba(0, 0, 0, 0)')
  const link=menu.locator('a[href="/services"]');assert.equal(await link.evaluate(n=>getComputedStyle(n).webkitTapHighlightColor==='rgba(0, 0, 0, 0)'),hasTouch)
  await tap(link);await p.waitForURL('**/services');assert.equal(await menu.getAttribute('open'),null)
  await tap(toggle);await p.keyboard.press('Escape');assert.equal(await menu.getAttribute('open'),null)
  await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab')
  const focus=await toggle.evaluate(n=>({visible:n.matches(':focus-visible'),outline:getComputedStyle(n).outlineStyle,width:getComputedStyle(n).outlineWidth}))
  assert.equal(focus.visible,true);assert.equal(focus.outline,'solid');assert.notEqual(focus.width,'0px')
  await p.keyboard.press('Enter');assert.equal(await menu.getAttribute('open'),'')
  await p.screenshot({path:resolve(output,hasTouch?'touch-keyboard-focus.png':'keyboard-focus.png')})
  await p.keyboard.press('Escape')
  // Original base rule applies to every shared semantic control, not page-specific classes.
  const shared=await p.evaluate(()=>{
   const fixture=document.createElement('section');fixture.innerHTML='<button aria-pressed="true">Pressed</button><label>Choice<input type="checkbox" checked></label><input type="text" value="Selectable text"><select><option>Option</option></select><textarea>Selectable text</textarea><div role="button" tabindex="0">Custom action</div><div role="option" aria-selected="true">Selected</div>'
   document.body.append(fixture)
   const controls=[...fixture.querySelectorAll('button,label,input,select,textarea,[role]')].map(n=>({tag:n.tagName,role:n.getAttribute('role'),tap:getComputedStyle(n).webkitTapHighlightColor,selection:getComputedStyle(n).userSelect}))
   const input=fixture.querySelector('input[type=text]');input.focus();input.select();const textSelected=input.selectionEnd-input.selectionStart===input.value.length
   const pressed=fixture.querySelector('button').getAttribute('aria-pressed');const checked=fixture.querySelector('[type=checkbox]').checked;const selected=fixture.querySelector('[role=option]').getAttribute('aria-selected')
   fixture.remove();return {controls,textSelected,pressed,checked,selected}
  })
  assert.equal(shared.textSelected,true);assert.equal(shared.pressed,'true');assert.equal(shared.checked,true);assert.equal(shared.selected,'true')
  for(const control of shared.controls){assert.equal(control.tap==='rgba(0, 0, 0, 0)',hasTouch);assert.notEqual(control.selection,'none')}
  // Public CTA and real form controls share the rule; editing/focus remain native.
  await p.goto('http://127.0.0.1:4192/login');await p.locator('input[type=email]').fill('synthetic@example.invalid');assert.equal(await p.locator('input[type=email]').inputValue(),'synthetic@example.invalid')
  assert.equal(await p.getByRole('button',{name:'Log in',exact:true}).evaluate(n=>getComputedStyle(n).webkitTapHighlightColor==='rgba(0, 0, 0, 0)'),hasTouch)
  results.push({hasTouch,native,selected,focus,shared,navigationAndEscape:true});await c.close()
 }
 await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));console.log('PASS touch/fine-pointer styles, native menu open/close/navigation, active page, keyboard focus/Enter/Escape, shared controls and selectable text.')
}finally{await browser.close();await server.close()}
