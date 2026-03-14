import type { StaffScheduleRowData } from './StaffScheduleRow'

export type StaffScheduleApiItem = {
  id: number | string
  staff_id?: number | string | null
  day_of_week?: number | string | null
  start_time?: string | null
  end_time?: string | null
  break_start?: string | null
  break_end?: string | null
}

export type StaffOption = {
  id: number
  name: string
}

export const mapStaffScheduleApiItemToRow = (
  item: StaffScheduleApiItem,
  staffNameMap: Map<number, string>
): StaffScheduleRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const staffId = typeof item.staff_id === 'number' 
    ? item.staff_id 
    : (item.staff_id ? Number(item.staff_id) : 0)

  const staffName = staffNameMap.get(staffId) || `Staff #${staffId}`

  return {
    id: normalizedId,
    staff_id: staffId,
    staff_name: staffName,
    day_of_week: typeof item.day_of_week === 'number' ? item.day_of_week : (item.day_of_week ? Number(item.day_of_week) : 0),
    start_time: item.start_time ?? '',
    end_time: item.end_time ?? '',
    break_start: item.break_start ?? null,
    break_end: item.break_end ?? null,
  }
}
