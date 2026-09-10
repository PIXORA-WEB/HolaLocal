// Manual-only entry. Reuses the existing protected demo environment; never launched by validation.
import {spawn} from 'node:child_process'
import {access} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {confirmEmulators} from '../../../functions/scripts/seedCustomerReviewDemo.mjs'
import {createDemoConfig} from '../../../functions/scripts/customerReviewDemoSetup.mjs'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {buildIsolatedEnv,assertCredentialIsolation} from '../../../functions/scripts/runIsolatedEmulatorTests.mjs'
const website=fileURLToPath(new URL('..',import.meta.url))
const root=resolve(website,'../..')
const seedExisting=process.argv.length===3&&process.argv[2]==='--seed-existing'
const importPath=process.argv.length===4&&process.argv[2]==='--import-demo'?resolve(process.argv[3]):null
const exportPath=process.argv.length===4&&process.argv[2]==='--export-demo'?resolve(process.argv[3]):null
if(process.argv.length>2&&!seedExisting&&!importPath&&!exportPath)throw new Error('Use --seed-existing, --import-demo <export> or --export-demo <new directory>.')
if(exportPath&&existsSync(exportPath))throw new Error('Export destination already exists; refusing overwrite.')
if(importPath)await access(resolve(importPath,'firebase-export-metadata.json'))
assertCredentialIsolation()
const env=await buildIsolatedEnv('demo-holalocal-functions',Object.fromEntries(['PATH','TMPDIR','JAVA_HOME','FIREBASE_EMULATORS_PATH'].filter(key=>process.env[key]).map(key=>[key,process.env[key]])))
Object.assign(env,{HOLALOCAL_REVIEW_DEMO_SEED:'1',FIREBASE_EMULATOR_HUB:'127.0.0.1:4400',VITE_CUSTOMER_REVIEWS_ENABLED:'true',VITE_BROWSER_TEST_RUNNER:'true',VITE_USE_FIREBASE_EMULATORS:'true',
  VITE_FIREBASE_PROJECT_ID:'demo-holalocal-functions',VITE_FIREBASE_API_KEY:'demo-api-key',VITE_FIREBASE_APP_ID:'1:123456789:web:reviewdemo',
  VITE_FIREBASE_AUTH_DOMAIN:'demo-holalocal-functions.firebaseapp.com',VITE_FIREBASE_STORAGE_BUCKET:'demo-holalocal-functions.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID:'123456789',VITE_FIREBASE_MEASUREMENT_ID:'',VITE_FIREBASE_APPCHECK_ENABLED:'false',
  VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099',VITE_FIRESTORE_EMULATOR_URL:'http://127.0.0.1:8080',
  VITE_FUNCTIONS_EMULATOR_URL:'http://127.0.0.1:5001',VITE_STORAGE_EMULATOR_URL:'http://127.0.0.1:9199'})
const firebase=resolve(root,'functions/node_modules/.bin/firebase')
const vite=resolve(website,'node_modules/vite/bin/vite.js')
const seeder=resolve(root,'functions/scripts/seedCustomerReviewDemo.mjs')
await access(firebase);await access(vite);await access(seeder)
const readiness=resolve(root,'functions/scripts/checkCustomerReviewDemoReady.mjs')
await access(readiness)
const configPath=(seedExisting||exportPath)?null:await createDemoConfig(root)
if(configPath)console.log(`Demo emulator configuration: ${configPath}`)
const quote=value=>`'${value.replaceAll("'","'\\''")}'`
if(!seedExisting&&!exportPath)console.log('Manual demo only: http://127.0.0.1:4190/services — seeds fictional demo accounts and business before opening the real app. Ctrl+C stops the demo.')
if(exportPath)await confirmEmulators(env)
const child=exportPath?spawn(firebase,['emulators:export',exportPath,'--config',resolve(root,'firebase.json'),'--project','demo-holalocal-functions','--only','auth,firestore,storage'],{cwd:website,env,stdio:'inherit'}):seedExisting?spawn(process.execPath,[seeder],{cwd:website,env,stdio:'inherit'}):spawn(firebase,['emulators:exec','--config',configPath,'--project','demo-holalocal-functions','--only','auth,firestore,functions,storage',...(importPath?['--import',importPath]:[]),
  `${quote(process.execPath)} ${quote(seeder)} && ${quote(process.execPath)} ${quote(readiness)} && ${quote(process.execPath)} ${quote(vite)} --mode browser-test --host 127.0.0.1 --port 4190 --strictPort`],{cwd:website,env,stdio:'inherit'})
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal))
child.on('error',()=>{process.exitCode=1})
child.on('exit',(code,signal)=>{process.exitCode=signal?1:code??1})
