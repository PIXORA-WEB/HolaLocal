import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BUSINESS_INSIGHT_TOKEN_PATTERN } from '@holalocal/firebase-contract'
import {
  createBusinessInsightsTracker,
  profileViewToken,
  secureRandomToken,
} from '../src/services/businessInsightsTracking.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('dashboard uses real insights states and excludes misleading placeholder metrics', async () => {
  const [dashboard, panel] = await Promise.all([
    read('../src/pages/business/BusinessDashboardPage.jsx'),
    read('../src/components/business/BusinessInsightsPanel.jsx'),
  ])
  assert.match(dashboard, /<BusinessInsightsPanel/)
  for (const state of ['loading', 'error', 'unpublished', 'inactive', 'notStarted', 'collectingSince', 'empty']) {
    assert.match(panel, new RegExp(`businessInsights\\.state\\.${state}`))
  }
  assert.doesNotMatch(panel, /saved|reviews|rating|revenue/i)
  assert.match(panel, /setAttempt/)
  assert.match(panel, /state\.data\.days\.map/)
})

test('public profile and deliberate contact controls are instrumented non-blockingly', async () => {
  const [services, detail, tracker, tokenHelper] = await Promise.all([
    read('../src/pages/ServicesPage.jsx'),
    read('../src/components/common/BusinessDetailPanel.jsx'),
    read('../src/services/businessInsightsService.js'),
    read('../src/services/businessInsightsTracking.js'),
  ])
  assert.match(services, /recordPublicProfileView\(selectedBusiness\.businessId\)/)
  assert.match(services, /recordPublicContactAction\(selectedBusiness\.businessId, 'holalocal'\)/)
  for (const action of ['phone', 'email', 'whatsapp', 'website']) {
    assert.match(detail, new RegExp(`onContactAction\\?\\.\\('${action}'\\)`))
  }
  assert.match(tracker, /createBusinessInsightsTracker/)
  assert.match(tokenHelper, /Promise\.resolve\(callable\(payload\)\)\.catch/)
  assert.match(tokenHelper, /sessionStorage/)
  assert.doesNotMatch(tracker, /await recordBusinessInsightCallable/)
})

function cryptoSequence() {
  let value = 0
  return {
    getRandomValues(bytes) {
      value += 1
      bytes.fill(value)
      return bytes
    },
  }
}

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('profile tracking fails closed when secure cryptography is unavailable', () => {
  const calls = []
  const tracker = createBusinessInsightsTracker({ callable: (payload) => calls.push(payload), cryptoApi: null, storage: memoryStorage() })
  assert.doesNotThrow(() => tracker.recordProfileView('biz'))
  assert.equal(calls.length, 0)
})

test('contact tracking fails closed when secure cryptography throws', () => {
  const calls = []
  const cryptoApi = { getRandomValues() { throw new Error('cryptography unavailable') } }
  const tracker = createBusinessInsightsTracker({ callable: (payload) => calls.push(payload), cryptoApi, storage: memoryStorage() })
  assert.doesNotThrow(() => tracker.recordContactAction('biz', 'phone'))
  assert.equal(calls.length, 0)
})

test('session storage read and write failures remain non-blocking', () => {
  const cryptoApi = cryptoSequence()
  const readFailure = { getItem() { throw new Error('read denied') }, setItem() {} }
  const writeFailure = { getItem() { return null }, setItem() { throw new Error('write denied') } }
  assert.doesNotThrow(() => profileViewToken('biz', { cryptoApi, storage: readFailure }))
  assert.doesNotThrow(() => profileViewToken('biz', { cryptoApi, storage: writeFailure }))
  assert.match(profileViewToken('biz', { cryptoApi, storage: readFailure }), BUSINESS_INSIGHT_TOKEN_PATTERN)
  assert.match(profileViewToken('biz', { cryptoApi, storage: writeFailure }), BUSINESS_INSIGHT_TOKEN_PATTERN)
})

test('secure profile tokens are valid and reused for the same business session', () => {
  const storage = memoryStorage()
  const cryptoApi = cryptoSequence()
  const first = profileViewToken('biz', { cryptoApi, storage })
  const second = profileViewToken('biz', { cryptoApi, storage })
  assert.match(first, BUSINESS_INSIGHT_TOKEN_PATTERN)
  assert.equal(second, first)
  assert.match(secureRandomToken(cryptoApi), BUSINESS_INSIGHT_TOKEN_PATTERN)
})

test('normal contact activations generate separate valid tokens', () => {
  const calls = []
  const tracker = createBusinessInsightsTracker({ callable: (payload) => calls.push(payload), cryptoApi: cryptoSequence(), storage: memoryStorage() })
  tracker.recordContactAction('biz', 'website')
  tracker.recordContactAction('biz', 'website')
  assert.equal(calls.length, 2)
  assert.match(calls[0].eventToken, BUSINESS_INSIGHT_TOKEN_PATTERN)
  assert.match(calls[1].eventToken, BUSINESS_INSIGHT_TOKEN_PATTERN)
  assert.notEqual(calls[0].eventToken, calls[1].eventToken)
})
