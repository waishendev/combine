import type { StaffScheduleRowData } from './StaffScheduleRow'

export type StaffScheduleApiItem = {
  id: number | string
  staff_id?: number | string | null
  staff?: { id?: number | string; name?: string | null } | null
  store_location_id?: number | string | null
  store_location?: { id: number; name: string; code?: string; is_active?: boolean; is_booking_available?: boolean } | null
  day_of_week?: number | string | null
  start_time?: string | null
  end_time?: string | null
  break_start?: string | null
  break_end?: string | null
  is_active?: boolean | number | string | null
}

export type StaffOption = {
  id: number
  name: string
}

/** Branch-scoped staff dropdown query (header Branch or form Branch). */
export function buildStaffOptionsQuery(params?: {
  branchId?: number | null
  perPage?: number
  isActive?: boolean
}): string {
  const qs = new URLSearchParams()
  qs.set('per_page', String(params?.perPage ?? 200))
  if (params?.isActive !== false) qs.set('is_active', 'true')
  // Specific Branch → only staff assigned there.
  // All Branches / no Branch → staff from the admin's accessible Branches only (never other Branches).
  if (params?.branchId != null && params.branchId > 0) {
    qs.set('branch_store_location_id', String(params.branchId))
  } else {
    qs.set('require_store_location', '1')
  }
  return qs.toString()
}

export function parseStaffOptionsPayload(payload: unknown): StaffOption[] {
  const root = payload && typeof payload === 'object' ? (payload as { data?: unknown }).data : null
  const rows = Array.isArray(root)
    ? root
    : root && typeof root === 'object' && Array.isArray((root as { data?: unknown }).data)
      ? (root as { data: unknown[] }).data
      : []
  return rows
    .map((row: unknown): StaffOption | null => {
      if (!row || typeof row !== 'object') return null
      const rec = row as Record<string, unknown>
      const id = Number(rec.id)
      const name = String(rec.name ?? '').trim()
      if (!id || !name) return null
      return { id, name }
    })
    .filter((row): row is StaffOption => Boolean(row))
}

export async function fetchStaffOptionsForBranch(
  branchId: number | null | undefined,
  options?: { signal?: AbortSignal; perPage?: number },
): Promise<StaffOption[]> {
  const qs = buildStaffOptionsQuery({ branchId: branchId ?? null, perPage: options?.perPage })
  const res = await fetch(`/api/proxy/staffs/options/query?${qs}`, {
    cache: 'no-store',
    signal: options?.signal,
  })
  if (!res.ok) return []
  const payload = await res.json().catch(() => null)
  return parseStaffOptionsPayload(payload)
}

/** Prefer field errors over a generic "Validation failed" message. */
export function formatApiValidationError(
  payload: unknown,
  fallback = 'Request failed.',
): string {
  if (!payload || typeof payload !== 'object') return fallback
  const data = payload as { message?: unknown; errors?: unknown }
  const errors = data.errors
  if (errors && typeof errors === 'object') {
    const messages = Object.values(errors as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
    if (messages.length > 0) return Array.from(new Set(messages)).join(' ')
  }
  if (typeof data.message === 'string' && data.message.trim()) {
    const message = data.message.trim()
    if (message.toLowerCase() !== 'validation failed') return message
  }
  return fallback
}

export const mapStaffScheduleApiItemToRow = (
  item: StaffScheduleApiItem,
  staffNameMap?: Map<number, string>
): StaffScheduleRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const staffId = typeof item.staff_id === 'number' 
    ? item.staff_id 
    : (item.staff_id ? Number(item.staff_id) : 0)

  const staffNameFromRelation =
    typeof item.staff?.name === 'string' && item.staff.name.trim()
      ? item.staff.name.trim()
      : null
  const staffName =
    staffNameFromRelation ||
    staffNameMap?.get(staffId) ||
    `Staff #${staffId}`

  const isActiveRaw = item.is_active
  const is_active =
    isActiveRaw === true ||
    isActiveRaw === 1 ||
    isActiveRaw === '1' ||
    isActiveRaw === 'true'

  return {
    id: normalizedId,
    staff_id: staffId,
    staff_name: staffName,
    store_location_id: item.store_location_id ? Number(item.store_location_id) : null,
    branch_name: item.store_location?.name ?? (item.store_location_id ? `Branch #${item.store_location_id}` : 'Legacy / unresolved'),
    branch_is_active: item.store_location?.is_active !== false,
    branch_is_booking_available: item.store_location?.is_booking_available === true,
    day_of_week: typeof item.day_of_week === 'number' ? item.day_of_week : (item.day_of_week ? Number(item.day_of_week) : 0),
    start_time: item.start_time ?? '',
    end_time: item.end_time ?? '',
    break_start: item.break_start ?? null,
    break_end: item.break_end ?? null,
    is_active,
  }
}
