'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import type { StaffScheduleRowData } from './StaffScheduleRow'
import { mapStaffScheduleApiItemToRow, type StaffScheduleApiItem, type StaffOption } from './staffScheduleUtils'
import { useI18n } from '@/lib/i18n'
import { useBranch } from '@/contexts/BranchContext'

interface StaffScheduleCreateModalProps {
  onClose: () => void
  onSuccess: (schedules: StaffScheduleRowData[]) => void
  defaultStaffId?: string
  staffs?: StaffOption[]
}

interface FormState {
  staff_id: string
  store_location_id: string
  days_of_week: number[]
  start_time: string
  end_time: string
  break_start: string
  break_end: string
  is_active: boolean
}

/** Display Mon→Sun; values still match backend 0=Sun … 6=Sat. */
const DAYS: Array<{ value: number; label: string; short: string }> = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
]

const WEEKDAYS = [1, 2, 3, 4, 5]
const ALL_WEEK = [1, 2, 3, 4, 5, 6, 0]

const initialFormState: FormState = {
  staff_id: '',
  store_location_id: '',
  days_of_week: [1],
  start_time: '10:00',
  end_time: '19:00',
  break_start: '',
  break_end: '',
  is_active: true,
}

const timeToMinutes = (time: string): number => {
  const [hour, minute] = time.split(':').map((v) => Number(v))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN
  return hour * 60 + minute
}

const sameDaySet = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((value, index) => value === right[index])
}

export default function StaffScheduleCreateModal({
  onClose,
  onSuccess,
  defaultStaffId,
  staffs: staffsProp,
}: StaffScheduleCreateModalProps) {
  const { t } = useI18n()
  const { accessibleBranches, selectedBranchId } = useBranch()
  const [form, setForm] = useState<FormState>({
    ...initialFormState,
    staff_id: defaultStaffId || '',
    store_location_id: selectedBranchId ? String(selectedBranchId) : '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staffsLocal, setStaffsLocal] = useState<StaffOption[]>([])
  const staffs = staffsProp && staffsProp.length > 0 ? staffsProp : staffsLocal
  const selectedBranch = accessibleBranches.find((branch) => branch.id === Number(form.store_location_id))

  const selectedDayCount = form.days_of_week.length
  const selectedDayLabels = useMemo(
    () => DAYS.filter((day) => form.days_of_week.includes(day.value)).map((day) => day.short).join(', '),
    [form.days_of_week],
  )

  useEffect(() => {
    if (selectedBranchId) setForm((current) => current.store_location_id ? current : { ...current, store_location_id: String(selectedBranchId) })
  }, [selectedBranchId])

  useEffect(() => {
    if (selectedBranch && !selectedBranch.is_booking_available) {
      setForm((current) => current.is_active ? { ...current, is_active: false } : current)
    }
  }, [selectedBranch])

  useEffect(() => {
    if (staffsProp && staffsProp.length > 0) return
    const controller = new AbortController()
    // NEW ENHANCEMENT — booking-packages-schedules-crm-query-v1: slim staff options fallback
    const fetchStaffs = async () => {
      try {
        const res = await fetch('/api/proxy/staffs/options/query?per_page=200&is_active=true', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const payload = await res.json().catch(() => ({}))
        const data = payload?.data
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : []
        setStaffsLocal(
          rows
            .map((row: unknown): StaffOption | null => {
              if (!row || typeof row !== 'object') return null
              const rec = row as Record<string, unknown>
              const id = Number(rec.id)
              const name = String(rec.name ?? '').trim()
              if (!id || !name) return null
              return { id, name }
            })
            .filter((row: StaffOption | null): row is StaffOption => Boolean(row)),
        )
      } catch {
        // Ignore
      }
    }
    fetchStaffs()
    return () => controller.abort()
  }, [staffsProp])

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target
    const checked = type === 'checkbox' ? (event.target as HTMLInputElement).checked : undefined
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const exists = prev.days_of_week.includes(day)
      const nextDays = exists
        ? prev.days_of_week.filter((value) => value !== day)
        : [...prev.days_of_week, day]
      return { ...prev, days_of_week: nextDays }
    })
  }

  const applyDayPreset = (days: number[]) => {
    setForm((prev) => ({ ...prev, days_of_week: [...days] }))
  }

  const validate = (): string | null => {
    if (!form.staff_id) return 'Staff is required.'
    if (!form.store_location_id) return 'A specific Branch is required; All Branches cannot be saved.'
    if (!selectedBranch) return 'Select a Branch you are authorized to access.'
    if (form.days_of_week.length === 0) return 'Select at least one day of the week.'
    if (form.is_active && (!selectedBranch.is_active || !selectedBranch.is_booking_available)) return 'Active schedules require an active, booking-enabled Branch.'
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
      const res = await fetch('/api/proxy/admin/booking/staff-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          staff_id: Number(form.staff_id),
          store_location_id: Number(form.store_location_id),
          days_of_week: form.days_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
          break_start: form.break_start || null,
          break_end: form.break_end || null,
          is_active: form.is_active,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        let message = 'Failed to create schedule'
        if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
          message = data.message
        } else if (data?.errors && typeof data.errors === 'object') {
          const first = Object.values(data.errors as Record<string, string[]>)[0]
          if (Array.isArray(first) && typeof first[0] === 'string') message = first[0]
        }
        setError(message)
        return
      }

      const staffNameMap = new Map(staffs.map((s) => [s.id, s.name]))
      const payloadRoot = data?.data
      let scheduleRows: StaffScheduleRowData[] = []

      if (payloadRoot && typeof payloadRoot === 'object' && Array.isArray((payloadRoot as { items?: unknown }).items)) {
        scheduleRows = ((payloadRoot as { items: StaffScheduleApiItem[] }).items).map((item) =>
          mapStaffScheduleApiItemToRow(item, staffNameMap),
        )
      } else if (payloadRoot && typeof payloadRoot === 'object' && 'id' in (payloadRoot as object)) {
        scheduleRows = [mapStaffScheduleApiItemToRow(payloadRoot as StaffScheduleApiItem, staffNameMap)]
      } else {
        scheduleRows = form.days_of_week.map((day) => ({
          id: 0,
          staff_id: Number(form.staff_id),
          store_location_id: Number(form.store_location_id),
          branch_name: accessibleBranches.find((b) => b.id === Number(form.store_location_id))?.name || `Branch #${form.store_location_id}`,
          branch_is_active: true,
          branch_is_booking_available: true,
          staff_name: staffs.find((s) => s.id === Number(form.staff_id))?.name || `Staff #${form.staff_id}`,
          day_of_week: day,
          start_time: form.start_time,
          end_time: form.end_time,
          break_start: form.break_start || null,
          break_end: form.break_end || null,
          is_active: form.is_active,
        }))
      }

      setForm({ ...initialFormState })
      onSuccess(scheduleRows)
    } catch (err) {
      console.error(err)
      setError('Failed to create schedule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CrmFormModalShell
      title="Create Staff Schedule"
      size="lg"
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel={t('common.close')}
      footer={
        <>
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
            form="staff-schedule-create-form"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting
              ? t('common.creating')
              : selectedDayCount > 1
                ? `Create ${selectedDayCount} days`
                : t('common.create')}
          </button>
        </>
      }
    >
      <form id="staff-schedule-create-form" onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="staff_id" className="block text-sm font-medium text-gray-700 mb-1">
              Staff <span className="text-red-500">*</span>
            </label>
            <select
              id="staff_id"
              name="staff_id"
              value={form.staff_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting}
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
            <label htmlFor="store_location_id" className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
            <select id="store_location_id" name="store_location_id" value={form.store_location_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" disabled={submitting}>
              <option value="">Select a specific Branch</option>
              {accessibleBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{!branch.is_booking_available ? ' — Booking unavailable' : ''}</option>)}
            </select>
            {selectedBranch && !selectedBranch.is_booking_available && (
              <p className="mt-1 text-xs text-amber-700" role="status">
                This Branch is currently unavailable for booking. The schedule will be saved as inactive.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-gray-700">
                Days of Week <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyDayPreset(WEEKDAYS)}
                  disabled={submitting}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    sameDaySet(form.days_of_week, WEEKDAYS)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Mon–Fri
                </button>
                <button
                  type="button"
                  onClick={() => applyDayPreset(ALL_WEEK)}
                  disabled={submitting}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    sameDaySet(form.days_of_week, ALL_WEEK)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Mon–Sun
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {DAYS.map((day) => {
                const selected = form.days_of_week.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    disabled={submitting}
                    aria-pressed={selected}
                    className={`rounded-xl border px-2 py-2.5 text-center transition ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-300'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{day.short}</span>
                    <span className="mt-0.5 block text-[10px] text-gray-500 sm:hidden">{day.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {selectedDayCount === 0
                ? 'Select one or more days. Same hours/break will apply to each selected day.'
                : `Creating ${selectedDayCount} day${selectedDayCount > 1 ? 's' : ''}: ${selectedDayLabels}`}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                id="start_time"
                name="start_time"
                type="time"
                value={form.start_time}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                id="end_time"
                name="end_time"
                type="time"
                value={form.end_time}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="break_start" className="block text-sm font-medium text-gray-700 mb-1">
                Break Start
              </label>
              <input
                id="break_start"
                name="break_start"
                type="time"
                value={form.break_start}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="break_end" className="block text-sm font-medium text-gray-700 mb-1">
                Break End
              </label>
              <input
                id="break_end"
                name="break_end"
                type="time"
                value={form.break_end}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">Optional — leave both empty if there is no break.</p>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              disabled={submitting || Boolean(selectedBranch && !selectedBranch.is_booking_available)}
            />
            <span>
              Active — staff can be booked on these days when status is on
            </span>
          </label>

        {error && (
          <div className="text-sm text-red-600" role="alert">
            {error}
          </div>
        )}
      </form>
    </CrmFormModalShell>
  )
}
