// Actual dashboard and production locale composition; synthetic service boundaries.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { chromium } from '@playwright/test'
const here = dirname(fileURLToPath(import.meta.url)), website = resolve(here, '../../..')
const out = await mkdtemp(resolve(tmpdir(), 'holalocal-insights-panel-'))
const replacements = { 'services/businessInsightsService.js': `export const getOwnerBusinessInsights=(...args)=>{window.insights.calls.push(args);return new Promise((resolve,reject)=>window.insights.pending.push({resolve,reject}))};` };
await writeFile(resolve(out, 'index.html'), `<div id="root"></div><script type="module" src="${resolve(here, 'fixture.jsx')}"></script>`)
await build({ root: out, configFile: false, envDir: false, define: { 'process.env.NODE_ENV': '"production"' }, esbuild: { jsx: 'automatic' }, plugins: [{ name: 'synthetic-registration-boundary', enforce: 'pre', transform(code, id) { for (const [path, text] of Object.entries(replacements)) if (id === resolve(website, 'src', path)) return text } }], build: { outDir: resolve(out, 'dist') } })
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] }), results = [], blocked = []
async function scenario(width, name, run) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:18471') { blocked.push(url.href); return route.abort() }
    const path = url.pathname.startsWith('/assets/') ? url.pathname : '/index.html'
    await route.fulfill({ body: await readFile(resolve(out, 'dist') + path), contentType: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html' })
  })
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(5000)
  page.on('pageerror', e => errors.push(e.message))
  try {
    await page.goto('http://127.0.0.1:18471/?locale='+name)
    await page.locator('#business-insights-title').waitFor()
    await run(page)
    assert.deepEqual(errors, [])
    results.push({ width, name, pass: true })
  } catch (error) { results.push({ width, name, pass: false, error: error.message, focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) }) }
  await context.close()
}

async function expected(p,key) { return p.evaluate(key=>window.insights.t(key),key) }
async function text(p,key) { await p.getByText(await expected(p,key),{exact:true}).first().waitFor() }
async function geometry(p) {
 const value=await p.locator('.business-insights').evaluate(el=>{
  const b=el.getBoundingClientRect();return {width:b.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,
   labels:[...el.querySelectorAll('h2,h3,.business-insights__notice,.business-insights__range-error')].map(n=>({text:n.textContent,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}))}
 });
 assert.ok(value.pageWidth<=value.viewport+1,JSON.stringify(value));
 assert.ok(value.scrollWidth<=value.clientWidth+1,JSON.stringify(value));
 for(const label of value.labels)assert.ok(label.scrollWidth<=label.clientWidth+1,JSON.stringify(label));
 results.push({measurement:value});
}
for(const width of [1440,390]) for(const locale of ['de','fi','uk','no']) await scenario(width,locale,async p=>{
 await text(p,'state.loading');assert.equal(await p.locator('#business-insights-range').isDisabled(),true);
 await p.evaluate(()=>window.insights.reject());await text(p,'state.error');
 await p.locator('.business-insights__state button').click();await text(p,'state.loading');
 await p.evaluate(()=>window.insights.resolve());await text(p,'state.notStarted');await text(p,'emptyMetric');await geometry(p);
 await p.locator('#business-insights-range').click();
 for(const preset of ['last_7_days','last_30_days','this_month','last_month','last_90_days','custom'])await p.getByRole('option',{name:await expected(p,'range.presets.'+preset),exact:true}).waitFor();
 await p.getByRole('option',{name:await expected(p,'range.presets.last_7_days'),exact:true}).click();await text(p,'state.loadingRange');
 assert.equal(await p.locator('#insights-all-time-title').count(),1);
 await p.evaluate(()=>window.insights.resolve(true));await p.getByText(await p.evaluate(()=>window.insights.collecting()),{exact:true}).waitFor();
 for(const [status,key] of [['draft','unpublished'],['suspended','inactive']]){await p.evaluate(s=>window.insights.setStatus(s),status);await text(p,'state.'+key);await geometry(p)}
 await p.locator('#business-insights-range').click();await p.getByRole('option',{name:await expected(p,'range.presets.custom'),exact:true}).click();
 const dates=p.locator('.business-insights__custom-range input[type="text"]');
 await dates.first().fill('');await p.locator('.business-insights__custom-range button[type="submit"]').click();await text(p,'range.errors.required');
 assert.equal(await dates.first().getAttribute('aria-invalid'),'true');await geometry(p);
 await dates.first().fill(await p.evaluate(()=>window.insights.date('2026-01-02')));await dates.nth(1).fill(await p.evaluate(()=>window.insights.date('2026-01-01')));
 await p.locator('.business-insights__custom-range button[type="submit"]').click();await text(p,'range.errors.order');
 await dates.first().fill(await p.evaluate(()=>window.insights.date('2026-01-01')));await dates.nth(1).fill(await p.evaluate(()=>window.insights.date('2026-01-02')));
 await p.locator('.business-insights__custom-range button[type="submit"]').click();await text(p,'state.loadingRange');await p.evaluate(()=>window.insights.resolve(true));
 assert.equal(await p.locator('#business-insights-range-error').count(),0);
 await p.evaluate(()=>window.insights.switchLanguage('es'));await text(p,'title');await text(p,'range.apply');await text(p,'state.inactive');
 await p.getByText(await p.evaluate(()=>window.insights.collecting()),{exact:true}).waitFor();await geometry(p);
 assert.equal((await p.locator('.business-insights').textContent()).includes('{{'),false);
 await p.screenshot({path:resolve(out,locale+'-'+width+'.png'),fullPage:true});
});
await browser.close();const cases=results.filter(r=>'pass' in r);
await writeFile(resolve(out,'results.json'),JSON.stringify({results,blocked},null,2));
console.log(JSON.stringify({out,passed:cases.filter(r=>r.pass).length,total:cases.length,blocked,failures:cases.filter(r=>!r.pass)},null,2));
if(cases.some(r=>!r.pass)||blocked.length)process.exitCode=1;
