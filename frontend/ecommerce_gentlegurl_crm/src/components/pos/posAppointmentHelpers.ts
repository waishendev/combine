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
    }
  }

  return {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 0,
    total: 0,
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
export type PosAppointmentVisualTone = 'active' | 'completed' | 'inactive'

/** Map booking status to a tone: completed = green, cancelled/no-show/late = red, else indigo/active. */
export function posAppointmentVisualTone(status: string | null | undefined): PosAppointmentVisualTone {
  const s = String(status ?? '').toUpperCase()
  if (s === 'COMPLETED') return 'completed'
  if (s === 'CANCELLED' || s === 'NO_SHOW' || s === 'LATE_CANCELLATION') return 'inactive'
  return 'active'
}

/** Tailwind classes for a day-grid appointment block button. */
export function posAppointmentDayBlockClass(tone: PosAppointmentVisualTone): string {
  const base =
    'absolute overflow-hidden rounded-md border-2 px-1 py-0.5 text-left text-[10px] font-semibold leading-tight shadow-md transition hover:z-10 focus:outline-none focus-visible:ring-2'
  switch (tone) {
    case 'completed':
      return `${base} border-emerald-900 bg-emerald-600 text-white ring-1 ring-emerald-950/30 hover:bg-emerald-500 hover:ring-2 hover:ring-emerald-300 focus-visible:ring-emerald-300`
    case 'inactive':
      return `${base} border-rose-900 bg-rose-600 text-white ring-1 ring-rose-950/30 hover:bg-rose-500 hover:ring-2 hover:ring-rose-300 focus-visible:ring-rose-300`
    default:
      return `${base} border-indigo-900 bg-indigo-600 text-white ring-1 ring-indigo-950/30 hover:bg-indigo-500 hover:ring-2 hover:ring-amber-400 focus-visible:ring-amber-300`
  }
}

/** Muted line under time on day block (customer · service). */
export function posAppointmentDayBlockSubtextClass(tone: PosAppointmentVisualTone): string {
  switch (tone) {
    case 'completed':
      return 'block truncate text-[9px] font-medium text-emerald-50'
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
    case 'completed':
      return `${base} border-emerald-500/90 bg-emerald-100 text-emerald-950`
    case 'inactive':
      return `${base} border-rose-500/90 bg-rose-100 text-rose-950`
    default:
      return `${base} border-indigo-400/90 bg-indigo-100 text-indigo-950`
  }
}

/** Human-readable duration between two ISO timestamps (for booking length). */
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
