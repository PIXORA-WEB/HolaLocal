import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMessageTranslationPreference, adaptUserDocument, USER_CONTRACT } from '../index.js'

class TimestampFixture {
  constructor(seconds = 123, nanoseconds = 456789123) { this.seconds = seconds; this.nanoseconds = nanoseconds }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1e6 }
  toDate() { return new Date(this.toMillis()) }
}
const normalize = profile => normalizeMessageTranslationPreference(profile, { exists: true })
for (const [name, profile, enabled] of [
  ['legacy absent', {}, true], ['true', { messageTranslationEnabled: true }, true],
  ['false', { messageTranslationEnabled: false }, false],
  ...['false', 0, 1, null, undefined].map(value => [`invalid ${String(value)}`, { messageTranslationEnabled: value }, false]),
]) test(name, () => assert.equal(normalize(profile).enabled, enabled))

test('existence must be explicitly established; missing reads never enable translation', () => {
  for (const profile of [undefined, null, [], 'bad']) {
    assert.deepEqual(normalize(profile), { exists: false, valid: false, enabled: false, enabledSince: undefined })
    assert.equal(adaptUserDocument('user', profile).profile.messageTranslationEnabled, false)
  }
  assert.equal(normalizeMessageTranslationPreference({}).enabled, false)
  assert.equal(normalizeMessageTranslationPreference({}, { exists: false }).enabled, false)
  assert.equal(normalize({}).exists, true)
  assert.equal(normalize({}).enabled, true)
})
test('valid cutoff is preserved by identity and nanosecond precision without manufacture', () => {
  const stamp = new TimestampFixture()
  const raw = { messageTranslationEnabled: false, messageTranslationEnabledSince: stamp }
  assert.equal(normalize(raw).enabledSince, stamp)
  assert.equal(adaptUserDocument('user', raw).profile.messageTranslationEnabledSince, stamp)
  assert.equal(adaptUserDocument('user', raw).profile.messageTranslationEnabled, false)
  assert.equal(normalize({}).enabledSince, undefined)
})
test('malformed cutoffs fail closed instead of becoming unrestricted legacy profiles', () => {
  for (const value of [null, undefined, 123, 'date', new Date(), {}, { seconds: 123, nanoseconds: 0 },
    new TimestampFixture(1, -1), new TimestampFixture(1, 1e9), new TimestampFixture(253402300800),
    { seconds: 1, nanoseconds: 0, toDate() {}, toMillis() { throw new Error('malformed') } }]) {
    const result = normalize({ messageTranslationEnabled: true, messageTranslationEnabledSince: value })
    assert.equal(result.valid, false)
    assert.equal(result.enabled, false)
    assert.equal(result.enabledSince, undefined)
  }
})
test('contract declares only optional private preference/cutoff; no consent classification', () => {
  for (const key of ['messageTranslationEnabled', 'messageTranslationEnabledSince']) {
    assert.equal(USER_CONTRACT.fields[key].requirement, 'optional')
    assert.equal(USER_CONTRACT.fields[key].visibility, 'private_internal')
  }
})
