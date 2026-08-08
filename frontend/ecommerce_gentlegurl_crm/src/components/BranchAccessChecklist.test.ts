import assert from 'node:assert/strict'
import test from 'node:test'

import { branchIdsFromAssignments, toggleBranchId } from './branch-access-selection'

test('all existing branch assignments are prepared as selected values', () => {
  assert.deepEqual(branchIdsFromAssignments([{ id: 11 }, { id: 22 }]), ['11', '22'])
})

test('adding a branch preserves existing assignments', () => {
  assert.deepEqual(toggleBranchId(['11'], 22, true), ['11', '22'])
})

test('removing a branch removes only that assignment', () => {
  assert.deepEqual(toggleBranchId(['11', '22'], 11, false), ['22'])
})
