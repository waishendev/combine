'use client'

import { useI18n } from '@/lib/i18n'
import { formatTime12Hour } from '@/lib/formatDateTime'

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
  is_active: boolean
}

interface StaffScheduleRowProps {
  schedule: StaffScheduleRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  showSelection?: boolean
  isSelected?: boolean
  togglingStatus?: boolean
  onToggleSelect?: (schedule: StaffScheduleRowData, checked: boolean) => void
  onEdit?: (schedule: StaffScheduleRowData) => void
  onDelete?: (schedule: StaffScheduleRowData) => void
  onToggleStatus?: (schedule: StaffScheduleRowData) => void
}

const formatDay = (day: number): string => DAYS.find((d) => d.value === day)?.label ?? String(day)

export default function StaffScheduleRow({
  schedule,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  showSelection = false,
  isSelected = false,
  togglingStatus = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onToggleStatus,
}: StaffScheduleRowProps) {
  const { t } = useI18n()
  const rowClassName = schedule.is_active ? 'text-sm' : 'text-sm bg-slate-50 text-slate-500'
  return (
    <tr className={rowClassName}>
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
      <td className="px-4 py-2 border border-gray-200">{formatTime12Hour(schedule.start_time) || schedule.start_time || '—'}</td>
      <td className="px-4 py-2 border border-gray-200">{formatTime12Hour(schedule.end_time) || schedule.end_time || '—'}</td>
      <td className="px-4 py-2 border border-gray-200">
        {schedule.break_start && schedule.break_end
          ? `${formatTime12Hour(schedule.break_start) || schedule.break_start} - ${formatTime12Hour(schedule.break_end) || schedule.break_end}`
          : '-'}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              schedule.is_active
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {schedule.is_active ? 'Active' : 'Inactive'}
          </span>
          {canUpdate && onToggleStatus ? (
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
              onClick={() => onToggleStatus(schedule)}
              disabled={togglingStatus}
              title={schedule.is_active ? 'Set inactive for this day' : 'Set active for this day'}
            >
              {togglingStatus ? '…' : schedule.is_active ? 'Turn off' : 'Turn on'}
            </button>
          ) : null}
        </div>
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
