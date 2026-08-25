export type BranchLabel = { id: number; name: string }

export type ApplicabilityBadge = {
  label: string
  tone: 'online' | 'pos'
}

export function promotionApplicabilityBadges(input: {
  isAllBranches: boolean
  isOnlineEnabled: boolean
  offlineBranches: BranchLabel[]
  offlineAllAccessible: boolean
}): ApplicabilityBadge[] {
  const badges: ApplicabilityBadge[] = []
  if (input.isOnlineEnabled) badges.push({ label: 'Online Ecommerce', tone: 'online' })

  if (!input.isAllBranches) {
    if (input.offlineBranches.length > 0) badges.unshift({ label: 'POS', tone: 'pos' })
    return badges
  }

  if (input.offlineAllAccessible) {
    badges.push({ label: 'All POS Branches', tone: 'pos' })
  } else {
    badges.push(...input.offlineBranches.map((branch) => ({ label: branch.name, tone: 'pos' as const })))
  }
  return badges
}

export function rewardAvailabilityLabels(
  branches: BranchLabel[],
  availableAtAllAccessibleBranches: boolean,
): string[] {
  if (availableAtAllAccessibleBranches) return ['All Branches']
  return branches.map((branch) => branch.name)
}
