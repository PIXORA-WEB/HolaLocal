// Manual demo fixture entry; never imported by callable exports or website code.
import {isDeepStrictEqual} from 'node:util'
import {pathToFileURL} from 'node:url'
import {assertCallableBoundaryEnvironment} from './runIsolatedEmulatorTests.mjs'
export const projectId='demo-holalocal-functions'
export const businessId='review-demo-business-v1'
export const password='Fictional-review-demo-47!'
export const accounts=Object.freeze([
  {uid:'review-demo-customer-v1',email:'customer@reviews.example.invalid',roles:['customer']},
  {uid:'review-demo-reporter-v1',email:'reporter@reviews.example.invalid',roles:['customer']},
  {uid:'review-demo-admin-v1',email:'admin@reviews.example.invalid',roles:['admin'],admin:true},
])
const markerPath='demoSeeds/customer-reviews-v1'
export function assertSeedEnvironment(env){
  assertCallableBoundaryEnvironment(env)
  if(env.HOLALOCAL_REVIEW_DEMO_SEED!=='1'||env.CUSTOMER_REVIEWS_ENABLED!=='true'
    ||env.FIREBASE_EMULATOR_HUB!=='127.0.0.1:4400')throw new Error('Refusing seed outside explicit protected review demo.')
}
export async function confirmEmulators(env,request=fetch){
  assertSeedEnvironment(env)
  const response=await request('http://127.0.0.1:4400/emulators',{redirect:'error',signal:AbortSignal.timeout(5000)})
  if(!response.ok)throw new Error('Demo emulator hub unavailable.')
  const services=await response.json()
  for(const [service,port] of Object.entries({auth:9099,firestore:8080,functions:5001,storage:9199})){
    if(services[service]?.host!=='127.0.0.1'||services[service]?.port!==port)throw new Error('Unexpected demo emulator endpoint.')
  }
}
export function fixtureDocuments({timestamp,termsVersion,privacyVersion}){
  const profiles=accounts.map(account=>({uid:account.uid,email:account.email,roles:account.roles,
    accountType:'customer',accountStatus:'active',deletionRequestedAt:null,
    firstName:'',lastName:'',displayName:'',displayNameNormalized:'',photoURL:null,profilePhoto:null,
    preferredLocale:'en',city:'',country:'Spain',profileCompleted:false,businessId:null,
    lastActiveAt:timestamp,deletionScheduledFor:null,anonymizedAt:null,
    termsAccepted:true,termsAcceptedAt:timestamp,termsVersion,
    privacyAccepted:true,privacyAcceptedAt:timestamp,privacyVersion,
    createdAt:timestamp,updatedAt:timestamp,onboardingCompleted:true,
    businessProfileRequired:false,businessProfileCompleted:false}))
  const business={ownerId:accounts[2].uid,managerIds:[accounts[2].uid],name:'Fictional Litoral Homeworks',
    description:'A fictional local team offering careful home maintenance and practical household repairs.',
    primaryCategoryId:'handyman',categoryIds:['handyman'],serviceAreas:['malaga'],languages:['en','es'],primaryLanguage:'en',
    location:{locality:'Málaga',region:'Málaga',countryCode:'ES'},status:'active',publishedAt:timestamp,
    contact:{},galleryUrls:[],profileCompleted:true}
  return {profiles,business}
}
// Injected for local tests. No clearing, password resets or review/statistics writes.
export async function seedFixtures({db,auth,documents}){
  const paths=[markerPath,...accounts.map(account=>`users/${account.uid}`),`businesses/${businessId}`]
  const snapshots=await db.getAll(...paths.map(path=>db.doc(path)))
  const existing=[]
  for(const account of accounts){
    try{existing.push(await auth.getUser(account.uid))}catch(error){if(error.code!=='auth/user-not-found')throw error;existing.push(null)}
  }
  for(let index=0;index<accounts.length;index++){
    const user=existing[index],profile=snapshots[index+1].data()
    if(user&&(user.email!==accounts[index].email||Object.keys(user.customClaims??{}).some(key=>!accounts[index].admin||key!=='admin')))throw new Error('Demo account identity mismatch.')
    if(profile&&(profile.uid!==accounts[index].uid||profile.email!==accounts[index].email))throw new Error('Demo profile identity mismatch.')
  }
  if(snapshots.at(-1).exists&&snapshots.at(-1).data().ownerId!==accounts[2].uid)throw new Error('Demo business owner mismatch.')
  const marker={version:1,businessId,accountIds:accounts.map(account=>account.uid)}
  if(snapshots[0].exists){
    if(!isDeepStrictEqual(snapshots[0].data(),marker))throw new Error('Demo seed marker mismatch.')
  }else{
    if(snapshots.slice(1).some(snapshot=>snapshot.exists)||existing.some(Boolean))throw new Error('Fixture IDs already occupied; refusing overwrite.')
    await db.doc(markerPath).create(marker)
  }
  for(let index=0;index<accounts.length;index++){
    const account=accounts[index],user=existing[index]
    if(user&&user.email!==account.email)throw new Error('Demo account identity mismatch.')
    if(!user)await auth.createUser({uid:account.uid,email:account.email,password,emailVerified:true})
    if(account.admin){
      if(user?.customClaims&&Object.keys(user.customClaims).some(key=>key!=='admin'))throw new Error('Unexpected demo admin claims.')
      if(user?.customClaims?.admin!==true)await auth.setCustomUserClaims(account.uid,{admin:true})
    }
    if(!snapshots[index+1].exists)await db.doc(`users/${account.uid}`).create(documents.profiles[index])
  }
  if(!snapshots.at(-1).exists)await db.doc(`businesses/${businessId}`).create(documents.business)
}
async function main(){
  await confirmEmulators(process.env)
  // SDK loaded only after exact project/endpoint checks. No credential discovery.
  const {initializeApp,deleteApp}=await import('firebase-admin/app')
  const {getAuth}=await import('firebase-admin/auth')
  const {getFirestore,Timestamp}=await import('firebase-admin/firestore')
  const {CURRENT_TERMS_VERSION,CURRENT_PRIVACY_VERSION,isPublicBusinessEligible}=await import('@holalocal/firebase-contract')
  const app=initializeApp({projectId}),db=getFirestore(app)
  try{
    const documents=fixtureDocuments({timestamp:Timestamp.now(),termsVersion:CURRENT_TERMS_VERSION,privacyVersion:CURRENT_PRIVACY_VERSION})
    if(!isPublicBusinessEligible(documents.business))throw new Error('Demo business is not eligible under the installed contract.')
    await seedFixtures({db,auth:getAuth(app),documents})
    console.log(`Demo fixtures ready: /services/${businessId}. Existing review progress preserved.`)
  }finally{await db.terminate();await deleteApp(app)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Demo seed failed; website not started. Check demo configuration, fixture collisions and emulator terminal.');process.exitCode=1})
