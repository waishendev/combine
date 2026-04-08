'use client'

import { useEffect, useMemo, useState } from 'react'

type LeaveType = 'annual' | 'mc' | 'emergency' | 'unpaid' | 'off_day'
type DayType = 'full_day' | 'half_day_am' | 'half_day_pm'

type LeaveRow = {
  id: number
  staff_id: number
  leave_type: LeaveType
  day_type: DayType
  start_date: string
  end_date: string
  reason: string | null
  staff?: { id: number; name: string }
}

type StaffOption = { staff_id: number; staff_name: string }

const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: 'Annual Leave',
  mc: 'MC',
  emergency: 'Emergency',
  unpaid: 'Unpaid',
  off_day: 'Off Day',
}

const LEAVE_CLASS: Record<LeaveType, string> = {
  annual: 'bg-blue-100 text-blue-700',
  mc: 'bg-orange-100 text-orange-700',
  emergency: 'bg-rose-100 text-rose-700',
  unpaid: 'bg-violet-100 text-violet-700',
  off_day: 'bg-slate-200 text-slate-700',
}

const extractArray = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  if (root.data && typeof root.data === 'object' && 'data' in root.data) {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) return nested as T[]
  }
  return []
}

const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/

const toBusinessDateKey = (value: string): string | null => {
  const matched = value.match(DATE_ONLY_PATTERN)
  if (!matched) return null
  return `${matched[1]}-${matched[2]}-${matched[3]}`
}

const parseYmdLocal = (value: string): Date | null => {
  const key = toBusinessDateKey(value)
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const formatDateRange = (startDate: string, endDate: string): string => {
  const startKey = toBusinessDateKey(startDate)
  const endKey = toBusinessDateKey(endDate)

  if (!startKey && !endKey) return '-'
  if (!startKey) return endKey ?? '-'
  if (!endKey) return startKey
  if (startKey === endKey) return startKey

  return `${startKey} → ${endKey}`
}


export default function BookingLeaveCalendarPage() {
  const now = new Date()
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [staffFilter, setStaffFilter] = useState('')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveType | ''>('')
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const loadStaffOptions = async () => {
    const res = await fetch('/api/proxy/admin/booking/leave-balances', { cache: 'no-store' })
    if (!res.ok) return
    setStaffOptions(extractArray<StaffOption>(await res.json().catch(() => ({}))))
  }

  const loadRows = async () => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)

    const qs = new URLSearchParams()
    qs.set('status', 'approved')
    qs.set('from_date', formatDate(monthStart))
    qs.set('to_date', formatDate(monthEnd))
    qs.set('per_page', '500')
    if (staffFilter) qs.set('staff_id', staffFilter)
    if (leaveTypeFilter) qs.set('leave_type', leaveTypeFilter)

    const res = await fetch(`/api/proxy/admin/booking/leave-requests?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      setRows([])
      return
    }

    setRows(extractArray<LeaveRow>(await res.json().catch(() => ({}))))
  }

  useEffect(() => {
    void loadStaffOptions()
  }, [])

  useEffect(() => {
    void loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, staffFilter, leaveTypeFilter])

  const calendarDays = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const firstDayOfWeek = start.getDay()
    const totalDays = end.getDate()

    const cells: Array<{ date: Date | null }> = []
    for (let i = 0; i < firstDayOfWeek; i += 1) cells.push({ date: null })
    for (let d = 1; d <= totalDays; d += 1) cells.push({ date: new Date(month.getFullYear(), month.getMonth(), d) })

    while (cells.length % 7 !== 0) cells.push({ date: null })
    return cells
  }, [month])

  const leaveByDate = useMemo(() => {
    const map = new Map<string, LeaveRow[]>()
    rows.forEach((row) => {
      const start = parseYmdLocal(row.start_date)
      const end = parseYmdLocal(row.end_date)
      if (!start || !end) return

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = formatDate(new Date(d))
        const list = map.get(key) ?? []
        list.push(row)
        map.set(key, list)
      }
    })
    return map
  }, [rows])

  const selectedItems = selectedDate ? (leaveByDate.get(selectedDate) ?? []) : []

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Staff</label>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="">All Staff</option>
              {staffOptions.map((s) => <option key={s.staff_id} value={s.staff_id}>{s.staff_name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Leave Type</label>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value as LeaveType | '')}>
              <option value="">All Types</option>
              {Object.entries(LEAVE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>Prev</button>
            <div className="min-w-40 text-center text-sm font-medium">{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</div>
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>Next</button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-2 text-xs font-medium text-slate-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="px-1 py-2 text-center">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((cell, idx) => {
            if (!cell.date) return <div key={`empty-${idx}`} className="min-h-28 rounded border border-transparent" />

            const key = formatDate(cell.date)
            const items = leaveByDate.get(key) ?? []

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className="min-h-28 rounded border border-slate-200 p-1 text-left hover:bg-slate-50"
              >
                <div className="text-xs font-semibold text-slate-700">{cell.date.getDate()}</div>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 3).map((item) => (
                    <div key={`${item.id}-${item.staff_id}`} className={`rounded px-1 py-0.5 text-[10px] ${LEAVE_CLASS[item.leave_type]}`}>
                      <span className="font-medium">{item.staff?.name ?? `#${item.staff_id}`}</span>
                      <span className="ml-1">{LEAVE_LABEL[item.leave_type]}</span>
                      {item.day_type !== 'full_day' && <span className="ml-1">{item.day_type === 'half_day_am' ? 'AM' : 'PM'}</span>}
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-slate-500">+{items.length - 3} more</div>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="font-semibold">Details for {selectedDate}</h4>
          <div className="mt-2 space-y-2 text-sm">
            {selectedItems.length === 0 && <p className="text-slate-500">No leave records on this date.</p>}
            {selectedItems.map((item) => (
              <div key={`detail-${item.id}-${item.staff_id}`} className="rounded border border-slate-200 p-2">
                <div className="font-medium">{item.staff?.name ?? `Staff #${item.staff_id}`}</div>
                <div className="text-slate-600">{LEAVE_LABEL[item.leave_type]} • {item.day_type === 'full_day' ? 'Full Day' : (item.day_type === 'half_day_am' ? 'Half Day (Morning)' : 'Half Day (Afternoon)')}</div>
                <div className="text-slate-500">{formatDateRange(item.start_date, item.end_date)}</div>
                {item.reason && <div className="text-slate-500">Reason: {item.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
