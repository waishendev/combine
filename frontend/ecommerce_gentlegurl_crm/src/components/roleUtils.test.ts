import assert from 'node:assert/strict'
import test from 'node:test'

import { mapRoleApiItemToRow, roleApiErrorMessage } from './roleUtils'

test('created role row uses persisted Branch metadata rather than a header placeholder', () => {
  const row = mapRoleApiItemToRow({
    id: 41,
    name: 'Receptionist',
    store_location_id: 2,
    store_location: { id: 2, name: 'Branch B', code: 'BB' },
  })

  assert.equal(row.branchName, 'Branch B')
  assert.notEqual(row.branchName, 'Current Branch')
})

test('platform-global role rendering retains the established label', () => {
  assert.equal(mapRoleApiItemToRow({ id: 1, name: 'infra_core_x1', store_location: null }).branchName, 'Global / Unassigned')
})

test('business and validation errors are rendered as text instead of raw JSON', () => {
  assert.equal(
    roleApiErrorMessage({ success: false, message: 'This protected system Role cannot be deleted.' }, 'Failed'),
    'This protected system Role cannot be deleted.',
  )
  assert.equal(
    roleApiErrorMessage({ success: false, message: 'HTTP Error', errors: { role: ['Role is assigned.'] } }, 'Failed'),
    'Role is assigned.',
  )
  assert.equal(roleApiErrorMessage({ success: false, message: 'HTTP Error' }, 'Failed'), 'Failed')
  assert.ok(!roleApiErrorMessage({ success: false, message: 'No access' }, 'Failed').startsWith('{'))
})
