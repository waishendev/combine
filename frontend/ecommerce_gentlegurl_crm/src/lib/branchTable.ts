export type BranchAttribution = {
  store_location_id?: number | null
  store_location?: { name?: string | null } | null
}

export const shouldShowBranchColumn = (selectedBranchId: number | null) => selectedBranchId === null

export const branchName = ({ store_location_id, store_location }: BranchAttribution) => {
  if (store_location?.name?.trim()) return store_location.name.trim()
  return store_location_id == null ? 'Unassigned' : 'Unknown Branch'
}
