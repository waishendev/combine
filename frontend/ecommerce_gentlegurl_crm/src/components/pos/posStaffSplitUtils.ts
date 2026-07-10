import {
  formatPosAvailabilityErrorMessage,
  parsePosAvailabilityVerifyMode,
  posAvailabilityShouldHardBlock,
  type PosAvailabilityVerifyMode,
} from '@/components/pos/posAvailabilityMessages'

export type NormalizedStaffSplitRow = {
  staff_id: number
  share_percent: number
}

export function resolvePrimaryStaffIdFromSplits(
  splits: Array<{ staff_id: number | null | undefined; share_percent: string | number | null | undefined }>,
): number | null {
  const first = splits.find((row) => Number(row.staff_id ?? 0) > 0 && Number(row.share_percent ?? 0) > 0)
  const staffId = Number(first?.staff_id ?? 0)
  return staffId > 0 ? staffId : null
}

export async function confirmAndVerifyEditSettlementPrimaryStaffChange(params: {
  originalStaffId: number | null | undefined
  nextSplits: NormalizedStaffSplitRow[]
  startAt: string | null | undefined
  endAt: string | null | undefined
  ignoreBookingId?: number
  verifyMode?: PosAvailabilityVerifyMode
  staffNameById: (id: number) => string | null | undefined
}): Promise<{ ok: true } | { ok: false; message?: string; cancelled?: boolean }> {
  const nextPrimaryId = resolvePrimaryStaffIdFromSplits(params.nextSplits)
  if (!nextPrimaryId) {
    return { ok: false, message: 'Please select a primary staff for the original service split.' }
  }

  const originalId = Number(params.originalStaffId ?? 0)
  if (originalId > 0 && originalId === nextPrimaryId) {
    return { ok: true }
  }

  const verifyMode = params.verifyMode ?? 'holiday_only'
  const startAt = params.startAt ?? null
  const endAt = params.endAt ?? null

  if (startAt && endAt) {
    const search = new URLSearchParams({
      staff_id: String(nextPrimaryId),
      start_at: startAt,
      end_at: endAt,
    })
    if (params.ignoreBookingId) {
      search.set('ignore_booking_id', String(params.ignoreBookingId))
    }

    const availabilityRes = await fetch(`/api/proxy/pos/availability/check?${search.toString()}`, { cache: 'no-store' })
    const availabilityJson = await availabilityRes.json().catch(() => null)
    const reason = String(availabilityJson?.data?.reason_code ?? '')
    const effectiveVerifyMode = parsePosAvailabilityVerifyMode(availabilityJson?.data?.verify_mode) || verifyMode

    if (availabilityJson?.data?.is_hard_block || posAvailabilityShouldHardBlock(reason, effectiveVerifyMode)) {
      return {
        ok: false,
        message: formatPosAvailabilityErrorMessage({
          reasonCode: reason || 'staff_unavailable',
          staffName: params.staffNameById(nextPrimaryId),
          startAt,
          endAt,
          conflictDebug: availabilityJson?.data?.conflict_debug ?? null,
          backendMessage: availabilityJson?.data?.message ?? availabilityJson?.message ?? null,
        }),
      }
    }
  }

  const originalName = originalId > 0
    ? (params.staffNameById(originalId) ?? `Staff #${originalId}`)
    : 'Unassigned'
  const nextName = params.staffNameById(nextPrimaryId) ?? `Staff #${nextPrimaryId}`
  const confirmed = window.confirm(
    `Assigned staff will change from ${originalName} to ${nextName}. This updates the appointment owner for scheduling and commission. Continue?`,
  )
  if (!confirmed) {
    return { ok: false, cancelled: true }
  }

  return { ok: true }
}
