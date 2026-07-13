export type PackageClaimDisplayRow = {
  package_name?: string | null
  booking_service_id?: number | null
  status?: string | null
  used_from?: string | null
}

export function isCustomerAppliedPackageClaim(usedFrom?: string | null): boolean {
  return String(usedFrom ?? '').toUpperCase() === 'BOOKING'
}

export function packageClaimSourceLabel(usedFrom?: string | null): string | null {
  const source = String(usedFrom ?? '').toUpperCase()
  if (source === 'BOOKING') return 'Customer applied'
  if (source === 'POS') return 'POS applied'
  return null
}

export function formatPackageClaimLineText(
  claim: PackageClaimDisplayRow | null | undefined,
  fallback = 'Package',
): string {
  if (!claim) return `[PKG] ${fallback}`
  const name = claim.package_name || fallback
  const sourceLabel = packageClaimSourceLabel(claim.used_from)
  return sourceLabel ? `[PKG] ${name} · ${sourceLabel}` : `[PKG] ${name}`
}

export function findPackageClaimForService(
  claims: PackageClaimDisplayRow[] | null | undefined,
  bookingServiceId: number,
): PackageClaimDisplayRow | undefined {
  return (claims ?? []).find((claim) => Number(claim.booking_service_id ?? 0) === bookingServiceId)
}

export type PackageClaimReleaseRow = {
  usage_id: number
  booking_service_id?: number | null
  status?: string | null
}

export function collectActivePackageClaimUsageIds(
  claims: PackageClaimReleaseRow[] | null | undefined,
  bookingServiceId?: number | null,
): number[] {
  const serviceId = Number(bookingServiceId ?? 0)
  return (claims ?? [])
    .filter((claim) => {
      if (!['reserved', 'consumed'].includes(String(claim.status ?? '').toLowerCase())) {
        return false
      }
      if (serviceId <= 0) {
        return true
      }
      return Number(claim.booking_service_id ?? 0) === serviceId
    })
    .map((claim) => Number(claim.usage_id))
    .filter((id) => id > 0)
}

export async function batchReleaseAppointmentPackageClaims(
  bookingId: number,
  usageIds: number[],
): Promise<{ ok: boolean; message?: string; releasedCount?: number }> {
  if (bookingId <= 0 || usageIds.length === 0) {
    return { ok: true, releasedCount: 0 }
  }

  const res = await fetch(`/api/proxy/pos/appointments/${bookingId}/batch-release-packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ releases: usageIds.map((usage_id) => ({ usage_id })) }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, message: (json?.message as string | undefined) ?? 'Unable to release package claims.' }
  }

  return {
    ok: true,
    releasedCount: Number(json?.data?.released_count ?? usageIds.length),
  }
}

export function pruneReleasedPackageClaims<T extends PackageClaimReleaseRow>(
  claims: T[] | null | undefined,
  releasedUsageIds: number[],
): T[] {
  const releasedIdSet = new Set(releasedUsageIds)
  return (claims ?? []).filter((claim) => !releasedIdSet.has(Number(claim.usage_id)))
}

export async function releaseAppointmentPackageClaimsForService(
  bookingId: number,
  claims: PackageClaimReleaseRow[] | null | undefined,
  bookingServiceId: number,
): Promise<{ ok: boolean; message?: string; releasedUsageIds: number[] }> {
  const usageIds = collectActivePackageClaimUsageIds(claims, bookingServiceId)
  if (usageIds.length === 0) {
    return { ok: true, releasedUsageIds: [] }
  }

  const result = await batchReleaseAppointmentPackageClaims(bookingId, usageIds)
  return {
    ok: result.ok,
    message: result.message,
    releasedUsageIds: result.ok ? usageIds : [],
  }
}
