import test from 'node:test'
import assert from 'node:assert/strict'
import {formatPickerDate,parsePickerDate,movePickerDate,pickerDays} from '../src/components/common/datePickerDates.js'
for(const locale of ['en','es','fr','de','nl','pt','it','cs','da','fi','hu','no','pl','ro','sk','sv','uk'])test(`date entry round trip ${locale}`,()=>{
 for(const date of ['2026-09-13','2024-02-29','2026-01-01'])assert.equal(parsePickerDate(formatPickerDate(date,locale),locale),date)
 assert.equal(parsePickerDate('2026-02-30',locale),null)
 assert.equal(pickerDays('2026-09-13',locale).length,42)
})
test('UTC day and month navigation preserves civil dates',()=>{
 assert.equal(movePickerDate('2024-01-31',0,1),'2024-02-29')
 assert.equal(movePickerDate('2026-03-29',1),'2026-03-30')
 assert.equal(movePickerDate('2026-01-01',-1),'2025-12-31')
})
