import assert from 'node:assert/strict'
import { test } from 'node:test'
import { supportedUILanguages } from '../src/utils/languages.js'
import { registrationHandoffEnglish } from '../src/i18n/registrationHandoffEnglish.js'
import { registrationHandoffTranslations } from '../src/i18n/locales/registrationHandoffTranslations.js'

for (const { code } of supportedUILanguages) {
  test(`registration handoff copy is explicit for ${code}`, () => {
    const pack = code === 'en' ? registrationHandoffEnglish : registrationHandoffTranslations[code]
    assert.ok(pack, `Missing locale ${code}`)
    for (const [section, keys] of Object.entries(registrationHandoffEnglish)) {
      for (const [key, english] of Object.entries(keys)) {
        assert.equal(typeof pack[section]?.[key], 'string')
        assert.ok(pack[section][key].trim())
        if (code !== 'en') assert.notEqual(pack[section][key], english)
      }
    }
    assert.match(pack.verification.neutralDescription, /\{\{email\}\}/)
  })
}
