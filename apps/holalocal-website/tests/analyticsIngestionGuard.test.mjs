import test from 'node:test'
import assert from 'node:assert/strict'
import {validateProbeRequest as check} from '../scripts/analyticsIngestionGuard.mjs'
const url=new URL('https://region1.google-analytics.com/g/collect?tid=G-FKFR4SFML9')
const packet={event:'page_view',phase:'accepted',location:'https://www.holalocal.es/events',referrer:'',hasPrivateMarker:false,noAccountUserId:true,advertisingDisabled:true}
test('ceiling allows eighth and rejects ninth including batched events',()=>{
 assert.doesNotThrow(()=>check(url,[packet],7,false))
 assert.throws(()=>check(url,[packet],8,false));assert.throws(()=>check(url,[packet,packet],7,false))
})
test('stops on failure and rejects unsafe destinations, phases, identity and advertising',()=>{
 assert.throws(()=>check(url,[packet],0,true))
 for(const field of [{phase:'withdrawn'},{event:'click'},{location:'https://www.holalocal.es/profile'},{referrer:'PRIVATE'},{hasPrivateMarker:true},{noAccountUserId:false},{advertisingDisabled:false}])assert.throws(()=>check(url,[{...packet,...field}],0,false))
 for(const target of ['http://region1.google-analytics.com/g/collect?tid=G-FKFR4SFML9','https://evil.example/g/collect?tid=G-FKFR4SFML9','https://region1.google-analytics.com/g/collect?tid=G-OTHER'])assert.throws(()=>check(new URL(target),[packet],0,false))
})
