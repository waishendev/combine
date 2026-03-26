'use client'

import { useI18n } from '@/lib/i18n'

const DAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export interface StaffScheduleRowData {
  id: number
  staff_id: number
  staff_name: string
  day_of_week: number
  start_time: string
  end_time: string
  break_start: string | null
  break_end: string | null
}

interface StaffScheduleRowProps {
  schedule: StaffScheduleRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  showSelection?: boolean
  isSelected?: boolean
  onToggleSelect?: (schedule: StaffScheduleRowData, checked: boolean) => void
  onEdit?: (schedule: StaffScheduleRowData) => void
  onDelete?: (schedule: StaffScheduleRowData) => void
}

const formatDay = (day: number): string => DAYS.find((d) => d.value === day)?.label ?? String(day)

export default function StaffScheduleRow({
  schedule,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  showSelection = false,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
}: StaffScheduleRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      {showSelection && (
        <td className="px-4 py-2 border border-gray-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
            checked={isSelected}
            onChange={(event) => onToggleSelect?.(schedule, event.target.checked)}
            aria-label={`Select schedule ${schedule.id}`}
          />
        </td>
      )}
      <td className="px-4 py-2 border border-gray-200">{schedule.staff_name}</td>
      <td className="px-4 py-2 border border-gray-200">{formatDay(schedule.day_of_week)}</td>
      <td className="px-4 py-2 border border-gray-200">{schedule.start_time}</td>
      <td className="px-4 py-2 border border-gray-200">{schedule.end_time}</td>
      <td className="px-4 py-2 border border-gray-200">
        {schedule.break_start && schedule.break_end ? `${schedule.break_start} - ${schedule.break_end}` : '-'}
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(schedule)}
                aria-label={t('common.edit')}
                title={t('common.edit')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(schedule)}
                aria-label={t('common.delete')}
                title={t('common.delete')}
              >
                <i className="fa-solid fa-trash" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
