export type PosAvailabilityConflictDebug = {
  conflicting_appointments?: Array<{
    id?: number
    booking_code?: string | null
    start_at?: string | null
    end_at?: string | null
  }>
  conflicting_cart_items?: Array<{
    id?: number
    start_at?: string | null
    end_at?: string | null
  }>
  detected_blocks?: Array<{
    id?: number
    scope?: string | null
    start_at?: string | null
    end_at?: string | null
  }>
  detected_leaves?: Array<{
    leave_type?: string | null
    start_at?: string | null
    end_at?: string | null
  }>
  requested_start?: string | null
  requested_end?: string | null
}

export const POS_SCHEDULE_OVERRIDE_REASONS = new Set([
  'outside_staff_schedule',
  'hits_staff_break',
])

export const POS_HARD_AVAILABILITY_REASONS = new Set([
  'staff_off_day',
  'staff_leave',
  'booking_conflict',
  'staff_inactive',
  'no_staff_schedule',
  'schedule_inactive',
])

export type PosAvailabilityVerifyMode = 'full' | 'holiday_only'

export const POS_LEAVE_ONLY_HARD_REASONS = new Set([
  'staff_off_day',
  'staff_leave',
  'staff_inactive',
])

export function parsePosAvailabilityVerifyMode(value: unknown): PosAvailabilityVerifyMode {
  return String(value ?? '').toLowerCase() === 'holiday_only' ? 'holiday_only' : 'full'
}

export function posAvailabilityStaffIsUnavailable(reason: string, verifyMode: PosAvailabilityVerifyMode): boolean {
  if (!reason) return false
  if (verifyMode === 'holiday_only') {
    return POS_LEAVE_ONLY_HARD_REASONS.has(reason)
  }
  return POS_HARD_AVAILABILITY_REASONS.has(reason) && !POS_SCHEDULE_OVERRIDE_REASONS.has(reason)
}

export function posAvailabilityShouldHardBlock(reason: string, verifyMode: PosAvailabilityVerifyMode): boolean {
  if (!reason) return false
  if (verifyMode === 'holiday_only') {
    return POS_LEAVE_ONLY_HARD_REASONS.has(reason)
  }
  return POS_HARD_AVAILABILITY_REASONS.has(reason) && !POS_SCHEDULE_OVERRIDE_REASONS.has(reason)
}

import { formatDateTimeRange } from './posAppointmentHelpers'

function formatPosAvailabilityTimeLabel(startAt?: string | null, endAt?: string | null): string {
  if (!startAt) return 'the selected time'
  const label = formatDateTimeRange(startAt, endAt ?? undefined)
  return label === '-' ? 'the selected time' : label
}

function formatPosAvailabilityWeekdayLabel(startAt?: string | null): string {
  if (!startAt) return 'this day'
  const start = new Date(startAt)
  if (Number.isNaN(start.getTime())) return 'this day'
  return start.toLocaleDateString(undefined, { weekday: 'long' })
}

function buildConflictDetailParts(conflictDebug?: PosAvailabilityConflictDebug | null): string[] {
  const parts: string[] = []

  for (const appt of conflictDebug?.conflicting_appointments ?? []) {
    const code = (appt.booking_code ?? '').trim() || `Booking #${appt.id ?? '?'}`
    parts.push(`appointment ${code} (${formatPosAvailabilityTimeLabel(appt.start_at, appt.end_at)})`)
  }

  for (const cart of conflictDebug?.conflicting_cart_items ?? []) {
    parts.push(`active POS cart hold #${cart.id ?? '?'} (${formatPosAvailabilityTimeLabel(cart.start_at, cart.end_at)})`)
  }

  for (const block of conflictDebug?.detected_blocks ?? []) {
    const scope = String(block.scope ?? '').toUpperCase() === 'STORE' ? 'store blocked time' : 'staff blocked time'
    parts.push(`${scope} #${block.id ?? '?'} (${formatPosAvailabilityTimeLabel(block.start_at, block.end_at)})`)
  }

  return parts
}

export function formatPosAvailabilityErrorMessage(params: {
  reasonCode: string
  staffName?: string | null
  startAt?: string | null
  endAt?: string | null
  conflictDebug?: PosAvailabilityConflictDebug | null
  backendMessage?: string | null
}): string {
  const { reasonCode, staffName, startAt, endAt, conflictDebug, backendMessage } = params
  const staff = (staffName ?? '').trim() || 'Selected staff'
  const slotStart = startAt ?? conflictDebug?.requested_start ?? null
  const slotEnd = endAt ?? conflictDebug?.requested_end ?? null
  const slotLabel = formatPosAvailabilityTimeLabel(slotStart, slotEnd)
  const weekdayLabel = formatPosAvailabilityWeekdayLabel(slotStart)
  const conflictParts = buildConflictDetailParts(conflictDebug)

  if (backendMessage?.trim()) {
    const trimmed = backendMessage.trim()
    const looksGeneric =
      trimmed === 'Selected slot conflicts with another booking or blocked time.'
      || trimmed === 'Selected staff has a conflict for this time.'
      || trimmed === 'Selected staff is not available on this day.'
      || (trimmed.includes('overlaps with another appointment') && reasonCode === 'no_staff_schedule')
    if (!looksGeneric) {
      return trimmed
    }
  }

  if (reasonCode === 'staff_inactive') {
    return `${staff} is inactive and cannot take appointments. Please assign another staff member.`
  }

  if (reasonCode === 'staff_off_day') {
    return `${staff} is on approved off day for this date. Please pick another date or assign a different staff member.`
  }

  if (reasonCode === 'staff_leave') {
    return `${staff} is on approved leave during ${slotLabel}. Please pick another time or assign a different staff member.`
  }

  if (reasonCode === 'no_staff_schedule') {
    return `${staff} is not rostered to work on ${weekdayLabel} (no staff schedule is set for this weekday). Add their schedule in Staff Schedules, pick another date, or assign another staff member.`
  }

  if (reasonCode === 'schedule_inactive') {
    return `${staff} has an inactive schedule on ${weekdayLabel}. Please update staff schedule settings or choose another date or staff member.`
  }

  if (reasonCode === 'hits_staff_break') {
    return `${slotLabel} overlaps with ${staff}'s break time. If this is a walk-in or overtime booking, you can continue with schedule override.`
  }

  if (reasonCode === 'outside_staff_schedule') {
    return `${slotLabel} is outside ${staff}'s regular working hours. If this is a walk-in or overtime booking, you can continue with schedule override.`
  }

  if (conflictParts.length > 0) {
    return `Cannot book ${slotLabel} for ${staff} because it overlaps with: ${conflictParts.join('; ')}. Please choose a different time or staff member.`
  }

  if (reasonCode === 'booking_conflict') {
    return `Cannot book ${slotLabel} for ${staff}. This time overlaps with another appointment, an active cart hold, or blocked time. Please pick a different slot or staff member.`
  }

  return backendMessage?.trim()
    || `${staff} is not available for ${slotLabel}. Please choose another time or staff member.`
}

export function formatPosNoStaffAvailableMessage(params: {
  allowedStaffCount: number
  unavailableReasons?: Record<string, string>
  allowedStaffIds?: number[]
}): string {
  const { allowedStaffCount, unavailableReasons = {}, allowedStaffIds = [] } = params

  if (allowedStaffCount <= 0) {
    return 'No staff is linked to this service. Update the service allowed staff list or choose another service.'
  }

  const reasons = new Set(
    allowedStaffIds
      .map((id) => unavailableReasons[String(id)] ?? '')
      .filter(Boolean),
  )

  if (reasons.has('no_staff_schedule') || reasons.has('schedule_inactive')) {
    return 'No staff available for this slot. Eligible staff have no roster for this weekday or an inactive schedule — check Staff Schedules, or pick another date/time.'
  }

  if (reasons.has('staff_off_day') || reasons.has('staff_leave')) {
    return 'No staff available for this slot. All eligible staff are on off day or approved leave. Pick another date/time.'
  }

  if (reasons.has('staff_inactive')) {
    return 'No staff available for this slot. Eligible staff are inactive. Assign active staff to this service or choose another service.'
  }

  if (reasons.has('booking_conflict')) {
    return 'No staff available for this slot. All eligible staff have a booking conflict at this time. Pick another slot.'
  }

  return 'No staff available for this slot. Pick another date/time or check Staff Schedules and leave settings.'
}
