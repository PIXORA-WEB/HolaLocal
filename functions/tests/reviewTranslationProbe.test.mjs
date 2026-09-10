import test from 'node:test'
import assert from 'node:assert/strict'
import {probePlan,runProbe} from '../scripts/checkReviewTranslationProvider.mjs'
test('probe skips same-language and executes exactly 16 sequential genuine translations',async()=>{
 const plan=probePlan('holalocal-491c9');assert.equal(plan.maximumRequests,16);assert.equal(plan.inputCharacters,1184);assert.ok(!plan.targets.includes('en'))
 let active=0;const calls=[]
 assert.equal(await runProbe({translateText:async input=>{assert.equal(active++,0);calls.push(input);await Promise.resolve();active--;return {translatedText:'synthetic'}}},()=>{}),true)
 assert.equal(calls.length,16);assert.equal(calls.reduce((n,c)=>n+[...c.text].length,0),1184)
 assert.ok(calls.every(c=>c.targetLanguage!==c.sourceLanguageHint))
})
test('probe stops on first failure with no retry',async()=>{
 let calls=0;const output=[]
 assert.equal(await runProbe({translateText:async()=>{calls++;throw new Error('private raw diagnostic')}},v=>output.push(v)),false)
 assert.equal(calls,1);assert.ok(!output.join('').includes('private raw'))
})
