import type { StoreLocation } from '../types/storeLocation'

export const ALL_BRANCHES = 'all' as const

export type PersistedBranchSelection = number | typeof ALL_BRANCHES | null

/** Resolve UX state only; this value is never sent to a business API. */
export function resolveBranchSelection(
  activeBranches: StoreLocation[],
  persisted: PersistedBranchSelection,
): number | null {
  if (activeBranches.length === 1) return activeBranches[0].id
  if (activeBranches.length === 0 || persisted === ALL_BRANCHES || persisted === null) return null

  return activeBranches.some((branch) => branch.id === persisted) ? persisted : null
}

export function parsePersistedBranchSelection(value: string | null): PersistedBranchSelection {
  if (value === ALL_BRANCHES) return ALL_BRANCHES
  if (value === null || !/^\d+$/.test(value)) return null

  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
