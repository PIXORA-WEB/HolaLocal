import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
register('data:text/javascript,'+encodeURIComponent(`import {readFile} from 'node:fs/promises';export async function load(url,c,next){if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};return next(url,c)}`))
const root=process.env.HOLALOCAL_WORDING_SOURCE
const url=path=>root?pathToFileURL(root+'/src/'+path):new URL('../src/'+path,import.meta.url)
const {default:i18n,loadLocale}=await import(url('i18n/index.js'))
const {supportedUILanguages}=await import(url('utils/languages.js'))
const {getBusinessProfileCompletion}=await import(url('utils/businessCompletion.js'))
const {hasCompletePublicBusinessProfile}=await import('@holalocal/firebase-contract')
const business={ownerId:'synthetic-owner',managerIds:['synthetic-owner'],name:'Local business',description:'Synthetic profile.',primaryCategoryId:'Cleaning',categoryIds:['Cleaning'],languages:['en'],primaryLanguage:'en',contact:{preferredContactMethod:'holalocal'},location:{locality:'Santa Margarita',region:'cadiz',countryCode:'ES'},serviceAreas:['sotogrande']}
test('optional media changes completion but does not gate publication requirements',()=>{
 const without=getBusinessProfileCompletion(business)
 assert.equal(hasCompletePublicBusinessProfile(business),true)
 assert.equal(without.ready,true)
 assert.equal(without.items.length,8)
 assert.deepEqual(without.remainingItems.map(x=>x.key),['logo','images'])
 assert.equal(without.percentage,75)
 const withMedia={...business,logoStoragePath:'businesses/synthetic/logos/a',galleryStoragePaths:['businesses/synthetic/photos/a']}
 assert.equal(getBusinessProfileCompletion(withMedia).percentage,100)
 assert.equal(hasCompletePublicBusinessProfile(withMedia),true)
 assert.equal(hasCompletePublicBusinessProfile({...withMedia,name:''}),false)
})
for(const {code} of supportedUILanguages)test(`${code}: active completion wording and verification distinction`,async()=>{
 await loadLocale(code)
 const t=i18n.getFixedT(code)
 assert.equal(t('admin.review.readinessEyebrow'),'Profile completeness')
 assert.equal(t('admin.review.requirementsPresent',{complete:6,total:8}),'6 of 8 profile items complete')
 assert.equal(t('admin.review.checklistNote'),'Profile completeness and publication eligibility are separate. Logos and images are optional. The backend performs the authoritative publication eligibility check.')
 assert.equal(t('admin.review.profileCompleteness',{percentage:75}),'Profile completeness: 75%')
 assert.equal(t('admin.review.publishNotVerify'),'Publishing this profile does not mark the business as verified.')
})
