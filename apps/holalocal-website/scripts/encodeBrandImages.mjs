// Reproduce with the existing Playwright Chromium (validated with 151.0.7922.34).
// Run from the website: node scripts/encodeBrandImages.mjs
// Full master dimensions, WebP quality 1, unchanged alpha; masters are never written.
// Encoder output may differ across Chromium versions: inspect/review regenerated assets.
import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const browser=await chromium.launch({args:['--disable-dev-shm-usage']})
try {
 const context=await browser.newContext({serviceWorkers:'block'})
 await context.route('**/*',route=>route.abort())
 const page=await context.newPage()
 const validated=[]
 for(const name of ['icon','text']){
  const path=new URL(`../src/assets/logos/logo-${name}`,import.meta.url)
  const master=await readFile(new URL(path.href+'.png'))
  const encoded=await page.evaluate(async data=>{
   const image=new Image();image.src=data;await image.decode()
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
   canvas.getContext('2d').drawImage(image,0,0)
   return canvas.toDataURL('image/webp',1)
  },'data:image/png;base64,'+master.toString('base64'))
  if(!/^data:image\/webp;base64,[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
   throw Error(`${name}: WebP encoder returned an invalid data URL`)
  }
  const bytes=Buffer.from(encoded.split(',')[1],'base64')
  if(bytes.length===0)throw Error(`${name}: empty WebP output`)
  if(bytes.length<12 || bytes.toString('ascii',0,4)!=='RIFF'
    || bytes.toString('ascii',8,12)!=='WEBP' || bytes.readUInt32LE(4)!==bytes.length-8) {
   throw Error(`${name}: invalid WebP container`)
  }
  // Decode the exact bytes to be written, using the same canvas path for both
  // images. Compare alpha only: quality=1 WebP is intentionally not RGB-lossless.
  await page.evaluate(async({source,output,name})=>{
   async function decode(data,label){
    const image=new Image();image.src=data
    try {await image.decode()} catch {throw Error(`${name}: ${label} image decode failed`)}
    const canvas=document.createElement('canvas')
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
    if(!canvas.width || !canvas.height)throw Error(`${name}: ${label} has empty dimensions`)
    const context=canvas.getContext('2d')
    context.drawImage(image,0,0)
    return {width:canvas.width,height:canvas.height,pixels:context.getImageData(0,0,canvas.width,canvas.height).data}
   }
   const master=await decode(source,'master'),derivative=await decode(output,'WebP')
   if(master.width!==derivative.width || master.height!==derivative.height) {
    throw Error(`${name}: WebP dimensions differ from master`)
   }
   for(let i=3;i<master.pixels.length;i+=4){
    if(master.pixels[i]!==derivative.pixels[i])throw Error(`${name}: WebP alpha differs at pixel ${(i-3)/4}`)
   }
  },{source:'data:image/png;base64,'+master.toString('base64'),output:'data:image/webp;base64,'+bytes.toString('base64'),name})
  validated.push({output:new URL(path.href+'.webp'),bytes,name})
  console.log('Validated',name,bytes.length)
 }
 // No output is replaced until the complete pair passes validation.
 for(const {output,bytes,name} of validated){
  await writeFile(output,bytes)
  console.log('Wrote',name,bytes.length)
 }
 console.log('Chromium',browser.version())
} finally {await browser.close()}
