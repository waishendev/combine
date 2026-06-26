'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'

type LeaveType = 'annual' | 'mc' | 'emergency' | 'unpaid' | 'off_day'
type DayType = 'full_day' | 'half_day_am' | 'half_day_pm'

type UserRef = { id: number; name: string }

type LeaveRow = {
  id: number
  staff_id: number
  leave_type: LeaveType
  day_type: DayType
  start_date: string
  end_date: string
  reason: string | null
  status?: string
  staff?: { id: number; name: string }
  reviewer?: UserRef | null
  creation_log?: { creator?: UserRef | null } | null
}

type LeaveLogEntry = {
  id: number
  action_type: string
  remark: string | null
  created_at: string
  before_value: unknown
  after_value: unknown
  creator?: UserRef | null
}

type BookingLeaveCalendarPageProps = {
  permissions?: string[]
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

const LEAVE_DOT_CLASS: Record<LeaveType, string> = {
  annual: 'bg-blue-500',
  mc: 'bg-orange-500',
  emergency: 'bg-rose-500',
  unpaid: 'bg-violet-500',
  off_day: 'bg-slate-500',
}

const LEAVE_LABEL_SHORT: Record<LeaveType, string> = {
  annual: 'AL',
  mc: 'MC',
  emergency: 'Emer',
  unpaid: 'Unpaid',
  off_day: 'Off',
}

const WEEKDAY_HEADERS: Array<{ short: string; full: string }> = [
  { short: 'S', full: 'Sun' },
  { short: 'M', full: 'Mon' },
  { short: 'T', full: 'Tue' },
  { short: 'W', full: 'Wed' },
  { short: 'T', full: 'Thu' },
  { short: 'F', full: 'Fri' },
  { short: 'S', full: 'Sat' },
]

const formatCalendarLeaveLabel = (item: LeaveRow, compact = false): string => {
  const base = compact ? LEAVE_LABEL_SHORT[item.leave_type] : LEAVE_LABEL[item.leave_type]
  if (item.day_type === 'full_day') return base
  if (compact) {
    return item.day_type === 'half_day_am' ? `${base} AM` : `${base} PM`
  }
  return `${base} · ${DAY_TYPE_LABEL[item.day_type]}`
}

const DAY_TYPE_LABEL: Record<DayType, string> = {
  full_day: 'Full Day',
  half_day_am: 'Half Day (morning)',
  half_day_pm: 'Half Day (afternoon)',
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

const LOG_ACTION_LABEL: Record<string, string> = {
  created: 'Created',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  adjusted: 'Adjusted',
  updated: 'Updated',
}

const resolveCreatedBy = (item: LeaveRow): string => {
  if (item.reviewer?.name) return item.reviewer.name
  if (item.creation_log?.creator?.name) return item.creation_log.creator.name
  return '-'
}

const isSingleDayRange = (startDate: string, endDate: string): boolean => {
  const startKey = toBusinessDateKey(startDate)
  const endKey = toBusinessDateKey(endDate)
  return Boolean(startKey && endKey && startKey === endKey)
}

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const formatWeekdayLabel = (value: string): string => {
  const parsed = parseYmdLocal(value)
  if (!parsed) return '-'
  return WEEKDAY_OPTIONS[parsed.getDay()]?.label ?? '-'
}

const readLogDate = (value: unknown, key: string): string | null => {
  if (!value || typeof value !== 'object') return null
  const raw = (value as Record<string, unknown>)[key]
  if (typeof raw !== 'string') return null
  return toBusinessDateKey(raw) ?? raw.slice(0, 10)
}

const formatLogChange = (log: LeaveLogEntry): string => {
  const beforeStart = readLogDate(log.before_value, 'start_date')
  const beforeEnd = readLogDate(log.before_value, 'end_date')
  const afterStart = readLogDate(log.after_value, 'start_date')
  const afterEnd = readLogDate(log.after_value, 'end_date')

  if (beforeStart && afterStart && (beforeStart !== afterStart || beforeEnd !== afterEnd)) {
    const beforeText = beforeStart === beforeEnd ? beforeStart : `${beforeStart} → ${beforeEnd}`
    const afterText = afterStart === afterEnd ? afterStart : `${afterStart} → ${afterEnd}`
    return `${beforeText} → ${afterText}`
  }

  return log.remark ?? LOG_ACTION_LABEL[log.action_type] ?? log.action_type
}

const canManageOffDay = (item: LeaveRow, canUpdate: boolean): boolean =>
  canUpdate && item.leave_type === 'off_day' && (item.status ?? 'approved') === 'approved'

const monthToTargetValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

type GenerateOffDaysResponse = {
  created_count?: number
  skipped_count?: number
}

function WeekdayCheckboxGrid({
  selected,
  disabled = false,
  onChange,
}: {
  selected: number[]
  disabled?: boolean
  onChange: (days: number[]) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {WEEKDAY_OPTIONS.map((day) => {
        const checked = selected.includes(day.value)
        return (
          <label
            key={day.value}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              checked ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-emerald-600"
              checked={checked}
              disabled={disabled}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...selected, day.value].sort((a, b) => a - b)
                    : selected.filter((value) => value !== day.value),
                )
              }}
            />
            <span>{day.label}</span>
          </label>
        )
      })}
    </div>
  )
}

const formatGenerateSummary = (payload: GenerateOffDaysResponse): string => {
  const created = Number(payload.created_count ?? 0)
  const skipped = Number(payload.skipped_count ?? 0)
  if (created === 0 && skipped === 0) return 'No matching dates in the selected period.'
  const parts = [`Created ${created} off day(s).`]
  if (skipped > 0) parts.push(`${skipped} date(s) skipped (already booked).`)
  return parts.join(' ')
}

type PageToast = { id: string; message: string; title: string }

function LeaveCalendarSuccessPanel({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="rounded-xl border-2 border-emerald-400 bg-gradient-to-b from-emerald-50 to-white px-5 py-6 text-center shadow-sm ring-4 ring-emerald-100/80"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <i className="fa-solid fa-circle-check text-3xl" aria-hidden />
      </div>
      <p className="text-lg font-bold text-emerald-900">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-emerald-800">{message}</p>
    </div>
  )
}

function LeaveCalendarErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
      {message}
    </div>
  )
}

export default function BookingLeaveCalendarPage({ permissions = [] }: BookingLeaveCalendarPageProps) {
  const canUpdate = permissions.includes('booking.schedules.update')
  const now = new Date()
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [staffFilter, setStaffFilter] = useState('')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveType | ''>('')
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOffDayModalOpen, setIsOffDayModalOpen] = useState(false)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [isGenerateYearModalOpen, setIsGenerateYearModalOpen] = useState(false)
  const [offDayForm, setOffDayForm] = useState({ staff_id: '', start_date: '', end_date: '', reason: '' })
  const [generateForm, setGenerateForm] = useState({
    staff_id: '',
    target_month: monthToTargetValue(now),
    days_of_week: [] as number[],
  })
  const [generateYearForm, setGenerateYearForm] = useState({
    staff_id: '',
    target_year: String(now.getFullYear()),
    days_of_week: [] as number[],
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreatingOffDay, setIsCreatingOffDay] = useState(false)
  const [generateSummary, setGenerateSummary] = useState<string | null>(null)
  const [pageToasts, setPageToasts] = useState<PageToast[]>([])
  const [editingOffDay, setEditingOffDay] = useState<LeaveRow | null>(null)
  const [editOffDayForm, setEditOffDayForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [logsByRequestId, setLogsByRequestId] = useState<Record<number, LeaveLogEntry[]>>({})
  const [logsLoadingId, setLogsLoadingId] = useState<number | null>(null)
  const [expandedLogsId, setExpandedLogsId] = useState<number | null>(null)

  const dismissPageToast = useCallback((id: string) => {
    setPageToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushPageToast = useCallback((title: string, message: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    setPageToasts((prev) => [...prev, { id, title, message }].slice(-3))
    window.setTimeout(() => dismissPageToast(id), 7000)
  }, [dismissPageToast])

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

  const closeOffDayModal = () => {
    setError(null)
    setIsOffDayModalOpen(false)
  }

  const closeGenerateModal = () => {
    setError(null)
    setGenerateSummary(null)
    setIsGenerateModalOpen(false)
  }

  const closeGenerateYearModal = () => {
    setError(null)
    setGenerateSummary(null)
    setIsGenerateYearModalOpen(false)
  }

  const openGenerateModal = () => {
    setError(null)
    setGenerateSummary(null)
    setGenerateForm({
      staff_id: staffFilter || '',
      target_month: monthToTargetValue(month),
      days_of_week: [],
    })
    setIsGenerateModalOpen(true)
  }

  const openGenerateYearModal = () => {
    setError(null)
    setGenerateSummary(null)
    setGenerateYearForm({
      staff_id: staffFilter || '',
      target_year: String(month.getFullYear()),
      days_of_week: [],
    })
    setIsGenerateYearModalOpen(true)
  }

  const generateOffDaysFromWeeklySchedule = async () => {
    setError(null)
    setGenerateSummary(null)

    if (!generateForm.staff_id || !generateForm.target_month) {
      setError('Please select staff and target month.')
      return
    }

    if (generateForm.days_of_week.length === 0) {
      setError('Please select at least one weekday.')
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/off-days/generate-from-weekly-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: Number(generateForm.staff_id),
          target_month: generateForm.target_month,
          days_of_week: generateForm.days_of_week,
        }),
      })

      const root = await res.json().catch(() => ({})) as { data?: GenerateOffDaysResponse; message?: string }
      if (!res.ok) {
        setError(root.message ?? 'Failed to generate off days.')
        return
      }

      setGenerateSummary(formatGenerateSummary(root.data ?? {}))
      await loadRows()
    } catch {
      setError('Failed to generate off days.')
    } finally {
      setIsGenerating(false)
    }
  }

  const generateOffDaysFromYearSchedule = async () => {
    setError(null)
    setGenerateSummary(null)

    if (!generateYearForm.staff_id || !generateYearForm.target_year) {
      setError('Please select staff and target year.')
      return
    }

    if (generateYearForm.days_of_week.length === 0) {
      setError('Please select at least one weekday.')
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/off-days/generate-from-weekly-schedule-by-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: Number(generateYearForm.staff_id),
          target_year: Number(generateYearForm.target_year),
          days_of_week: generateYearForm.days_of_week,
        }),
      })

      const root = await res.json().catch(() => ({})) as { data?: GenerateOffDaysResponse; message?: string }
      if (!res.ok) {
        setError(root.message ?? 'Failed to generate off days.')
        return
      }

      setGenerateSummary(formatGenerateSummary(root.data ?? {}))
      await loadRows()
    } catch {
      setError('Failed to generate off days.')
    } finally {
      setIsGenerating(false)
    }
  }

  const loadOffDayLogs = async (leaveRequestId: number) => {
    setLogsLoadingId(leaveRequestId)
    try {
      const qs = new URLSearchParams()
      qs.set('leave_request_id', String(leaveRequestId))
      qs.set('per_page', '20')
      const res = await fetch(`/api/proxy/admin/booking/leave-logs?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setLogsByRequestId((prev) => ({ ...prev, [leaveRequestId]: [] }))
        return
      }
      const rows = extractArray<LeaveLogEntry>(await res.json().catch(() => ({})))
      setLogsByRequestId((prev) => ({ ...prev, [leaveRequestId]: rows }))
    } finally {
      setLogsLoadingId(null)
    }
  }

  const toggleOffDayLogs = async (leaveRequestId: number) => {
    if (expandedLogsId === leaveRequestId) {
      setExpandedLogsId(null)
      return
    }
    setExpandedLogsId(leaveRequestId)
    if (!logsByRequestId[leaveRequestId]) {
      await loadOffDayLogs(leaveRequestId)
    }
  }

  const openEditOffDay = (item: LeaveRow) => {
    setError(null)
    setEditingOffDay(item)
    const startKey = toBusinessDateKey(item.start_date) ?? ''
    const endKey = toBusinessDateKey(item.end_date) ?? startKey
    setEditOffDayForm({
      start_date: startKey,
      end_date: endKey,
      reason: item.reason ?? '',
    })
  }

  const closeEditOffDay = () => {
    setError(null)
    setEditingOffDay(null)
  }

  const saveEditOffDay = async () => {
    if (!editingOffDay) return
    setError(null)

    const startDate = editOffDayForm.start_date
    const endDate = isSingleDayRange(editingOffDay.start_date, editingOffDay.end_date)
      ? startDate
      : (editOffDayForm.end_date || startDate)

    if (!startDate || !endDate) {
      setError('Please select the new off day date(s).')
      return
    }

    setActionLoadingId(editingOffDay.id)
    try {
      const res = await fetch(`/api/proxy/admin/booking/off-days/${editingOffDay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          reason: editOffDayForm.reason || null,
        }),
      })
      const payload = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        setError(payload.message ?? 'Failed to update off day.')
        return
      }

      closeEditOffDay()
      setExpandedLogsId(null)
      setLogsByRequestId((prev) => {
        const next = { ...prev }
        delete next[editingOffDay.id]
        return next
      })
      await loadRows()
    } finally {
      setActionLoadingId(null)
    }
  }

  const cancelOffDay = async (item: LeaveRow) => {
    if (!window.confirm(`Cancel off day for ${item.staff?.name ?? `Staff #${item.staff_id}`} on ${formatDateRange(item.start_date, item.end_date)}?`)) {
      return
    }

    setError(null)
    setActionLoadingId(item.id)
    try {
      const res = await fetch(`/api/proxy/admin/booking/off-days/${item.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const payload = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        setError(payload.message ?? 'Failed to cancel off day.')
        return
      }

      setExpandedLogsId(null)
      setLogsByRequestId((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      await loadRows()
    } finally {
      setActionLoadingId(null)
    }
  }

  const createOffDay = async () => {
    setError(null)
    if (!offDayForm.staff_id || !offDayForm.start_date || !offDayForm.end_date) {
      setError('Please complete staff and date fields for Off Day.')
      return
    }

    const staffName = staffOptions.find((row) => String(row.staff_id) === offDayForm.staff_id)?.staff_name ?? 'Staff'
    const dateRange = formatDateRange(offDayForm.start_date, offDayForm.end_date)

    setIsCreatingOffDay(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/off-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: Number(offDayForm.staff_id),
          start_date: offDayForm.start_date,
          end_date: offDayForm.end_date,
          reason: offDayForm.reason || null,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { message?: string }
        setError(payload.message ?? 'Failed to create off day.')
        return
      }

      pushPageToast('Off day created', `${staffName} · ${dateRange}`)
      setOffDayForm({ staff_id: '', start_date: '', end_date: '', reason: '' })
      setIsOffDayModalOpen(false)
      await loadRows()
    } finally {
      setIsCreatingOffDay(false)
    }
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
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-3 px-4">
        {pageToasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-4 shadow-xl ring-4 ring-emerald-100"
            role="status"
            aria-live="polite"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <i className="fa-solid fa-circle-check text-xl" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-base font-bold text-emerald-900">{toast.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-emerald-800">{toast.message}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-emerald-700 transition hover:bg-emerald-100"
              aria-label="Dismiss notification"
              onClick={() => dismissPageToast(toast.id)}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        ))}
      </div>

      {isOffDayModalOpen && (
        <CrmFormModalShell
          title="Create Off Days"
          onClose={closeOffDayModal}
          closeDisabled={isCreatingOffDay}
          footer={
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeOffDayModal}
                disabled={isCreatingOffDay}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                onClick={createOffDay}
                disabled={isCreatingOffDay}
              >
                {isCreatingOffDay ? 'Creating…' : 'Create'}
              </button>
            </>
          }
        >
          <div className="space-y-3 p-5">
            <p className="text-xs text-slate-500">
              Off Day is admin-managed and blocks booking availability without deducting leave balance.
            </p>

            {error ? <LeaveCalendarErrorBanner message={error} /> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={offDayForm.staff_id}
                  onChange={(e) => setOffDayForm((prev) => ({ ...prev, staff_id: e.target.value }))}
                >
                  <option value="">Select Staff</option>
                  {staffOptions.map((row) => (
                    <option key={row.staff_id} value={row.staff_id}>
                      {row.staff_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  type="date"
                  value={offDayForm.start_date}
                  onChange={(e) => setOffDayForm((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  type="date"
                  value={offDayForm.end_date}
                  onChange={(e) => setOffDayForm((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Reason"
                  value={offDayForm.reason}
                  onChange={(e) => setOffDayForm((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </CrmFormModalShell>
      )}

      {isGenerateModalOpen && (
        <CrmFormModalShell
          title="Generate Monthly Off Days by Weekday"
          onClose={closeGenerateModal}
          closeDisabled={isGenerating}
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeGenerateModal}
                disabled={isGenerating}
              >
                {generateSummary ? 'Close' : 'Cancel'}
              </button>
              {!generateSummary && (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  onClick={generateOffDaysFromWeeklySchedule}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating…' : 'Generate'}
                </button>
              )}
              {generateSummary ? (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                  onClick={closeGenerateModal}
                >
                  Done
                </button>
              ) : null}
            </>
          }
        >
          <div className="space-y-3 p-5">
            {generateSummary ? (
              <LeaveCalendarSuccessPanel title="Generation complete" message={generateSummary} />
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Mark every selected weekday in the target month as off days for this staff.
                </p>

                {error ? <LeaveCalendarErrorBanner message={error} /> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={generateForm.staff_id}
                  onChange={(e) => setGenerateForm((prev) => ({ ...prev, staff_id: e.target.value }))}
                  disabled={isGenerating}
                >
                  <option value="">Select Staff</option>
                  {staffOptions.map((row) => (
                    <option key={row.staff_id} value={row.staff_id}>
                      {row.staff_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Target month</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  type="month"
                  value={generateForm.target_month}
                  onChange={(e) => setGenerateForm((prev) => ({ ...prev, target_month: e.target.value }))}
                  disabled={isGenerating}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Weekday(s)</label>
                <WeekdayCheckboxGrid
                  selected={generateForm.days_of_week}
                  disabled={isGenerating}
                  onChange={(days_of_week) => setGenerateForm((prev) => ({ ...prev, days_of_week }))}
                />
              </div>
            </div>
              </>
            )}
          </div>
        </CrmFormModalShell>
      )}

      {isGenerateYearModalOpen && (
        <CrmFormModalShell
          title="Generate Yearly Off Days by Weekday"
          onClose={closeGenerateYearModal}
          closeDisabled={isGenerating}
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeGenerateYearModal}
                disabled={isGenerating}
              >
                {generateSummary ? 'Close' : 'Cancel'}
              </button>
              {!generateSummary && (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  onClick={generateOffDaysFromYearSchedule}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating…' : 'Generate'}
                </button>
              )}
              {generateSummary ? (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                  onClick={closeGenerateYearModal}
                >
                  Done
                </button>
              ) : null}
            </>
          }
        >
          <div className="space-y-3 p-5">
            {generateSummary ? (
              <LeaveCalendarSuccessPanel title="Generation complete" message={generateSummary} />
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Mark every selected weekday across the full target year as off days for this staff. Existing off days on those dates are skipped.
                </p>

                {error ? <LeaveCalendarErrorBanner message={error} /> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={generateYearForm.staff_id}
                  onChange={(e) => setGenerateYearForm((prev) => ({ ...prev, staff_id: e.target.value }))}
                  disabled={isGenerating}
                >
                  <option value="">Select Staff</option>
                  {staffOptions.map((row) => (
                    <option key={row.staff_id} value={row.staff_id}>
                      {row.staff_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Target year</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  type="number"
                  min={2000}
                  max={2100}
                  value={generateYearForm.target_year}
                  onChange={(e) => setGenerateYearForm((prev) => ({ ...prev, target_year: e.target.value }))}
                  disabled={isGenerating}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Weekday(s)</label>
                <WeekdayCheckboxGrid
                  selected={generateYearForm.days_of_week}
                  disabled={isGenerating}
                  onChange={(days_of_week) => setGenerateYearForm((prev) => ({ ...prev, days_of_week }))}
                />
              </div>
            </div>
              </>
            )}
          </div>
        </CrmFormModalShell>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            onClick={() => { setError(null); setIsOffDayModalOpen(true) }}
            type="button"
          >
            <i className="fa-solid fa-plus" />
            Create Off Days
          </button>

          <button
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            onClick={openGenerateModal}
            type="button"
          >
            <i className="fa-solid fa-calendar-week" />
            Generate by Weekday
          </button>

          <button
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            onClick={openGenerateYearModal}
            type="button"
          >
            <i className="fa-solid fa-calendar-days" />
            Generate by Year
          </button>

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

      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:p-4">
        <div className="grid grid-cols-7 gap-0.5 text-[10px] font-medium text-slate-500 sm:gap-2 sm:text-xs">
          {WEEKDAY_HEADERS.map((day) => (
            <div key={day.full} className="px-0.5 py-1.5 text-center sm:px-1 sm:py-2">
              <span className="sm:hidden">{day.short}</span>
              <span className="hidden sm:inline">{day.full}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
          {calendarDays.map((cell, idx) => {
            if (!cell.date) {
              return <div key={`empty-${idx}`} className="min-h-[4.5rem] rounded border border-transparent sm:min-h-28" />
            }

            const key = formatDate(cell.date)
            const items = leaveByDate.get(key) ?? []
            const isSelected = selectedDate === key

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={`min-h-[4.5rem] overflow-hidden rounded border p-0.5 text-left transition sm:min-h-28 sm:p-1 ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-300'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`text-[10px] font-semibold sm:text-xs ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>
                  {cell.date.getDate()}
                </div>

                {/* Mobile: dots + short summary */}
                <div className="mt-1 sm:hidden">
                  {items.length > 0 && (
                    <>
                      <div className="flex flex-wrap items-center gap-0.5">
                        {items.slice(0, 4).map((item) => (
                          <span
                            key={`dot-${item.id}-${item.staff_id}`}
                            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${LEAVE_DOT_CLASS[item.leave_type]}`}
                            title={`${item.staff?.name ?? `Staff #${item.staff_id}`} · ${LEAVE_LABEL[item.leave_type]}`}
                          />
                        ))}
                        {items.length > 4 && (
                          <span className="text-[9px] leading-none text-slate-500">…</span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[9px] leading-tight text-slate-600">
                        {items.length === 1
                          ? `${items[0].staff?.name ?? 'Staff'} · ${formatCalendarLeaveLabel(items[0], true)}`
                          : `${items.length} records`}
                      </div>
                    </>
                  )}
                </div>

                {/* Desktop: compact cards with truncation */}
                <div className="mt-1 hidden space-y-1 overflow-hidden sm:block">
                  {items.slice(0, 2).map((item) => (
                    <div key={`${item.id}-${item.staff_id}`} className="overflow-hidden rounded border border-slate-200 bg-white px-1.5 py-1">
                      <div className="truncate text-[10px] font-semibold text-slate-900">
                        {item.staff?.name ?? `Staff #${item.staff_id}`}
                      </div>
                      <div className="mt-0.5 overflow-hidden">
                        <span
                          className={`block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${LEAVE_CLASS[item.leave_type]}`}
                          title={formatCalendarLeaveLabel(item)}
                        >
                          {formatCalendarLeaveLabel(item)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {items.length > 2 && (
                    <div className="truncate text-[10px] text-slate-500">+{items.length - 2} more</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Details for {selectedDate}</h4>
          </div>

          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

          <div className="mt-3 space-y-3 text-sm">
            {selectedItems.length === 0 && <p className="text-slate-500">No leave records on this date.</p>}
            {selectedItems.map((item) => {
              const logs = logsByRequestId[item.id] ?? []
              const showLogs = expandedLogsId === item.id
              const manageable = canManageOffDay(item, canUpdate)
              const isLoading = actionLoadingId === item.id

              return (
                <div
                  key={`detail-${item.id}-${item.staff_id}`}
                  className={`overflow-hidden rounded-lg border ${
                    manageable ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900">{item.staff?.name ?? `Staff #${item.staff_id}`}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateRange(item.start_date, item.end_date)}
                          {isSingleDayRange(item.start_date, item.end_date) ? ` · ${formatWeekdayLabel(item.start_date)}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          <span className="font-medium text-slate-500">Created by</span> {resolveCreatedBy(item)}
                        </div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium ${LEAVE_CLASS[item.leave_type]}`}>
                        {LEAVE_LABEL[item.leave_type]}
                        {item.day_type !== 'full_day' ? ` · ${DAY_TYPE_LABEL[item.day_type]}` : ''}
                      </span>
                    </div>

                    {item.reason && (
                      <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <span className="font-medium text-slate-500">Reason</span>
                        <div className="mt-0.5">{item.reason}</div>
                      </div>
                    )}
                  </div>

                  {manageable && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
                          onClick={() => void toggleOffDayLogs(item.id)}
                        >
                          <i className={`fa-solid ${showLogs ? 'fa-chevron-up' : 'fa-clock-rotate-left'} text-[11px]`} />
                          {showLogs ? 'Hide activity log' : 'Activity log'}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => openEditOffDay(item)}
                            disabled={isLoading}
                            title="Edit off day"
                          >
                            <i className="fa-solid fa-pen-to-square text-[11px]" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3.5 text-xs font-medium text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void cancelOffDay(item)}
                            disabled={isLoading}
                            title="Cancel off day"
                          >
                            <i className="fa-solid fa-ban text-[11px]" />
                            {isLoading ? 'Working…' : 'Cancel'}
                          </button>
                        </div>
                      </div>

                      {showLogs && (
                        <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                          {logsLoadingId === item.id && <p className="text-xs text-slate-500">Loading logs…</p>}
                          {!logsLoadingId && logs.length === 0 && <p className="text-xs text-slate-500">No activity yet.</p>}
                          {logs.map((log) => (
                            <div key={log.id} className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                                  {LOG_ACTION_LABEL[log.action_type] ?? log.action_type}
                                </span>
                                <span className="text-slate-500">
                                  {new Date(log.created_at).toLocaleString('en-MY', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="mt-1.5 text-slate-700">{formatLogChange(log)}</div>
                              <div className="mt-1 text-slate-500">By {log.creator?.name ?? '-'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editingOffDay && (
        <CrmFormModalShell
          title="Edit Off Day"
          onClose={closeEditOffDay}
          closeDisabled={actionLoadingId === editingOffDay.id}
          footer={
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeEditOffDay}
                disabled={actionLoadingId === editingOffDay.id}
              >
                Close
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void saveEditOffDay()}
                disabled={actionLoadingId === editingOffDay.id}
              >
                {actionLoadingId === editingOffDay.id ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="space-y-3 p-5">
            <p className="text-xs text-slate-500">
              Move this off day to another date. Pick a new date to change the weekday (e.g. Thursday → Tuesday).
            </p>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="font-medium text-slate-900">{editingOffDay.staff?.name ?? `Staff #${editingOffDay.staff_id}`}</div>
              <div className="mt-1 text-xs text-slate-600">
                Current: {formatDateRange(editingOffDay.start_date, editingOffDay.end_date)}
                {isSingleDayRange(editingOffDay.start_date, editingOffDay.end_date)
                  ? ` (${formatWeekdayLabel(editingOffDay.start_date)})`
                  : ''}
              </div>
            </div>

            {isSingleDayRange(editingOffDay.start_date, editingOffDay.end_date) ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New date</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  type="date"
                  value={editOffDayForm.start_date}
                  onChange={(e) => setEditOffDayForm((prev) => ({ ...prev, start_date: e.target.value, end_date: e.target.value }))}
                />
                {editOffDayForm.start_date && (
                  <p className="mt-1 text-xs text-slate-500">
                    Weekday: {formatWeekdayLabel(editOffDayForm.start_date)}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New start date</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    type="date"
                    value={editOffDayForm.start_date}
                    onChange={(e) => setEditOffDayForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New end date</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    type="date"
                    value={editOffDayForm.end_date}
                    onChange={(e) => setEditOffDayForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={editOffDayForm.reason}
                onChange={(e) => setEditOffDayForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
        </CrmFormModalShell>
      )}
    </div>
  )
}
