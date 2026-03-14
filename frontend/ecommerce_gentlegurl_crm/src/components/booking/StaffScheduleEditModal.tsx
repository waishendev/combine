'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { StaffScheduleRowData } from './StaffScheduleRow'
import { mapStaffScheduleApiItemToRow, type StaffScheduleApiItem, type StaffOption } from './staffScheduleUtils'
import { useI18n } from '@/lib/i18n'

interface StaffScheduleEditModalProps {
  scheduleId: number
  onClose: () => void
  onSuccess: (schedule: StaffScheduleRowData) => void
}

interface FormState {
  staff_id: string
  day_of_week: string
  start_time: string
  end_time: string
  break_start: string
  break_end: string
}

const DAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const timeToMinutes = (time: string): number => {
  const [hour, minute] = time.split(':').map((v) => Number(v))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN
  return hour * 60 + minute
}

export default function StaffScheduleEditModal({
  scheduleId,
  onClose,
  onSuccess,
}: StaffScheduleEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({
    staff_id: '',
    day_of_week: '1',
    start_time: '10:00',
    end_time: '19:00',
    break_start: '',
    break_end: '',
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedSchedule, setLoadedSchedule] = useState<StaffScheduleRowData | null>(null)
  const [staffs, setStaffs] = useState<StaffOption[]>([])

  useEffect(() => {
    const controller = new AbortController()
    const fetchStaffs = async () => {
      try {
        const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const payload = await res.json().catch(() => ({}))
        const data = payload?.data
        if (Array.isArray(data)) {
          setStaffs(data as StaffOption[])
        } else if (data?.data && Array.isArray(data.data)) {
          setStaffs(data.data as StaffOption[])
        }
      } catch {
        // Ignore
      }
    }
    fetchStaffs()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadSchedule = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/booking/staff-schedules/${scheduleId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })

        const data = await res.json().catch(() => null)
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        if (!res.ok) {
          setError(data?.message || 'Failed to load schedule')
          return
        }

        const schedule = data?.data as StaffScheduleApiItem | undefined
        if (!schedule) {
          setError('Failed to load schedule')
          return
        }

        const staffNameMap = new Map(staffs.map(s => [s.id, s.name]))
        const mappedSchedule = mapStaffScheduleApiItemToRow(schedule, staffNameMap)
        setLoadedSchedule(mappedSchedule)

        setForm({
          staff_id: String(schedule.staff_id ?? ''),
          day_of_week: String(schedule.day_of_week ?? 1),
          start_time: schedule.start_time?.slice(0, 5) ?? '10:00',
          end_time: schedule.end_time?.slice(0, 5) ?? '19:00',
          break_start: schedule.break_start?.slice(0, 5) ?? '',
          break_end: schedule.break_end?.slice(0, 5) ?? '',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load schedule')
        }
      } finally {
        setLoading(false)
      }
    }

    loadSchedule()
    return () => controller.abort()
  }, [scheduleId, staffs])

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validate = (): string | null => {
    if (!form.staff_id) return 'Staff is required.'
    const startMin = timeToMinutes(form.start_time)
    const endMin = timeToMinutes(form.end_time)
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) {
      return 'Start and end time are required.'
    }
    if (startMin >= endMin) {
      return 'Start time must be earlier than end time.'
    }
    if ((form.break_start && !form.break_end) || (!form.break_start && form.break_end)) {
      return 'Break start/end must both be set, or both left empty.'
    }
    if (form.break_start && form.break_end) {
      const breakStartMin = timeToMinutes(form.break_start)
      const breakEndMin = timeToMinutes(form.break_end)
      if (!Number.isFinite(breakStartMin) || !Number.isFinite(breakEndMin)) {
        return 'Break times must be valid.'
      }
      if (breakStartMin >= breakEndMin) {
        return 'Break start must be earlier than break end.'
      }
      if (breakStartMin < startMin || breakEndMin > endMin) {
        return 'Break range must be within working hours.'
      }
    }
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/admin/booking/staff-schedules/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          staff_id: Number(form.staff_id),
          day_of_week: Number(form.day_of_week),
          start_time: form.start_time,
          end_time: form.end_time,
          break_start: form.break_start || null,
          break_end: form.break_end || null,
        }),
      })

      const data = await res.json().catch(() => null)
      if (data?.success === false && data?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      if (!res.ok) {
        setError(data?.message || 'Failed to update schedule')
        return
      }

      const payload = data?.data as StaffScheduleApiItem | undefined
      const staffNameMap = new Map(staffs.map(s => [s.id, s.name]))
      const scheduleRow: StaffScheduleRowData = payload
        ? mapStaffScheduleApiItemToRow(payload, staffNameMap)
        : {
            id: loadedSchedule?.id ?? scheduleId,
            staff_id: Number(form.staff_id),
            staff_name: staffs.find(s => s.id === Number(form.staff_id))?.name || `Staff #${form.staff_id}`,
            day_of_week: Number(form.day_of_week),
            start_time: form.start_time,
            end_time: form.end_time,
            break_start: form.break_start || null,
            break_end: form.break_end || null,
          }

      setLoadedSchedule(scheduleRow)
      onSuccess(scheduleRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = loading || submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Staff Schedule</h2>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label={t('common.close')}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
          ) : (
            <>
              <div>
                <label htmlFor="edit-staff_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Staff <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-staff_id"
                  name="staff_id"
                  value={form.staff_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="">Select staff</option>
                  {staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-day_of_week" className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-day_of_week"
                  name="day_of_week"
                  value={form.day_of_week}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  {DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-start_time" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-start_time"
                    name="start_time"
                    type="time"
                    value={form.start_time}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  />
                </div>
                <div>
                  <label htmlFor="edit-end_time" className="block text-sm font-medium text-gray-700 mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-end_time"
                    name="end_time"
                    type="time"
                    value={form.end_time}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-break_start" className="block text-sm font-medium text-gray-700 mb-1">
                    Break Start
                  </label>
                  <input
                    id="edit-break_start"
                    name="break_start"
                    type="time"
                    value={form.break_start}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  />
                </div>
                <div>
                  <label htmlFor="edit-break_end" className="block text-sm font-medium text-gray-700 mb-1">
                    Break End
                  </label>
                  <input
                    id="edit-break_end"
                    name="break_end"
                    type="time"
                    value={form.break_end}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
              onClick={() => {
                if (!submitting) onClose()
              }}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={disableForm}
            >
              {submitting ? t('common.saving') : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
