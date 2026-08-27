import test from 'node:test'
import assert from 'node:assert/strict'
import { getHomepageServiceHref } from '../src/utils/homepageServices.js'

test('homepage service links use exact canonical service IDs', () => {
  for (const serviceId of ['plumber', 'cleaner', 'lawyer', 'personal-trainer', 'dog-walker']) {
    assert.equal(getHomepageServiceHref(serviceId), `/services?service=${serviceId}`)
  }
})

test('homepage service links do not create legacy category or group URLs', () => {
  assert.equal(getHomepageServiceHref('Plumbing'), '/services')
  assert.equal(getHomepageServiceHref('pets'), '/services')
  assert.doesNotMatch(getHomepageServiceHref('plumber'), /category=|group=/)
})
