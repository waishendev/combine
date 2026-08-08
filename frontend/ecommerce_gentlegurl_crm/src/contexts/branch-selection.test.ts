import assert from 'node:assert/strict'
import test from 'node:test'

import { ALL_BRANCHES, parsePersistedBranchSelection, resolveBranchSelection } from './branch-selection'
import type { StoreLocation } from '../types/storeLocation'

const branch = (id: number, isActive = true): StoreLocation => ({
  id,
  name: `Branch ${id}`,
  code: `B${id}`,
  is_active: isActive,
  is_pickup_available: true,
  is_booking_available: true,
  is_pos_available: true,
  sort_order: id,
})

test('one active accessible branch is automatically selected', () => {
  assert.equal(resolveBranchSelection([branch(7)], ALL_BRANCHES), 7)
})

test('multiple branches default to All Branches', () => {
  assert.equal(resolveBranchSelection([branch(1), branch(2)], null), null)
})

test('a valid persisted selection is restored', () => {
  assert.equal(resolveBranchSelection([branch(1), branch(2)], 2), 2)
})

test('an inaccessible or revoked persisted selection falls back to All Branches', () => {
  assert.equal(resolveBranchSelection([branch(1), branch(2)], 99), null)
})

test('a deactivated persisted branch falls back after active branches are filtered', () => {
  const active = [branch(1), branch(2, false)].filter((item) => item.is_active)
  assert.equal(resolveBranchSelection(active, 2), 1)
})

test('persisted values use an explicit all state and reject invalid IDs', () => {
  assert.equal(parsePersistedBranchSelection('all'), ALL_BRANCHES)
  assert.equal(parsePersistedBranchSelection('12'), 12)
  assert.equal(parsePersistedBranchSelection('0'), null)
  assert.equal(parsePersistedBranchSelection('-1'), null)
  assert.equal(parsePersistedBranchSelection('not-a-branch'), null)
})
