import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
// Only Firebase transport is replaced; service, loader, media cache and timeouts are real.
register(`data:text/javascript,${encodeURIComponent(`
import { execFileSync } from 'node:child_process'
export async function load(url, context, next) {
  if (url.endsWith('/firebase/firestoreClient.js')) return {format:'module',shortCircuit:true,source:'export const db = {}'}
  if (url.endsWith('/firebase/functionsClient.js')) return {format:'module',shortCircuit:true,source:
    'export const listPublicBusinessesCallable = (...args) => globalThis.featuredFixture.list(...args); export const getPublicBusinessCallable = (...args) => globalThis.featuredFixture.detail(...args); export const ensureOwnerBusinessCallable = () => {throw Error("unexpected")}; export const getOwnerSubscriptionStatusCallable=ensureOwnerBusinessCallable; export const manageBusinessMediaCallable=ensureOwnerBusinessCallable;'}
  if (url.endsWith('/firebase/storageClient.js')) return {format:'module',shortCircuit:true,source:'export const getCanonicalImageBlob = (...args) => globalThis.featuredFixture.blob(...args)'}
  if (process.env.HOLALOCAL_FEATURED_BASELINE === '1' && ['businessService.js','businessMediaPresentation.js','publicBusinessDirectoryLoader.js'].some(name => url.endsWith('/services/'+name))) {
    const path = 'apps/holalocal-website/src/services/' + new URL(url).pathname.split('/').pop()
    return {format:'module',shortCircuit:true,source:execFileSync('git',['show','09f7f52b35369a305a7a26edec9c5594e73d6cad:'+path],{encoding:'utf8'})}
  }
  return next(url,context)
}
`)}`, import.meta.url)
const { getFeaturedActiveBusinesses, getPublicBusinessById, getActivePublicBusinesses } = await import(process.env.HOLALOCAL_FEATURED_BASELINE === '1' ? '../src/services/businessService.js' : '../src/services/publicBusinessService.js')
const { clearBusinessMediaPresentationCache, resolveBusinessMediaPresentation } = await import('../src/services/businessMediaPresentation.js')
const business = (id) => ({ businessId: id, name: id, profileComplete: true,
  logoStoragePath: `businesses/${id}/logos/logo`, galleryStoragePaths: [0, 1].map(n => `businesses/${id}/photos/${n}`) })
let calls, data
function fixture(values) {
  clearBusinessMediaPresentationCache(); calls = []; data = values
  globalThis.featuredFixture = {
    list: async ({ maxResults }) => { assert.equal(maxResults, 60); return { data: { businesses: data } } },
    detail: async ({ businessId }) => ({data:{business:data.find(b => b?.businessId === businessId)}}),
    blob: async (path, maxBytes) => { calls.push(path); assert.equal(maxBytes, 5*1024*1024); return new Blob(['synthetic']) },
  }
}
// The approved Home consumed the first three featured results.
const home = async () => (await getFeaturedActiveBusinesses(60)).slice(0, 3)
test.afterEach(() => clearBusinessMediaPresentationCache())
test('60 businesses preserve IDs/order while resolving only three logos', async () => {
  fixture(Array.from({length:60}, (_, n) => business(`b${n}`)))
  assert.deepEqual((await home()).map(b=>b.businessId), ['b0','b1','b2'])
  console.log('60-business canonical operations:', calls.length)
  assert.deepEqual(calls, ['b0','b1','b2'].map(id=>`businesses/${id}/logos/logo`))
})
for (const fails of [false, true]) test(`unshown gallery ${fails ? 'failure' : 'delay'} is not a Home dependency`, async () => {
  fixture(Array.from({length:60}, (_, n)=>business(`b${n}`)))
  const original=globalThis.featuredFixture.blob
  let release
  const pending=new Promise(resolve=>{release=resolve})
  globalThis.featuredFixture.blob=async(path, bytes)=>{
    if(path==='businesses/b59/photos/0') { calls.push(path); if(fails) throw Error('synthetic'); await pending; return new Blob(['late']) }
    return original(path,bytes)
  }
  const request=home()
  try {
    const result=await Promise.race([request,new Promise(resolve=>setTimeout(()=>resolve('blocked'),50))])
    assert.notEqual(result,'blocked')
    assert.equal(calls.some(path=>path.includes('/photos/')),false)
  } finally {release();await request}
})
for(const values of [[],[business('only')],[null,{},business('incomplete'),{...business('bad'),name:''},business('valid')]]) test(`eligibility and malformed entries: ${values.length} entries`,async()=>{
  fixture(values.map(b=>b?.businessId==='incomplete'?{...b,profileComplete:false}:b))
  const expected=data.filter(b=>b?.businessId&&b.name&&b.profileComplete).slice(0,3).map(b=>b.businessId)
  assert.deepEqual((await home()).map(b=>b.businessId),expected)
  assert.equal(calls.length,expected.length)
})
test('failed logo retains legacy/initials fallback and retries',async()=>{
  const legacy='https://firebasestorage.googleapis.com/v0/b/holalocal-491c9.firebasestorage.app/o/businesses%2Flegacy%2Flogos%2Fold.jpg?alt=media&token=123e4567-e89b-12d3-a456-426614174000'
  fixture([{...business('legacy'),logoUrl:legacy},business('initials')])
  const blob=globalThis.featuredFixture.blob
  globalThis.featuredFixture.blob=async()=>{throw Error('unavailable')}
  const result=await home()
  assert.equal(result[0].logoUrl,legacy);assert.equal(result[1].logoUrl,null)
  globalThis.featuredFixture.blob=blob
  assert.match((await home())[1].logoUrl,/^blob:/)
})
test('card then detail resolves full galleries without poisoning the cache',async()=>{
  fixture([business('one')]);const card=(await home())[0]
  assert.equal(calls.length,1)
  const information=await getPublicBusinessById('one')
  assert.equal(information.galleryUrls.length,0);assert.equal(calls.length,1)
  const detail=await resolveBusinessMediaPresentation('one',information)
  assert.equal(detail.galleryUrls.length,2);assert.equal(detail.logoUrl,card.logoUrl);assert.equal(calls.length,3)
  assert.equal((await getActivePublicBusinesses(60))[0].galleryUrls.length,2);assert.equal(calls.length,3)
})
test('detail then card shares live URLs and preserves deferred revocation',async()=>{
  fixture([business('one')]);const revoke=URL.revokeObjectURL, retired=[]
  URL.revokeObjectURL=(url)=>{retired.push(url);revoke(url)}
  try {
    const detail=await resolveBusinessMediaPresentation('one',await getPublicBusinessById('one'));const card=(await home())[0]
    assert.equal(card.logoUrl,detail.logoUrl);assert.equal(calls.length,3);assert.deepEqual(retired,[])
    clearBusinessMediaPresentationCache({deferRevocation:true});await Promise.resolve();assert.deepEqual(retired,[])
    const fresh=(await home())[0];assert.notEqual(fresh.logoUrl,card.logoUrl)
    clearBusinessMediaPresentationCache();await new Promise(resolve=>setTimeout(resolve,0))
    assert.ok(retired.includes(card.logoUrl));assert.ok(retired.includes(fresh.logoUrl));assert.equal(new Set(retired).size,retired.length)
  }finally{URL.revokeObjectURL=revoke}
})
test('callable rejection and retry preserve the Home error contract',async()=>{
  fixture([business('one')]);const list=globalThis.featuredFixture.list
  globalThis.featuredFixture.list=async()=>{throw Error('synthetic-callable')}
  await assert.rejects(home(),/synthetic-callable/)
  globalThis.featuredFixture.list=list;assert.equal((await home()).length,1)
})

test('exact public reads preserve null, not-found and transport error distinctions',async()=>{
  fixture([business('one')])
  assert.equal(await getPublicBusinessById('missing'),null)
  globalThis.featuredFixture.detail=async({businessId})=>{
    assert.equal(businessId,'one')
    throw Object.assign(new Error('synthetic missing'),{code:'functions/not-found'})
  }
  assert.equal(await getPublicBusinessById('one'),null)
  for(const code of ['functions/permission-denied','functions/unavailable']){
    globalThis.featuredFixture.detail=async()=>{throw Object.assign(new Error('synthetic transport'),{code})}
    await assert.rejects(getPublicBusinessById('one'),error=>error.code===code)
  }
})

test('public detail returns filtered information without starting canonical downloads', async () => {
  fixture([{ ...business('one'), description: 'Fresh text', contact: { phone: 'fixture' },
    logoStoragePath: 'businesses/one/logos/logo/a',
    galleryStoragePaths: ['businesses/one/photos/0/a', 'businesses/other/photos/0/a'],
    logoUrl: 'https://untrusted.invalid/logo', galleryUrls: ['https://untrusted.invalid/gallery'],
    profilePhoto: { downloadUrl: 'https://untrusted.invalid/photo' },
  }])
  globalThis.featuredFixture.blob = () => { throw Error('Detail text must not start media') }
  const detail = await getPublicBusinessById('one')
  assert.equal(detail.description, 'Fresh text')
  assert.deepEqual(detail.contact, { phone: 'fixture' })
  assert.equal(detail.logoStoragePath, 'businesses/one/logos/logo/a')
  assert.deepEqual(detail.galleryStoragePaths, ['businesses/one/photos/0/a'])
  assert.equal(detail.logoUrl, null)
  assert.deepEqual(detail.galleryUrls, [])
  assert.equal('profilePhoto' in detail, false)
  assert.equal(calls.length, 0)
})
