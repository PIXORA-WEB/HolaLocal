import process from 'node:process'
import {test,expect} from '@playwright/test'
import {initializeApp,deleteApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getFirestore,FieldValue} from 'firebase-admin/firestore'
import {TEST_PROJECT_ID} from './fixtures.js'

const contact={phone:'',phoneVisible:false,email:'',emailVisible:false,whatsappNumber:'',whatsappVisible:false,website:'',websiteVisible:false,preferredContactMethod:'holalocal',allowCallbackRequests:false}

test('business profile save: legacy preservation, service replacement, reload and lifecycle guard',async({page})=>{
  expect(process.env.FIRESTORE_EMULATOR_HOST).toBe('127.0.0.1:18080')
  expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBe('127.0.0.1:19099')
  expect(process.env.GCLOUD_PROJECT).toBe(TEST_PROJECT_ID)
  const app=initializeApp({projectId:TEST_PROJECT_ID},'profile-save-regression')
  const database=getFirestore(app),uid='profile-save-owner',id='profile-save-business'
  const stamp=()=>FieldValue.serverTimestamp()
  const media=[`businesses/${id}/photos/0/a`,`businesses/${id}/photos/1/b`,`businesses/${id}/photos/2/a`]
  try{
    await getAuth(app).createUser({uid,email:'profile-save@example.test',password:'ProfileSave!23456',emailVerified:true})
    await database.doc(`users/${uid}`).set({uid,email:'profile-save@example.test',displayName:'Synthetic owner',displayNameNormalized:'synthetic owner',firstName:'Synthetic',lastName:'Owner',preferredLocale:'en',roles:['customer','business'],accountType:'both',accountStatus:'active',profileCompleted:true,onboardingCompleted:true,businessProfileRequired:false,businessProfileCompleted:true,businessId:id,deletionRequestedAt:null,deletionScheduledFor:null,anonymizedAt:null,photoURL:null,profilePhoto:null,city:'Marbella',country:'Spain',lastActiveAt:stamp(),termsAccepted:true,termsVersion:'1.0',termsAcceptedAt:stamp(),privacyAccepted:true,privacyVersion:'1.0',privacyAcceptedAt:stamp(),createdAt:stamp(),updatedAt:stamp()})
    await database.doc(`businesses/${id}`).set({ownerId:uid,managerIds:[uid],name:'Synthetic save business',nameNormalized:'synthetic save business',slug:'synthetic-save-business',tagline:'Original tagline',description:'An isolated maintenance profile.',primaryCategoryId:'Cleaning',categoryIds:['Handyman'],serviceAreas:['marbella'],serviceRadiusKm:20,location:{locality:'Marbella',region:'Málaga',countryCode:'ES'},contact,languages:['en'],primaryLanguage:'en',profilePhoto:null,galleryImages:[],galleryImageURLs:[],galleryStoragePaths:media,galleryCount:0,ratingAverage:0,ratingCount:0,status:'rejected',verificationStatus:'unverified',verifiedAt:null,subscription:{plan:'early-access'},profileCompleted:false,publishedAt:null,submittedAt:stamp(),deletionRequestedAt:null,deletedAt:null,createdAt:stamp(),updatedAt:stamp()})
    const privateContact={...contact,email:'private@example.test',phone:'+34000000000',whatsappNumber:'+34000000001'}
    await database.doc(`businessPrivate/${id}`).set({ownerId:uid,managerIds:[uid],contact:privateContact,currentRejection:{reason:'Synthetic changes requested'},createdAt:stamp(),updatedAt:stamp()})
    await page.route(/^https:\/\//,route=>route.abort())
    await page.goto('/tests/browser/integration.html')
    await page.evaluate(async()=>{const auth=await import('/src/firebase/auth.js');await auth.loginUser('profile-save@example.test','ProfileSave!23456')})
    await page.goto('/business/edit')
    await expect(page.locator('#business-name')).toHaveValue('Synthetic save business')
    await expect(page.locator('.business-taxonomy-legacy')).toBeVisible()
    await expect(page.locator('#business-email')).toHaveValue('private@example.test')
    await page.locator('#business-tagline').fill('Saved unrelated tagline')
    await page.locator('.business-form__save button').click()
    await expect(page.locator('.business-form__save')).toContainText('Business profile saved successfully.')
    let stored=(await database.doc(`businesses/${id}`).get()).data()
    expect(stored.primaryCategoryId).toBe('Cleaning');expect(stored.categoryIds).toEqual(['Handyman']);expect(stored.galleryStoragePaths).toEqual(media)
    expect(stored.contact.email).toBe('');expect((await database.doc(`businessPrivate/${id}`).get()).data().contact).toEqual(privateContact)
    await page.reload();await expect(page.locator('#business-tagline')).toHaveValue('Saved unrelated tagline')
    await page.locator('#business-main-category').click();await page.getByRole('option',{name:'Handyman',exact:true}).click()
    await page.locator('label').filter({has:page.locator('input[value="painter-decorator"]')}).click();await page.locator('label').filter({has:page.locator('input[value="removals"]')}).click()
    await page.locator('.business-form__save button').click()
    await expect(page.locator('.business-form__save')).toContainText('Business profile saved successfully.')
    await page.reload();await expect(page.locator('.business-taxonomy-legacy')).toHaveCount(0)
    stored=(await database.doc(`businesses/${id}`).get()).data()
    expect(stored.primaryCategoryId).toBe('handyman');expect(stored.categoryIds).toEqual(expect.arrayContaining(['handyman','painter-decorator','removals']));expect(stored.galleryStoragePaths).toEqual(media)
    expect((await database.doc(`businessPrivate/${id}`).get()).data().contact).toEqual(privateContact)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:'test-results/onboarding/profile-save-mobile.png',fullPage:true})
    await page.setViewportSize({width:1440,height:1000})
    await page.locator('#business-tagline').fill('Second canonical save');await page.locator('.business-form__save button').click();await expect(page.locator('.business-form__save')).toContainText('Business profile saved successfully.')
    await page.reload();await expect(page.locator('#business-tagline')).toHaveValue('Second canonical save')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:'test-results/onboarding/profile-save-desktop.png',fullPage:true})
    // A status change while the editor is open must reject the atomic transaction.
    const privateBeforeDenial=(await database.doc(`businessPrivate/${id}`).get()).data()
    await database.doc(`businesses/${id}`).update({status:'pending_review'})
    await page.locator('#business-tagline').fill('Must not persist')
    await page.locator('.business-form__save button').click()
    await expect(page.locator('.business-form__save')).toContainText('This update was not permitted.')
    expect((await database.doc(`businesses/${id}`).get()).data().tagline).toBe('Second canonical save')
    expect((await database.doc(`businessPrivate/${id}`).get()).data().updatedAt.toMillis()).toBe(privateBeforeDenial.updatedAt.toMillis())
    expect((await database.doc(`businessPrivate/${id}`).get()).data().contact).toEqual(privateContact)
    await page.reload();await expect(page.locator('#business-profile-form')).toHaveCount(0)
    await expect(page.getByRole('button',{name:'Save business profile',exact:true})).toHaveCount(0)
  }finally{await deleteApp(app)}
})
