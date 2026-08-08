import type { StoreLocation } from '../types/storeLocation'

export function branchSelectorOptions(branches: StoreLocation[]): Array<{ value: string; label: string }> {
  return [
    ...(branches.length > 1 ? [{ value: 'all', label: 'All Branches' }] : []),
    ...branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
  ]
}
