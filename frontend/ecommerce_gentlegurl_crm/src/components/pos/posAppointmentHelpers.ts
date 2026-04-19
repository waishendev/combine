import type { PosAppointmentListItem } from './posAppointmentTypes'

export type { PosAppointmentListItem as PosAppointmentRow } from './posAppointmentTypes'

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
  const start = new Date(startAt)
  if (!endAt) return start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const end = new Date(endAt)
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function formatDateTimeRange(startAt?: string | null, endAt?: string | null) {
  if (!startAt) return '-'
  const start = new Date(startAt)
  if (!endAt) return start.toLocaleString()
  return `${start.toLocaleString()} - ${new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/** Visual grouping for schedule blocks (month preview + day grid). */
export type PosAppointmentVisualTone = 'active' | 'hold' | 'completedPaid' | 'completedUnpaid' | 'inactive'

/**
 * Same “register paid” idea as the appointment detail Paid badge: not “package reserved, not finalised”
 * and no amount due.
 */
export function posAppointmentRegisterPaid(
  row: Pick<PosAppointmentListItem, 'amount_due_now' | 'balance_due' | 'package_status' | 'settlement_paid'>,
): boolean {
  const settlementPaid = Number(row.settlement_paid ?? 0)
  const pkg = String(row.package_status?.status ?? '').toLowerCase()
  const packageReservedPending = pkg === 'reserved' && settlementPaid <= 0.0001
  const due = Number(row.amount_due_now ?? row.balance_due ?? 0)
  return !packageReservedPending && due <= 0.0001
}

export function posAppointmentVisualToneFromRow(row: PosAppointmentListItem): PosAppointmentVisualTone {
  const s = String(row.status ?? '').toUpperCase()
  if (s === 'CANCELLED' || s === 'NO_SHOW' || s === 'LATE_CANCELLATION') return 'inactive'
  if (s === 'HOLD') return 'hold'
  if (s === 'COMPLETED') {
    return posAppointmentRegisterPaid(row) ? 'completedPaid' : 'completedUnpaid'
  }
  return 'active'
}

/** When only `status` is known (no payment fields); completed is shown as unpaid until row data loads. */
export function posAppointmentVisualTone(status: string | null | undefined): PosAppointmentVisualTone {
  const s = String(status ?? '').toUpperCase()
  if (s === 'COMPLETED') return 'completedUnpaid'
  if (s === 'HOLD') return 'hold'
  if (s === 'CANCELLED' || s === 'NO_SHOW' || s === 'LATE_CANCELLATION') return 'inactive'
  return 'active'
}

/** Tailwind classes for a day-grid appointment block button. */
export function posAppointmentDayBlockClass(tone: PosAppointmentVisualTone): string {
  const base =
    'absolute overflow-hidden rounded-md border-2 px-1 py-0.5 text-left text-[10px] font-semibold leading-tight shadow-md transition hover:z-10 focus:outline-none focus-visible:ring-2'
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
