import assert from 'node:assert/strict'
import test from 'node:test'

import { branchSelectorOptions } from './branch-selector-options'
import type { StoreLocation } from '../types/storeLocation'

const branch = (id: number, name: string): StoreLocation => ({
  id, name, code: name, is_active: true, is_pickup_available: true,
  is_booking_available: true, is_pos_available: true, sort_order: id,
})

test('header selector reflects multiple accessible branches plus virtual All Branches', () => {
  assert.deepEqual(branchSelectorOptions([branch(1, 'Branch A'), branch(2, 'Branch B')]), [
    { value: 'all', label: 'All Branches' },
    { value: '1', label: 'Branch A' },
    { value: '2', label: 'Branch B' },
  ])
})

test('header selector does not offer All Branches to a single-branch user', () => {
  assert.deepEqual(branchSelectorOptions([branch(1, 'Branch A')]), [{ value: '1', label: 'Branch A' }])
})
