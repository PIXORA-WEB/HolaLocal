import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { Timestamp } from 'firebase/firestore'
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore'
register('./helpers/preferenceContractLoader.mjs', import.meta.url)
const { toWebsiteUserProfile, toPublicBusinessView } = await import('../src/services/firebaseCompatibility.js')
const { toMobileUserProfile } = await import('../../holalocal-app/src/services/userCompatibility.js')
const { normalizeMessageTranslationPreference } = await import('../../../shared/firebase-contract/index.js')
for (const [name, project] of [['website', toWebsiteUserProfile], ['mobile', toMobileUserProfile]]) {
  test(`${name}: legacy, missing, explicit false and real SDK cutoff projection`, () => {
    const since = new Timestamp(123, 987654321)
    assert.equal(project('user', {}).messageTranslationEnabled, true)
    assert.equal(project('user', null).messageTranslationEnabled, false)
    const raw = { messageTranslationEnabled: false, messageTranslationEnabledSince: since }
    const view = project('user', raw)
    assert.equal(view.messageTranslationEnabled, false)
    assert.equal(view.messageTranslationEnabledSince, since)
    assert.equal(view.messageTranslationEnabledSince.nanoseconds, 987654321)
    assert.equal(view.compatibility.writeSafe, false)
    assert.equal(raw.messageTranslationEnabled, false)
    assert.equal(normalizeMessageTranslationPreference(raw, { exists: true }).valid, true)
  })
}
test('public business projection never exposes private account preferences', () => {
  const view = toPublicBusinessView('business', {
    name: 'Synthetic business', ownerId: 'user', managerIds: ['user'], status: 'active',
    description: 'Synthetic service', primaryCategoryId: 'cleaning', categoryIds: ['cleaning'],
    serviceAreas: ['marbella'], languages: ['en'], primaryLanguage: 'en',
    location: { locality: 'Marbella', region: 'Malaga', countryCode: 'ES' }, publishedAt: Timestamp.now(),
    messageTranslationEnabled: false, messageTranslationEnabledSince: Timestamp.now(),
  })
  assert.ok(view, 'fixture must actually produce a public projection')
  assert.equal(view.name, 'Synthetic business')
  assert.equal(JSON.stringify(view).includes('messageTranslationEnabled'), false)
})

test('Admin SDK Timestamp is preserved as a cutoff without importing the SDK into the contract', () => {
  const since = new AdminTimestamp(123, 987654321)
  const result = normalizeMessageTranslationPreference({ messageTranslationEnabledSince: since }, { exists: true })
  assert.equal(result.valid, true)
  assert.equal(result.enabledSince, since)
})
