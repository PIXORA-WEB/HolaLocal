import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildServiceSelectionSearchParams,
  deriveServiceBrowseSelection,
} from '../src/utils/serviceBrowse.js'
import { parseServiceDiscoveryQuery } from '../src/utils/serviceDiscovery.js'

const selectionFor = (queryString) => deriveServiceBrowseSelection(
  parseServiceDiscoveryQuery(queryString),
)

test('canonical service URLs select their central group and service', () => {
  assert.deepEqual(selectionFor('?service=plumber'), {
    groupId: 'home-property', serviceId: 'plumber',
  })
  assert.deepEqual(selectionFor('?service=lawyer'), {
    groupId: 'professional-services', serviceId: 'lawyer',
  })
  assert.deepEqual(selectionFor('?service=dog-walker'), {
    groupId: 'pets', serviceId: 'dog-walker',
  })
})

test('recognized and ambiguous legacy URLs derive only safe browsing state', () => {
  assert.deepEqual(selectionFor('?category=Plumbing'), {
    groupId: 'home-property', serviceId: 'plumber',
  })
  assert.deepEqual(selectionFor('?category=Pet%20Services'), {
    groupId: 'pets', serviceId: '',
  })
  assert.deepEqual(selectionFor('?category=Other'), { groupId: '', serviceId: '' })
})

test('invalid canonical service URLs select no group or service', () => {
  assert.deepEqual(selectionFor('?service=Plumbing'), { groupId: '', serviceId: '' })
})

test('individual service selection writes only canonical service URL state', () => {
  const selected = buildServiceSelectionSearchParams(
    '?category=Plumbing&q=costa&area=Marbella&language=es',
    'electrician',
  )
  assert.equal(selected.get('service'), 'electrician')
  assert.equal(selected.has('category'), false)
  assert.equal(selected.has('group'), false)
  assert.equal(selected.get('q'), 'costa')
  assert.equal(selected.get('area'), 'Marbella')
  assert.equal(selected.get('language'), 'es')
})

test('clearing a service removes service and legacy category without inventing group state', () => {
  const cleared = buildServiceSelectionSearchParams('?service=plumber&category=Cleaning', '')
  assert.equal(cleared.has('service'), false)
  assert.equal(cleared.has('category'), false)
  assert.equal(cleared.has('group'), false)
})
