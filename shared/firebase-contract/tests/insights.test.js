import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUSINESS_CONTACT_ACTIONS,
  BUSINESS_INSIGHTS_DAYS,
  isBusinessContactAction,
  isBusinessInsightEvent,
  recentUtcDateKeys,
  utcDateKey,
} from '../index.js'

test('insight event and contact action allowlists reject unsupported values', () => {
  assert.equal(isBusinessInsightEvent('profile_view'), true)
  assert.equal(isBusinessInsightEvent('review'), false)
  assert.deepEqual(BUSINESS_CONTACT_ACTIONS, ['holalocal', 'phone', 'email', 'whatsapp', 'website'])
  assert.equal(isBusinessContactAction('website'), true)
  assert.equal(isBusinessContactAction('revenue'), false)
})

test('30-day UTC boundaries are inclusive and ordered', () => {
  const dates = recentUtcDateKeys(new Date('2026-03-01T00:01:00Z'))
  assert.equal(dates.length, BUSINESS_INSIGHTS_DAYS)
  assert.equal(dates[0], '2026-01-31')
  assert.equal(dates.at(-1), '2026-03-01')
  assert.equal(utcDateKey('2026-08-01T23:59:59Z'), '2026-08-01')
})
