import process from 'node:process'
import { Buffer } from 'node:buffer'
import { expect } from '@playwright/test'
import { getStorage } from 'firebase-admin/storage'

// Controlled media-service outcomes exercise UI timing/failure deterministically.
// Auth, profile-detail writes, persisted media reads and reloads use real emulators.
export async function installMediaFeedbackControls(page) {
  await page.addInitScript(() => {
    window.__revokedWhileDisplayed = []
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.revokeObjectURL = (url) => {
      if ([...document.images].some((image) => image.getAttribute('src') === url && image.getClientRects().length)) window.__revokedWhileDisplayed.push(url)
      revoke(url)
    }
  })
  await page.route('**/src/services/userService.js', async (route) => {
    const response = await route.fetch()
    const original = await response.text()
    const body = original.replace(/async function uploadUserProfilePhoto\([\s\S]*?\n\}/, `async function uploadUserProfilePhoto(uid, file, { onCommitted } = {}) {
      await new Promise((resolve, reject) => { window.__finishProfileMedia = (success) => success ? resolve() : reject(Object.assign(new Error('Synthetic media rejection'), {code:'storage/unauthorized'})) })
      await onCommitted?.(file)
      return getUserProfile(uid)
    }`)
    expect(body).not.toBe(original)
    await route.fulfill({ response, body })
  })
  await page.route('**/src/services/businessService.js', async (route) => {
    const response = await route.fetch()
    let body = await response.text()
    body = body.replace(/async function uploadBusinessLogo\([\s\S]*?\n\}/, `async function uploadBusinessLogo(businessId, file, dependencies = {}) {
      await new Promise((resolve,reject) => { window.__finishBusinessLogo = success => success ? resolve() : reject(Object.assign(new Error('Synthetic logo failure'),{code:'storage/unauthorized'})) })
      await dependencies.onCommitted?.(file)
      return getBusinessById(businessId)
    }`)
    body = body.replace(/async function uploadBusinessGalleryImages\([\s\S]*?\n\}/, `async function uploadBusinessGalleryImages(businessId, files, dependencies = {}) {
      await new Promise((resolve,reject) => { window.__finishBusinessGallery = success => success ? resolve() : reject(Object.assign(new Error('Synthetic gallery failure'),{code:'storage/unauthorized'})) })
      for (const file of files) await dependencies.onCommitted?.(file)
      return getBusinessById(businessId)
    }`)
    await route.fulfill({response,body})
  })
}

export async function profileMediaFeedbackJourney({ page, app, database, uid, projectId }) {
  expect(process.env.STORAGE_EMULATOR_HOST).toBe('http://127.0.0.1:19199')
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:19199'
  const bucket = getStorage(app).bucket(`${projectId}.appspot.com`)
  await page.goto('/profile')
  const png = async (color) => Buffer.from(await page.evaluate((color) => {
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=80
    const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,160,80)
    return canvas.toDataURL('image/png').split(',')[1]
  },color),'base64')
  const first=await png('#1468cc'),second=await png('#dd6622')
  const edit=page.locator('.profile-dashboard__card--personal .account-details-header button')
  await edit.click()
  const editor=page.locator('.profile-photo-editor'),input=editor.locator('input[type=file]')
  const file=(buffer,name)=>({name,mimeType:'image/png',buffer})
  await input.setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')})
  await expect(editor.getByRole('status')).not.toContainText('Uploading')
  await page.locator('#edit-city').fill('Unsaved town')
  await input.setInputFiles(file(first,'first.png'))
  await expect(editor.getByRole('status')).toContainText('Uploading')
  await expect(editor.locator('img')).toHaveAttribute('src',/^blob:/)
  await page.screenshot({path:'test-results/onboarding/profile-photo-uploading.png'})
  const savedURL=await editor.locator('img').getAttribute('src')
  await page.waitForFunction(()=>typeof window.__finishProfileMedia==='function')
  const path=`users/${uid}/profile/avatar/a`
  await bucket.file(path).save(first,{metadata:{contentType:'image/png'}})
  await database.doc(`users/${uid}`).update({profilePhoto:{storagePath:path}})
  await page.evaluate(()=>{window.__finishProfileMedia(true);delete window.__finishProfileMedia})
  await expect(editor.getByRole('status')).toContainText('Image saved')
  await expect(page.locator('#edit-city')).toHaveValue('Unsaved town')
  await page.screenshot({path:'test-results/onboarding/profile-photo-saved.png'})
  await input.setInputFiles([])
  await expect(editor.locator('img')).toHaveAttribute('src',savedURL)
  await page.locator('.profile-edit-form').getByRole('button',{name:'Cancel',exact:true}).click()
  await expect(page.locator('.profile-summary img')).toHaveAttribute('src',savedURL)
  await edit.click()
  await expect(page.locator('#edit-city')).toHaveValue('Marbella')
  await input.setInputFiles(file(second,'replacement.png'))
  await expect(editor.getByRole('status')).toContainText('Uploading')
  await expect(editor.locator('img')).not.toHaveAttribute('src',savedURL)
  const failedURL=await editor.locator('img').getAttribute('src')
  await page.waitForFunction(()=>typeof window.__finishProfileMedia==='function')
  await page.evaluate(()=>{window.__finishProfileMedia(false);delete window.__finishProfileMedia})
  await expect(editor.locator('img')).toHaveAttribute('src',savedURL)
  await expect(editor.getByRole('status')).not.toContainText('Image saved')
  expect(await page.evaluate(async(url)=>{try{await fetch(url);return false}catch{return true}},failedURL)).toBe(true)
  await input.setInputFiles(file(second,'replacement.png'))
  await expect(editor.getByRole('status')).toContainText('Uploading')
  await page.waitForFunction(()=>typeof window.__finishProfileMedia==='function')
  const secondPath=`users/${uid}/profile/avatar/b`
  await bucket.file(secondPath).save(second,{metadata:{contentType:'image/png'}})
  await database.doc(`users/${uid}`).update({profilePhoto:{storagePath:secondPath}})
  await page.evaluate(()=>{window.__finishProfileMedia(true);delete window.__finishProfileMedia})
  await expect(editor.getByRole('status')).toContainText('Image saved')
  await page.locator('#edit-city').fill('Synthetic town')
  await page.locator('.profile-edit-form').getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.locator('.profile-edit-dialog[open]')).toHaveCount(0)
  expect((await database.doc(`users/${uid}`).get()).data().profilePhoto.storagePath).toBe(secondPath)
  expect(await page.evaluate(()=>window.__revokedWhileDisplayed)).toEqual([])
  await page.reload()
  await expect(page.locator('.profile-summary img')).toBeVisible()
  await expect.poll(()=>page.locator('.profile-summary img').evaluate((image)=>image.naturalWidth)).toBe(160)
  expect((await database.doc(`users/${uid}`).get()).data().city).toBe('Synthetic town')
}


export async function businessMediaFeedbackJourney({page,app,database,id,projectId,media}) {
  expect(process.env.FIREBASE_STORAGE_EMULATOR_HOST).toBe('127.0.0.1:19199')
  const bucket=getStorage(app).bucket(`${projectId}.appspot.com`)
  const image=Buffer.from(await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=180;c.height=60
    const x=c.getContext('2d');x.fillStyle='#169b72';x.fillRect(0,0,180,60)
    return c.toDataURL('image/png').split(',')[1]
  }),'base64')
  for (const path of media) await bucket.file(path).save(image,{metadata:{contentType:'image/png'}})
  await page.goto('/business/edit')
  const input=page.locator('.business-logo-editor input[type=file]')
  await input.setInputFiles({name:'logo.png',mimeType:'image/png',buffer:image})
  await expect(page.locator('.business-logo-editor img')).toHaveAttribute('src',/^blob:/)
  await expect(page.locator('.business-logo-editor [role=status]')).toContainText('Uploading')
  await page.waitForFunction(()=>typeof window.__finishBusinessLogo==='function')
  const logoPath=`businesses/${id}/logos/logo/a`
  await bucket.file(logoPath).save(image,{metadata:{contentType:'image/png'}})
  await database.doc(`businesses/${id}`).update({logoStoragePath:logoPath})
  await page.evaluate(()=>{window.__finishBusinessLogo(true);delete window.__finishBusinessLogo})
  await expect(page.locator('.business-logo-editor [role=status]')).toContainText('Image saved')
  const savedURL=await page.locator('.business-logo-editor img').getAttribute('src')
  const replacement=Buffer.concat([image,Buffer.from('replacement')])
  await input.setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:replacement})
  await page.waitForFunction(()=>typeof window.__finishBusinessLogo==='function')
  await page.evaluate(()=>{window.__finishBusinessLogo(false);delete window.__finishBusinessLogo})
  await expect(page.locator('.business-logo-editor img')).toHaveAttribute('src',savedURL)
  const gallery=page.locator('.business-gallery-editor input[type=file]')
  await gallery.setInputFiles({name:'gallery.png',mimeType:'image/png',buffer:image})
  await expect(page.locator('.business-gallery-grid figcaption')).toContainText('Uploading')
  await page.waitForFunction(()=>typeof window.__finishBusinessGallery==='function')
  await page.evaluate(()=>{window.__finishBusinessGallery(false);delete window.__finishBusinessGallery})
  await expect(page.locator('.business-gallery-grid figcaption')).toHaveCount(0)
  expect((await database.doc(`businesses/${id}`).get()).data().galleryStoragePaths).toEqual(media)
  await gallery.setInputFiles({name:'gallery.png',mimeType:'image/png',buffer:image})
  await page.waitForFunction(()=>typeof window.__finishBusinessGallery==='function')
  const galleryPath=`businesses/${id}/photos/3/a`
  await bucket.file(galleryPath).save(image,{metadata:{contentType:'image/png'}})
  await database.doc(`businesses/${id}`).update({galleryStoragePaths:[...media,galleryPath]})
  await page.evaluate(()=>{window.__finishBusinessGallery(true);delete window.__finishBusinessGallery})
  await expect(page.locator('.business-gallery-editor > [role=status]')).toContainText('Image saved')
  await expect(page.locator('.business-gallery-grid figcaption')).toHaveCount(0)
  await expect(page.locator('.business-gallery-grid figure')).toHaveCount(4)
  expect(await page.evaluate(()=>window.__revokedWhileDisplayed)).toEqual([])
  await page.reload()
  await expect(page.locator('.business-gallery-grid figure')).toHaveCount(4)
  await expect.poll(()=>page.locator('.business-logo-editor img').evaluate(img=>img.naturalWidth)).toBe(180)
  // Restore the fixture's original gallery for the independent save regression.
  await database.doc(`businesses/${id}`).update({galleryStoragePaths:media})
}
