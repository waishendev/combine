export function branchIdsFromAssignments(assignments: Array<{ id?: number | string | null }> | null | undefined): string[] {
  if (!Array.isArray(assignments)) return []
  return assignments
    .map((assignment) => Number(assignment.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .map(String)
}

export function toggleBranchId(selectedIds: string[], branchId: number, checked: boolean): string[] {
  const value = String(branchId)
  if (checked) return selectedIds.includes(value) ? selectedIds : [...selectedIds, value]
  return selectedIds.filter((id) => id !== value)
}
