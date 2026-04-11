export type { PosAppointmentListItem as PosAppointmentRow } from './posAppointmentTypes'

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
