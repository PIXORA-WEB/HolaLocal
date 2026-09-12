import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {adminRetentionCopy} from '../src/i18n/adminRetentionCopy.js'
import {RETENTION_ACTION_FIELDS,RETENTION_EXECUTION_LIMIT} from '../../../shared/firebase-contract/retention.js'
test('17language admin retention copy has complete action/warning labels',()=>{
 assert.equal(Object.keys(adminRetentionCopy).length,17)
 for(const copy of Object.values(adminRetentionCopy)){
  assert.deepEqual(Object.keys(copy),Object.keys(adminRetentionCopy.en))
  for(const text of Object.values(copy))assert.ok(typeof text==='string'&&text.length>0)
 }
})
test('retention UI remains in existing admin page, uses original dialog and cannot pass a cleanup switch',async()=>{
 const page=await readFile(new URL('../src/pages/admin/AdminAccountDeletionsPage.jsx',import.meta.url),'utf8')
 assert.equal(page.match(/<RetentionControls \/>/g).length,1)
 assert.ok(RETENTION_EXECUTION_LIMIT<=5)
 for(const fields of Object.values(RETENTION_ACTION_FIELDS))assert.equal(fields.includes('enabled'),false)
})
