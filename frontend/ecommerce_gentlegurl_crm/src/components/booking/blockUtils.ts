import type { BlockRowData } from './BlockRow'

export type BlockApiItem = {
  id: number | string
  scope?: 'STORE' | 'STAFF' | string | null
  staff_id?: number | string | null
  start_at?: string | null
  end_at?: string | null
  reason?: string | null
}

export type StaffOption = {
  id: number
  name: string
}

export const mapBlockApiItemToRow = (
  item: BlockApiItem,
  staffNameMap: Map<number, string>
): BlockRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const scope = (item.scope === 'STORE' || item.scope === 'STAFF') ? item.scope : 'STORE'
  const staffId = typeof item.staff_id === 'number' 
    ? item.staff_id 
    : (item.staff_id ? Number(item.staff_id) : null)

  const staffName = staffId ? (staffNameMap.get(staffId) || null) : null

  return {
    id: normalizedId,
    scope,
    staff_id: staffId,
    staff_name: staffName,
    start_at: item.start_at ?? '',
    end_at: item.end_at ?? '',
    reason: item.reason ?? null,
  }
}
