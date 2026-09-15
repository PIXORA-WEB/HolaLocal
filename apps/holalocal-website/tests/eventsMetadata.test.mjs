import assert from 'node:assert/strict'
import test from 'node:test'
import {register} from 'node:module'
import {pathToFileURL} from 'node:url'
// Node-only JSON import adapter; the production initializer and locale loader run unchanged.
register('data:text/javascript,'+encodeURIComponent(`import {readFile} from 'node:fs/promises';export async function load(url,c,next){if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};return next(url,c)}`))
const root=process.env.HOLALOCAL_EVENTS_SOURCE
const source=path=>root?pathToFileURL(root+'/src/'+path):new URL('../src/'+path,import.meta.url)
const {default:i18n,loadLocale}=await import(source('i18n/index.js'))
const {productLandingTranslations}=await import(source('i18n/locales/productLandingTranslations.js'))
const qualifiers={en:'Coming soon',es:'Próximamente',fr:'Bientôt disponible',de:'Demnächst',nl:'Binnenkort',pt:'Em breve',pl:'Wkrótce',ro:'În curând',cs:'Již brzy',sk:'Už čoskoro',hu:'Hamarosan',uk:'Незабаром',it:'Prossimamente',sv:'Kommer snart',da:'Kommer snart',fi:'Tulossa pian',no:'Kommer snart'}
for(const [code,qualifier] of Object.entries(qualifiers))test(`${code}: Events description qualifies availability in the effective resource`,async()=>{
 await loadLocale(code)
 const description=i18n.getFixedT(code)('productLanding.events.description')
 assert.ok(description.startsWith(qualifier+'. '),`${code}: standalone description must communicate future availability`)
 assert.equal(description,productLandingTranslations[code].productLanding.events.description)
 assert.ok(description.length>qualifier.length+20)
 assert.doesNotMatch(description,/\uFFFD|\{\{/)
})
