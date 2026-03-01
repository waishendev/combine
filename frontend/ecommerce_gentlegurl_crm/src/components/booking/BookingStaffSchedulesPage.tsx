'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'

type StaffOption = {
  id: number
  name: string
}

type ScheduleRow = {
  id: number
  staff_id: number
  day_of_week: number
  start_time: string
  end_time: string
  break_start: string | null
  break_end: string | null
}

type Props = {
  permissions: string[]
}

type FormValues = {
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

const defaultForm: FormValues = {
  staff_id: '',
  day_of_week: '1',
  start_time: '10:00',
  end_time: '19:00',
  break_start: '13:00',
  break_end: '14:00',
}

const extractArray = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]

  if (root.data && typeof root.data === 'object' && 'data' in (root.data as object)) {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) return nested as T[]
  }

  return []
}

const timeToMinutes = (time: string): number => {
  const [hour, minute] = time.split(':').map((v) => Number(v))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN
  return hour * 60 + minute
}

const formatDay = (day: number): string => DAYS.find((d) => d.value === day)?.label ?? String(day)

export default function BookingStaffSchedulesPage({ permissions }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [staffFilter, setStaffFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleRow | null>(null)
  const [form, setForm] = useState<FormValues>(defaultForm)
  const [submitting, setSubmitting] = useState(false)

  const canCreate = permissions.includes('booking.schedules.create')
  const canUpdate = permissions.includes('booking.schedules.update')
  const canDelete = permissions.includes('booking.schedules.delete')

  const staffNameMap = useMemo(() => {
    const map = new Map<number, string>()
    staffs.forEach((staff) => map.set(staff.id, staff.name))
    return map
  }, [staffs])

  const loadStaffs = async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
      if (!res.ok) {
        setStaffs([])
        return
      }
      const payload = await res.json().catch(() => ({}))
      setStaffs(extractArray<StaffOption>(payload))
    } catch {
      setStaffs([])
    }
  }

  const loadSchedules = async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (staffFilter) qs.set('staff_id', staffFilter)

      const res = await fetch(`/api/proxy/admin/booking/staff-schedules?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setRows([])
        setError('Failed to load staff schedules.')
        return
      }

      const payload = await res.json().catch(() => ({}))
      let list = extractArray<ScheduleRow>(payload)
      if (staffFilter) {
        list = list.filter((row) => String(row.staff_id) === staffFilter)
      }

      setRows(list)
    } catch {
      setRows([])
      setError('Failed to load staff schedules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStaffs()
  }, [])

  useEffect(() => {
    void loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffFilter])

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (a.staff_id - b.staff_id) || (a.day_of_week - b.day_of_week) || a.start_time.localeCompare(b.start_time)),
    [rows],
  )

  const openCreate = () => {
    setEditing(null)
    setForm({ ...defaultForm, staff_id: staffFilter || '' })
    setModalOpen(true)
  }

  const openEdit = (row: ScheduleRow) => {
    setEditing(row)
    setForm({
      staff_id: String(row.staff_id),
      day_of_week: String(row.day_of_week),
      start_time: row.start_time?.slice(0, 5) ?? '10:00',
      end_time: row.end_time?.slice(0, 5) ?? '19:00',
      break_start: row.break_start?.slice(0, 5) ?? '',
      break_end: row.break_end?.slice(0, 5) ?? '',
    })
    setModalOpen(true)
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

  const submitForm = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        staff_id: Number(form.staff_id),
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        break_start: form.break_start || null,
        break_end: form.break_end || null,
      }

      const url = editing
        ? `/api/proxy/admin/booking/staff-schedules/${editing.id}`
        : '/api/proxy/admin/booking/staff-schedules'

      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const response = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        setError(response.message || 'Failed to save schedule.')
        return
      }

      setModalOpen(false)
      setEditing(null)
      setForm(defaultForm)
      await loadSchedules()
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (row: ScheduleRow) => {
    if (!canDelete) return
    if (!window.confirm(`Delete schedule for ${staffNameMap.get(row.staff_id) || `Staff #${row.staff_id}`} on ${formatDay(row.day_of_week)}?`)) return

    const res = await fetch(`/api/proxy/admin/booking/staff-schedules/${row.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const response = await res.json().catch(() => ({})) as { message?: string }
      setError(response.message || 'Failed to delete schedule.')
      return
    }

    await loadSchedules()
  }

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Staff Schedules</h2>
          <p className="mt-1 text-sm text-slate-500">Manage weekly staff schedules and break ranges.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={openCreate} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Add Schedule
          </button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="">All Staff</option>
            {staffs.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void loadSchedules()} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Break</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <TableLoadingRow colSpan={6} />}
            {!loading && sortedRows.length === 0 && <TableEmptyState colSpan={6} />}
            {!loading && sortedRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{staffNameMap.get(row.staff_id) || `#${row.staff_id}`}</td>
                <td className="px-4 py-3">{formatDay(row.day_of_week)}</td>
                <td className="px-4 py-3">{row.start_time}</td>
                <td className="px-4 py-3">{row.end_time}</td>
                <td className="px-4 py-3">{row.break_start && row.break_end ? `${row.break_start} - ${row.break_end}` : '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canUpdate && (
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => void remove(row)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">{editing ? 'Edit Schedule' : 'Create Schedule'}</h3>
            <div className="mt-4 grid gap-3">
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.staff_id}
                onChange={(e) => setForm((prev) => ({ ...prev, staff_id: e.target.value }))}
                disabled={Boolean(editing)}
              >
                <option value="">Select staff</option>
                {staffs.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.day_of_week}
                onChange={(e) => setForm((prev) => ({ ...prev, day_of_week: e.target.value }))}
              >
                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="time"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.start_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                />
                <input
                  type="time"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.end_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="time"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.break_start}
                  onChange={(e) => setForm((prev) => ({ ...prev, break_start: e.target.value }))}
                />
                <input
                  type="time"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.break_end}
                  onChange={(e) => setForm((prev) => ({ ...prev, break_end: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setModalOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => void submitForm()}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
