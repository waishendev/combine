import assert from 'node:assert/strict'
import test from 'node:test'

import { branchName, shouldShowBranchColumn } from './branchTable'

test('ALL shows the Branch column while a selected branch hides it', () => {
  assert.equal(shouldShowBranchColumn(null), true)
  assert.equal(shouldShowBranchColumn(12), false)
})

test('branch labels use persisted metadata and distinguish legacy and broken references', () => {
  assert.equal(branchName({ store_location_id: 1, store_location: { name: 'Gentlegurls Nail Salon' } }), 'Gentlegurls Nail Salon')
  assert.equal(branchName({ store_location_id: null, store_location: null }), 'Unassigned')
  assert.equal(branchName({ store_location_id: 99, store_location: null }), 'Unknown Branch')
})
