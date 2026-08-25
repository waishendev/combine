import assert from 'node:assert/strict'
import test from 'node:test'

import { promotionApplicabilityBadges, rewardAvailabilityLabels } from './catalogApplicability'

const png = { id: 1, name: 'PNG' }
const branchB = { id: 2, name: 'Branch B' }

test('promotion ALL labels online, all POS, and selected POS applicability', () => {
  assert.deepEqual(promotionApplicabilityBadges({ isAllBranches: true, isOnlineEnabled: true, offlineBranches: [], offlineAllAccessible: false }), [{ label: 'Online Ecommerce', tone: 'online' }])
  assert.deepEqual(promotionApplicabilityBadges({ isAllBranches: true, isOnlineEnabled: false, offlineBranches: [png, branchB], offlineAllAccessible: true }), [{ label: 'All POS Branches', tone: 'pos' }])
  assert.deepEqual(promotionApplicabilityBadges({ isAllBranches: true, isOnlineEnabled: true, offlineBranches: [png], offlineAllAccessible: false }).map(({ label }) => label), ['Online Ecommerce', 'PNG'])
})

test('promotion specific Branch uses channel context without repeating its name', () => {
  assert.deepEqual(promotionApplicabilityBadges({ isAllBranches: false, isOnlineEnabled: false, offlineBranches: [png], offlineAllAccessible: false }).map(({ label }) => label), ['POS'])
  assert.deepEqual(promotionApplicabilityBadges({ isAllBranches: false, isOnlineEnabled: true, offlineBranches: [png, branchB], offlineAllAccessible: false }).map(({ label }) => label), ['POS', 'Online Ecommerce'])
})

test('reward availability uses Product Branches and compacts the complete accessible set', () => {
  assert.deepEqual(rewardAvailabilityLabels([png, branchB], false), ['PNG', 'Branch B'])
  assert.deepEqual(rewardAvailabilityLabels([png], false), ['PNG'])
  assert.deepEqual(rewardAvailabilityLabels([png, branchB], true), ['All Branches'])
})
