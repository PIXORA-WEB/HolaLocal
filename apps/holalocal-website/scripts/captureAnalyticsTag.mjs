// Read-only public-tag capture. No credentials, collection request or settings write.
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
const id='G-FKFR4SFML9'
const url=`https://www.googletagmanager.com/gtag/js?id=${id}`
const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(25000)})
if(!response.ok)throw new Error(`Public tag HTTP ${response.status}`)
const source=await response.text()
if(Buffer.byteLength(source)>2000000)throw new Error('Unexpected tag size')
const marker='var data = '
const start=source.indexOf(marker)+marker.length
if(start<marker.length)throw new Error('Unknown Google tag format; inspect manually')
let depth=0,string=false,escape=false,end
for(let i=start;i<source.length;i++){
 const char=source[i]
 if(string){if(escape)escape=false;else if(char==='\\')escape=true;else if(char==='"')string=false;continue}
 if(char==='"')string=true
 else if(char==='{')depth++
 else if(char==='}'&&--depth===0){end=i+1;break}
}
const data=JSON.parse(source.slice(start,end))
const tags=data.resource?.tags
if(!Array.isArray(tags))throw new Error('Unknown tag resource format')
const settings=tags.filter(t=>['__ogt_auto_events','__ogt_1p_data_v2','__ccd_ga_regscope'].includes(t.function))
const auto=tags.filter(t=>t.function==='__ogt_auto_events')
const provided=tags.filter(t=>t.function==='__ogt_1p_data_v2')
const unsafeAuto=auto.some(t=>Object.entries(t).some(([key,value])=>key.startsWith('vtp_enable')&&value===true))
const unsafeProvided=provided.some(t=>t.vtp_isEnabled===true||t.vtp_isAutoEnabled===true||t.vtp_isManualEnabled===true)
const sha256=createHash('sha256').update(source).digest('hex')
const record={url,status:response.status,bytes:Buffer.byteLength(source),sha256,retrievedAt:new Date().toISOString(),measurementRequestsSent:0,unsafeAuto,unsafeProvided}
const output=resolve('../../../review-evidence/analytics-consent/real-tag')
await mkdir(output,{recursive:true})
await writeFile(resolve(output,`google-tag-${sha256}.js`),source)
await writeFile(resolve(output,`settings-${sha256}.json`),JSON.stringify(settings,null,2))
await writeFile(resolve(output,'google-tag.js'),source)
await writeFile(resolve(output,'tag-source.json'),JSON.stringify(record,null,2))
await writeFile(resolve(output,'public-tag-settings.json'),JSON.stringify(settings,null,2))
console.log(JSON.stringify(record))
if(process.argv.includes('--require-safe-settings')&&(unsafeAuto||unsafeProvided))throw new Error('Automatic detection remains enabled: console correction/readback required. Do not activate.')
