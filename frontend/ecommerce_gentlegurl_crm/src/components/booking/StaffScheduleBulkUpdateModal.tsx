'use client'

import { useMemo, useState } from 'react'

import type { StaffScheduleRowData } from './StaffScheduleRow'

interface StaffScheduleBulkUpdateModalProps {
  show: boolean
  selectedSchedules: StaffScheduleRowData[]
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

type FieldKey = 'start' | 'end' | 'break'

const FIELD_OPTIONS: Array<{ key: FieldKey; label: string }> = [
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'break', label: 'Break' },
]

const DAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function StaffScheduleBulkUpdateModal({
  show,
  selectedSchedules,
  onClose,
  onSuccess,
}: StaffScheduleBulkUpdateModalProps) {
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>([])
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('19:00')
  const [breakStart, setBreakStart] = useState('')
  const [breakEnd, setBreakEnd] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scheduleCountText = useMemo(
    () => `${selectedSchedules.length} schedule${selectedSchedules.length > 1 ? 's' : ''} selected`,
    [selectedSchedules.length],
  )

  const formatDay = (day: number): string => DAYS.find((item) => item.value === day)?.label ?? String(day)

  const toggleField = (field: FieldKey) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field],
    )
  }

  const handleSubmit = async () => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field to update.')
      return
    }

    if (selectedFields.includes('break')) {
      if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
        setError('Break start/end must both be set, or both left empty.')
        return
      }
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        ids: selectedSchedules.map((schedule) => schedule.id),
      }
      if (selectedFields.includes('start')) {
        payload.start_time = startTime
      }
      if (selectedFields.includes('end')) {
        payload.end_time = endTime
      }
      if (selectedFields.includes('break')) {
        payload.break_start = breakStart || null
        payload.break_end = breakEnd || null
      }

      const res = await fetch('/api/proxy/admin/booking/staff-schedules/bulk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const response = await res.json().catch(() => null)
        const message =
          response && typeof response === 'object' && 'message' in response && typeof response.message === 'string'
            ? response.message
            : 'Bulk update failed. Please retry.'
        setError(message)
        return
      }

      await onSuccess()
      onClose()
    } catch (submitError) {
      console.error(submitError)
      setError('Bulk update failed. Please retry.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Update Staff Schedules</h2>
            <p className="text-sm text-gray-500">{scheduleCountText}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close bulk update"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="border rounded p-2 bg-gray-50 max-h-[180px] overflow-y-auto text-sm text-gray-700">
          {selectedSchedules.map((schedule) => (
            <div key={schedule.id} className="mb-3 border-b border-gray-200 pb-2 last:border-none last:pb-0">
              <div className="font-medium text-gray-800">{schedule.staff_name}</div>
              <div className="text-xs text-gray-500">
                {formatDay(schedule.day_of_week)} • {schedule.start_time} - {schedule.end_time}
              </div>
              <div className="text-xs text-gray-500">
                Break: {schedule.break_start && schedule.break_end ? `${schedule.break_start} - ${schedule.break_end}` : '-'}
              </div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-md font-semibold text-gray-800 mb-3">
            Select Fields to Update <span className="text-gray-500">(you can choose more than one)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FIELD_OPTIONS.map((field) => {
              const isSelected = selectedFields.includes(field.key)
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => toggleField(field.key)}
                  className={`group flex items-center gap-3 p-4 rounded-xl border transition shadow-sm ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300'
                      : 'bg-white hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-white text-xs font-bold ${
                      isSelected ? 'bg-indigo-500' : 'bg-gray-300 group-hover:bg-gray-400'
                    }`}
                  >
                    ✓
                  </div>
                  <span className="text-sm font-medium text-gray-800">{field.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          {selectedFields.includes('start') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {selectedFields.includes('end') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {selectedFields.includes('break') && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Break Start</label>
                <input
                  type="time"
                  value={breakStart}
                  onChange={(event) => setBreakStart(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Break End</label>
                <input
                  type="time"
                  value={breakEnd}
                  onChange={(event) => setBreakEnd(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
