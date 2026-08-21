import assert from 'node:assert/strict'
import test from 'node:test'

import { LatestRequestCoordinator } from './latestRequest'

test('deduplicates the same in-flight request key', () => {
  const coordinator = new LatestRequestCoordinator()
  const first = coordinator.begin('appointments:branch-a:2026-08')
  assert.equal(first.duplicate, false)
  assert.deepEqual(coordinator.begin('appointments:branch-a:2026-08'), { duplicate: true })
})

test('a branch change aborts the stale request and only the latest response is current', () => {
  const coordinator = new LatestRequestCoordinator()
  const branchA = coordinator.begin('appointments:branch-a:2026-08')
  assert.equal(branchA.duplicate, false)
  if (branchA.duplicate) return

  const branchB = coordinator.begin('appointments:branch-b:2026-08')
  assert.equal(branchB.duplicate, false)
  if (branchB.duplicate) return

  assert.equal(branchA.signal.aborted, true)
  assert.equal(coordinator.isCurrent(branchA.sequence), false)
  assert.equal(coordinator.isCurrent(branchB.sequence), true)
})
