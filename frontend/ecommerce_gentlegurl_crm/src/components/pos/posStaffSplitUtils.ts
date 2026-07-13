import {
  formatPosAvailabilityErrorMessage,
  parsePosAvailabilityVerifyMode,
  posAvailabilityShouldHardBlock,
  type PosAvailabilityVerifyMode,
} from '@/components/pos/posAvailabilityMessages'

import type { PrimaryStaffChangePrompt } from '@/components/pos/PosPrimaryStaffChangeConfirmModal'

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

export function resolveStaffDisplayName(
  staffId: number,
  staffNameById: (id: number) => string | null | undefined,
): string {
  return staffNameById(staffId) ?? `Staff #${staffId}`
}

export function createStaffNameResolver(
  activeStaffs: Array<{ id: number; name: string }>,
  options?: {
    fallbackStaff?: { id?: number; name?: string } | null
    extraSplits?: Array<{ staff_id?: number; staff_name?: string | null }>
  },
): (id: number) => string | null | undefined {
  return (id) => {
    const fromList = activeStaffs.find((staff) => staff.id === id)?.name
    if (fromList) return fromList

    const fromSplit = options?.extraSplits?.find((split) => split.staff_id === id)?.staff_name
    if (fromSplit) return fromSplit

    if (options?.fallbackStaff?.id === id) {
      return options.fallbackStaff.name
    }

    return null
  }
}

export function buildEditSettlementPrimaryStaffChangePrompt(params: {
  originalStaffId: number | null | undefined
  nextSplits: NormalizedStaffSplitRow[]
  staffNameById: (id: number) => string | null | undefined
}): PrimaryStaffChangePrompt | null {
  const nextPrimaryId = resolvePrimaryStaffIdFromSplits(params.nextSplits)
  if (!nextPrimaryId) {
    return null
  }

  const originalId = Number(params.originalStaffId ?? 0)
  if (originalId > 0 && originalId === nextPrimaryId) {
    return null
  }

  return {
    originalName: originalId > 0
      ? resolveStaffDisplayName(originalId, params.staffNameById)
      : 'Unassigned',
    nextName: resolveStaffDisplayName(nextPrimaryId, params.staffNameById),
  }
}

export async function verifyEditSettlementPrimaryStaffAvailability(params: {
  nextSplits: NormalizedStaffSplitRow[]
  startAt: string | null | undefined
  endAt: string | null | undefined
  ignoreBookingId?: number
  verifyMode?: PosAvailabilityVerifyMode
  staffNameById: (id: number) => string | null | undefined
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const nextPrimaryId = resolvePrimaryStaffIdFromSplits(params.nextSplits)
  if (!nextPrimaryId) {
    return { ok: false, message: 'Please select a primary staff for the original service split.' }
  }

  const verifyMode = params.verifyMode ?? 'holiday_only'
  const startAt = params.startAt ?? null
  const endAt = params.endAt ?? null

  if (!startAt || !endAt) {
    return { ok: true }
  }

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

  return { ok: true }
}

/** @deprecated Use verifyEditSettlementPrimaryStaffAvailability + modal confirmation instead. */
export async function confirmAndVerifyEditSettlementPrimaryStaffChange(params: {
  originalStaffId: number | null | undefined
  nextSplits: NormalizedStaffSplitRow[]
  startAt: string | null | undefined
  endAt: string | null | undefined
  ignoreBookingId?: number
  verifyMode?: PosAvailabilityVerifyMode
  staffNameById: (id: number) => string | null | undefined
  confirmChange?: () => Promise<boolean> | boolean
}): Promise<{ ok: true } | { ok: false; message?: string; cancelled?: boolean }> {
  const availability = await verifyEditSettlementPrimaryStaffAvailability(params)
  if (!availability.ok) {
    return availability
  }

  const prompt = buildEditSettlementPrimaryStaffChangePrompt(params)
  if (!prompt) {
    return { ok: true }
  }

  const confirmed = params.confirmChange
    ? await params.confirmChange()
    : window.confirm(
      `The appointment's primary assigned staff will change from ${prompt.originalName} to ${prompt.nextName}. Continue?`,
    )

  if (!confirmed) {
    return { ok: false, cancelled: true }
  }

  return { ok: true }
}
