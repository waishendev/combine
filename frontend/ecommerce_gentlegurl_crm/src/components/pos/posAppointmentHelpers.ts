import type { PosAppointmentDetail, PosAppointmentListItem } from './posAppointmentTypes'
import { formatDateTime12Hour } from '@/lib/formatDateTime'
import {
  POS_APPOINTMENT_DAY_END_MIN,
  POS_APPOINTMENT_DAY_START_MIN,
  POS_APPOINTMENT_SLOT_MINUTES,
  POS_SCHEDULE_TZ,
} from './posAppointmentScheduleConfig'

export type { PosAppointmentListItem as PosAppointmentRow } from './posAppointmentTypes'

const NAIVE_WALL_CLOCK_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
const HAS_TZ_OFFSET_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i

function readNaiveWallClock(value: string): { ymd: string; hour: number; minute: number; second: number } | null {
  const match = value.trim().match(NAIVE_WALL_CLOCK_RE)
  if (!match || HAS_TZ_OFFSET_RE.test(value.trim())) return null
  const hour = Number(match[2])
  const minute = Number(match[3])
  const second = Number(match[4] ?? '0')
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null
  return { ymd: match[1], hour, minute, second }
}

function wallClockInTimeZoneToDate(ymd: string, hour: number, minute: number, second: number, timeZone = POS_SCHEDULE_TZ): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  let candidate = Date.UTC(y, m - 1, d, hour, minute, second)
  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(new Date(candidate))
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
    const diffSec = (hour * 3600 + minute * 60 + second) - (read('hour') * 3600 + read('minute') * 60 + read('second'))
    if (diffSec === 0) break
    candidate += diffSec * 1000
  }
  return new Date(candidate)
}

function parsePosDateTime(value: string): Date | null {
  const trimmed = value.trim()
  const naive = readNaiveWallClock(trimmed)
  if (naive) {
    return wallClockInTimeZoneToDate(naive.ymd, naive.hour, naive.minute, naive.second)
  }
  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(/^(\d{4}-\d{2}-\d{2})[ T]/, '$1T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatTime12FromDate(date: Date, timeZone = POS_SCHEDULE_TZ): string {
  return date.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })
}

/** YYYY-MM-DD in business timezone (month/day schedule grouping). */
export function parsePosAppointmentScheduleYmd(iso?: string | null): string | null {
  if (!iso) return null
  const naive = readNaiveWallClock(iso)
  if (naive) return naive.ymd
  const date = parsePosDateTime(iso)
  if (!date) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: POS_SCHEDULE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${read('year')}-${read('month')}-${read('day')}`
}

/** Minutes from midnight in business timezone (day-grid positioning). */
export function minutesFromPosAppointmentSchedule(iso?: string | null): number | null {
  if (!iso) return null
  const naive = readNaiveWallClock(iso)
  if (naive) return naive.hour * 60 + naive.minute
  const date = parsePosDateTime(iso)
  if (!date) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: POS_SCHEDULE_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? NaN)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? NaN)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

/** Normalize list rows from API (supports legacy `start_at` / `end_at` keys). */
export function normalizePosAppointmentListItem(row: PosAppointmentListItem): PosAppointmentListItem {
  const legacy = row as PosAppointmentListItem & { start_at?: string | null; end_at?: string | null }
  return {
    ...row,
    appointment_start_at: row.appointment_start_at ?? legacy.start_at ?? null,
    appointment_end_at: row.appointment_end_at ?? legacy.end_at ?? null,
  }
}

export function getPosAppointmentStartAt(
  row: Pick<PosAppointmentListItem, 'appointment_start_at'> & { start_at?: string | null },
): string | null {
  return row.appointment_start_at ?? row.start_at ?? null
}

export function getPosAppointmentEndAt(
  row: Pick<PosAppointmentListItem, 'appointment_end_at'> & { end_at?: string | null },
): string | null {
  return row.appointment_end_at ?? row.end_at ?? null
}

/** Add minutes to a schedule timestamp (naive wall-clock or ISO). */
export function addMinutesToPosAppointmentScheduleIso(iso: string, deltaMin: number): string {
  const naive = readNaiveWallClock(iso)
  if (naive) {
    let total = naive.hour * 60 + naive.minute + deltaMin
    const dayMinutes = 24 * 60
    total = ((total % dayMinutes) + dayMinutes) % dayMinutes
    const hour = Math.floor(total / 60)
    const minute = total % 60
    return `${naive.ymd} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(naive.second).padStart(2, '0')}`
  }
  const date = parsePosDateTime(iso)
  if (!date) return iso
  return new Date(date.getTime() + deltaMin * 60 * 1000).toISOString()
}

export function resolvePosAppointmentEndIso(startIso: string, endIso?: string | null, defaultDurationMin = 30): string {
  if (endIso && endIso !== startIso) return endIso
  return addMinutesToPosAppointmentScheduleIso(startIso, defaultDurationMin)
}

/** Time-only label for schedule grid / month preview (12-hour, business timezone). */
export function formatPosScheduleTimeLabel(iso?: string | null): string {
  if (!iso) return ''
  const date = parsePosDateTime(iso)
  if (!date) return ''
  return formatTime12FromDate(date)
}

function makePosLocalDateTimeValue(date: string, minutesFromMidnight: number) {
  const hours = Math.floor(minutesFromMidnight / 60)
  const minutes = minutesFromMidnight % 60
  return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

/** Bookable slots for POS dropdowns (9 am – midnight, 15-minute steps by default). */
export function buildPosAppointmentSlots(
  date: string,
  durationMin: number,
  stepMin = POS_APPOINTMENT_SLOT_MINUTES,
): Array<{ start_at: string; end_at: string }> {
  const safeDurationMin = Math.max(1, durationMin)
  const lastStartMinute = Math.max(POS_APPOINTMENT_DAY_START_MIN, POS_APPOINTMENT_DAY_END_MIN - safeDurationMin)
  const slots: Array<{ start_at: string; end_at: string }> = []

  for (let minute = POS_APPOINTMENT_DAY_START_MIN; minute <= lastStartMinute; minute += stepMin) {
    slots.push({
      start_at: makePosLocalDateTimeValue(date, minute),
      end_at: makePosLocalDateTimeValue(date, minute + safeDurationMin),
    })
  }

  return slots
}

/** Display payment history `line_type` without underscores (e.g. booking_deposit → booking deposit). */
export function formatPosPaymentHistoryLineType(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) return '—'
  return s.replace(/_/g, ' ')
}

export type PageResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  /** Present on POS appointments list when backend includes global pending count. */
  pending_cancellation_requests_count: number
}

function parsePendingCancellationRequestsCount(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0
  const raw = (obj as { pending_cancellation_requests_count?: unknown }).pending_cancellation_requests_count
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function extractPaged<T>(json: unknown): PageResponse<T> {
  const payloadAny: unknown =
    typeof json === 'object' && json !== null && 'data' in json ? (json as { data: unknown }).data : undefined

  if (payloadAny && typeof payloadAny === 'object' && Array.isArray((payloadAny as { data?: unknown }).data)) {
    const p = payloadAny as {
      data: T[]
      current_page?: number
      last_page?: number
      per_page?: number
      total?: number
    }
    return {
      data: p.data as T[],
      current_page: Number(p.current_page ?? 1),
      last_page: Number(p.last_page ?? 1),
      per_page: Number(p.per_page ?? p.data.length ?? 0),
      total: Number(p.total ?? p.data.length ?? 0),
      pending_cancellation_requests_count: parsePendingCancellationRequestsCount(p),
    }
  }

  if (payloadAny && Array.isArray(payloadAny)) {
    const arr = payloadAny as T[]
    return {
      data: arr,
      current_page: 1,
      last_page: 1,
      per_page: arr.length,
      total: arr.length,
      pending_cancellation_requests_count: parsePendingCancellationRequestsCount(payloadAny),
    }
  }

  return {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 0,
    total: 0,
    pending_cancellation_requests_count: 0,
  }
}

export function formatTimeRange(startAt?: string | null, endAt?: string | null) {
  if (!startAt) return '-'
  const start = parsePosDateTime(startAt)
  if (!start) return '-'
  if (!endAt) return formatTime12FromDate(start)
  const end = parsePosDateTime(endAt)
  if (!end) return formatTime12FromDate(start)
  return `${formatTime12FromDate(start)} - ${formatTime12FromDate(end)}`
}

export function formatDateTimeRange(startAt?: string | null, endAt?: string | null) {
  if (!startAt) return '-'
  const formattedStart = formatDateTime12Hour(startAt, POS_SCHEDULE_TZ)
  if (!formattedStart) return '-'
  if (!endAt) return formattedStart
  const end = parsePosDateTime(endAt)
  if (!end) return formattedStart
  const endTime = formatTime12FromDate(end)
  const commaIndex = formattedStart.indexOf(',')
  if (commaIndex === -1) return `${formattedStart} - ${endTime}`
  const datePart = formattedStart.slice(0, commaIndex).trim()
  const startTime = formattedStart.slice(commaIndex + 1).trim()
  return `${datePart}, ${startTime} - ${endTime}`
}

/** Visual grouping for schedule blocks (month preview + day grid). */
export type PosAppointmentVisualTone = 'active' | 'hold' | 'completedPaid' | 'completedUnpaid' | 'inactive'

/**
 * Same “register paid” idea as the appointment detail Paid badge: not “package reserved, not finalised”
 * and no amount due.
 */
export function posAppointmentRegisterPaid(
  row: Pick<PosAppointmentListItem, 'amount_due_now' | 'balance_due' | 'package_status' | 'settlement_paid' | 'payment_status'>,
): boolean {
  const settlementPaid = Number(row.settlement_paid ?? 0)
  const pkg = String(row.package_status?.status ?? '').toLowerCase()
  const packageReservedPending = pkg === 'reserved' && settlementPaid <= 0.0001
  const amountDueNow = Number(row.amount_due_now ?? 0)
  const balanceDue = Number(row.balance_due ?? 0)
  const paymentStatus = String(row.payment_status ?? '').toUpperCase()
  const hasPaymentStatus = paymentStatus.length > 0

  return !packageReservedPending && amountDueNow <= 0.0001 && balanceDue <= 0.0001 && (!hasPaymentStatus || paymentStatus === 'PAID')
}

export function posAppointmentVisualToneFromRow(row: PosAppointmentListItem): PosAppointmentVisualTone {
  const s = String(row.status ?? '').toUpperCase()
  if (['CANCELLED', 'NO_SHOW', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION', 'EXPIRED', 'VOIDED'].includes(s)) return 'inactive'
  if (s === 'HOLD') return 'hold'
  if (s === 'COMPLETED') {
    return posAppointmentRegisterPaid(row) ? 'completedPaid' : 'completedUnpaid'
  }
  return 'active'
}

/** Rows shown on the POS schedule calendar (includes completed paid/unpaid; excludes terminal statuses). */
export function posAppointmentBlocksActiveSchedule(row: PosAppointmentListItem): boolean {
  const tone = posAppointmentVisualToneFromRow(row)
  return tone !== 'inactive'
}

export type PosAppointmentScheduleScope = 'active' | 'all'

/** Calendar display filter — Active hides completed·paid so freed slots stay readable. */
export function posAppointmentShowOnScheduleCalendar(
  row: PosAppointmentListItem,
  scope: PosAppointmentScheduleScope = 'active',
): boolean {
  if (!posAppointmentBlocksActiveSchedule(row)) return false
  if (scope === 'all') return true
  return posAppointmentVisualToneFromRow(row) !== 'completedPaid'
}

/** When only `status` is known (no payment fields); completed is shown as unpaid until row data loads. */
export function posAppointmentVisualTone(status: string | null | undefined): PosAppointmentVisualTone {
  const s = String(status ?? '').toUpperCase()
  if (s === 'COMPLETED') return 'completedUnpaid'
  if (s === 'HOLD') return 'hold'
  if (['CANCELLED', 'NO_SHOW', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION', 'EXPIRED', 'VOIDED'].includes(s)) return 'inactive'
  return 'active'
}

/** Tailwind classes for a day-grid appointment block button. */
export function posAppointmentDayBlockClass(tone: PosAppointmentVisualTone): string {
  const base =
    'absolute z-[2] overflow-hidden rounded-md border-2 px-1 py-0.5 text-left text-[10px] font-semibold leading-tight shadow-md transition hover:z-10 focus:outline-none focus-visible:ring-2'
  switch (tone) {
    case 'completedPaid':
      return `${base} border-emerald-900 bg-emerald-600 text-white ring-1 ring-emerald-950/30 hover:bg-emerald-500 hover:ring-2 hover:ring-emerald-300 focus-visible:ring-emerald-300`
    case 'completedUnpaid':
      return `${base} border-amber-900 bg-amber-600 text-white ring-1 ring-amber-950/30 hover:bg-amber-500 hover:ring-2 hover:ring-amber-300 focus-visible:ring-amber-300`
    case 'hold':
      return `${base} border-violet-900 bg-violet-600 text-white ring-1 ring-violet-950/30 hover:bg-violet-500 hover:ring-2 hover:ring-violet-300 focus-visible:ring-violet-300`
    case 'inactive':
      return `${base} border-rose-900 bg-rose-600 text-white ring-1 ring-rose-950/30 hover:bg-rose-500 hover:ring-2 hover:ring-rose-300 focus-visible:ring-rose-300`
    default:
      return `${base} border-indigo-900 bg-indigo-600 text-white ring-1 ring-indigo-950/30 hover:bg-indigo-500 hover:ring-2 hover:ring-amber-400 focus-visible:ring-amber-300`
  }
}

/** Muted line under time on day block (customer · service). */
export function posAppointmentDayBlockSubtextClass(tone: PosAppointmentVisualTone): string {
  switch (tone) {
    case 'completedPaid':
      return 'block truncate text-[9px] font-medium text-emerald-50'
    case 'completedUnpaid':
      return 'block truncate text-[9px] font-medium text-amber-50'
    case 'hold':
      return 'block truncate text-[9px] font-medium text-violet-50'
    case 'inactive':
      return 'block truncate text-[9px] font-medium text-rose-50'
    default:
      return 'block truncate text-[9px] font-medium text-indigo-50'
  }
}

/** Small chip on month calendar preview lines. */
export function posAppointmentMonthPreviewChipClass(tone: PosAppointmentVisualTone): string {
  const base = 'line-clamp-2 rounded border px-1 py-0.5 text-[9px] font-semibold leading-tight shadow-sm'
  switch (tone) {
    case 'completedPaid':
      return `${base} border-emerald-500/90 bg-emerald-100 text-emerald-950`
    case 'completedUnpaid':
      return `${base} border-amber-500/90 bg-amber-100 text-amber-950`
    case 'hold':
      return `${base} border-violet-500/90 bg-violet-100 text-violet-950`
    case 'inactive':
      return `${base} border-rose-500/90 bg-rose-100 text-rose-950`
    default:
      return `${base} border-indigo-400/90 bg-indigo-100 text-indigo-950`
  }
}

/** Human-readable duration between two ISO timestamps (for booking length). */
/** Comma-separated add-on names from `booking.addon_items_json`; em dash if none. */
export function formatBookingAddonSummary(addonItemsJson: unknown): string {
  const raw = Array.isArray(addonItemsJson) ? addonItemsJson : []
  const labels = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      return String(o.name ?? o.label ?? '').trim()
    })
    .filter(Boolean)
  return labels.length > 0 ? labels.join(', ') : '—'
}

export function formatDurationFromRange(startAt?: string | null, endAt?: string | null): string {
  if (!startAt || !endAt) return '—'
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/** Member name, or `Name (GUEST)` when the booking has no linked customer row. */
export function formatAppointmentCustomerDisplayName(detail: PosAppointmentDetail | null | undefined): string {
  const memberName = detail?.customer?.name?.trim()
  if (memberName && memberName !== '-') return memberName
  const displayName = detail?.customer_name?.trim()
  if (displayName && displayName !== '-') return displayName
  const guest = detail?.guest_name?.trim()
  if (guest) return `${guest} (GUEST)`
  return '—'
}

export function formatAppointmentCustomerContactLines(detail: PosAppointmentDetail | null | undefined): Array<{ label: string; value: string }> {
  const phone = detail?.customer?.phone?.trim() || detail?.customer_phone?.trim() || detail?.guest_phone?.trim() || ''
  const email = detail?.customer?.email?.trim() || detail?.customer_email?.trim() || detail?.guest_email?.trim() || ''
  const lines: Array<{ label: string; value: string }> = []

  if (phone) lines.push({ label: 'Phone', value: phone })
  if (email) lines.push({ label: 'Email', value: email })

  return lines
}

export function formatAppointmentReceiptDefaultEmail(detail: PosAppointmentDetail | null | undefined): string {
  return detail?.customer?.email?.trim() || detail?.customer_email?.trim() || detail?.guest_email?.trim() || ''
}
