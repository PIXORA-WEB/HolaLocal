import {spawn} from 'node:child_process'
import {buildIsolatedEnv,parseProjectId} from './runIsolatedEmulatorTests.mjs'
// Same credential/project/network fences as the callable suite. Heavy test files run sequentially.
const projectId=parseProjectId()
const env=await buildIsolatedEnv(projectId)
const child=spawn('firebase',['emulators:exec','--config','../firebase.json','--project',projectId,
 '--only','auth,firestore,functions,storage','node --test --test-concurrency=1 tests/customerReview*Emulator.test.mjs'],{stdio:'inherit',env})
child.on('error',()=>{process.exitCode=1})
child.on('exit',(code,signal)=>{process.exitCode=signal?1:code??1})
