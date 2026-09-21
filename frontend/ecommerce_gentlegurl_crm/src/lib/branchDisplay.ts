/** Public Branch label for UI (prefer display_code, fall back to system code). */
export function branchDisplayCode(
  branch?: { display_code?: string | null; code?: string | null } | null,
): string {
  const display = String(branch?.display_code ?? '').trim()
  if (display) return display
  return String(branch?.code ?? '').trim()
}

export function branchDisplayLabel(
  branch?: { name?: string | null; display_code?: string | null; code?: string | null } | null,
  fallback = 'Unassigned',
): string {
  if (!branch) return fallback
  const code = branchDisplayCode(branch)
  const name = String(branch.name ?? '').trim()
  if (code && name) return `${name} (${code})`
  return code || name || fallback
}
