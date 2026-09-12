import test from 'node:test'
import assert from 'node:assert/strict'
import {executeBusinessReportRetention} from '../src/businessReports.js'
import {sweepResolvedBusinessReports} from '../src/index.js'

test('scheduled export fixes identity, hourly schedule, limits and no retry',()=>{
 const e=sweepResolvedBusinessReports.__endpoint
 assert.equal(e.scheduleTrigger.schedule,'every 60 minutes')
 assert.equal(e.scheduleTrigger.timeZone,'Etc/UTC')
 assert.equal(e.scheduleTrigger.retryConfig.retryCount,0)
 assert.equal(e.timeoutSeconds,120);assert.equal(e.availableMemoryMb,256)
 assert.equal(e.maxInstances,1);assert.equal(e.concurrency,1);assert.equal(e.minInstances,0)
 assert.equal(e.serviceAccountEmail,'1097633279895-compute@developer.gserviceaccount.com')
 assert.equal(e.httpsTrigger,undefined)
})
test('scheduled execution stays closed and logs only disabled outcome before database access',async()=>{
 const logs=[],logger={info:(...args)=>logs.push(args),error:()=>assert.fail()}
 assert.deepEqual(await executeBusinessReportRetention({env:{},createDatabase:()=>assert.fail()},logger),{disabled:true})
 assert.deepEqual(logs,[['business-report-retention',{disabled:true,outcome:'disabled'}]])
})
test('whole-run errors are sanitized before SDK logging or Scheduler response',async()=>{
 const logs=[],logger={info:()=>assert.fail(),error:(...args)=>logs.push(args)}
 await assert.rejects(executeBusinessReportRetention({env:{BUSINESS_REPORT_RETENTION_ENABLED:'true'},createDatabase:()=>{throw new Error('private report path and text')}},logger),error=>error.message==='business-report-retention-failed')
 assert.deepEqual(logs,[['business-report-retention',{outcome:'error'}]])
})
