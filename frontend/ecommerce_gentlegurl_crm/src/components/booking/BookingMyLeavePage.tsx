'use client'

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'

type LeaveType = 'annual' | 'mc' | 'emergency' | 'unpaid'
type DayType = 'full_day' | 'half_day_am' | 'half_day_pm'
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type RequestKind = 'new' | 'date_change'

type LeaveBalance = {
  leave_type: LeaveType
  entitled_days: number
  used_days: number
  remaining_days: number
}

type LeaveRequest = {
  id: number
  leave_type: LeaveType | 'off_day'
  request_kind?: RequestKind
  source_leave_request_id?: number | null
  source_leave_request?: {
    id: number
    start_date: string
    end_date: string
    leave_type: LeaveRequest['leave_type']
    status: LeaveStatus
    reason?: string | null
  } | null
  pending_date_change_request?: {
    id: number
    start_date: string
    end_date: string
    status: LeaveStatus
    change_reason?: string | null
  } | null
  date_change_pending?: boolean
  start_date: string
  end_date: string
  day_type: DayType
  days: number
  reason: string | null
  change_reason?: string | null
  status: LeaveStatus
  admin_remark: string | null
  created_at: string
}

const LEAVE_LABEL: Record<LeaveRequest['leave_type'], string> = {
  annual: 'Annual Leave',
  mc: 'Medical Leave (MC)',
  emergency: 'Emergency Leave',
  unpaid: 'Unpaid Leave',
  off_day: 'Off Day',
}

const DAY_TYPE_LABEL: Record<DayType, string> = {
  full_day: 'Full Day',
  half_day_am: 'Half Day (Morning)',
  half_day_pm: 'Half Day (Afternoon)',
}

const STATUS_CLASS: Record<LeaveStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-700',
}

const STATUS_FILTER_OPTIONS: { value: LeaveStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

type DateRangePreset = 'upcoming' | 'past' | 'all'

function buildMyLeaveRequestsQueryString(
  dateRange: DateRangePreset,
  status: LeaveStatus | 'all',
  leaveType: LeaveRequest['leave_type'] | 'all',
): string {
  const qs = new URLSearchParams()
  qs.set('per_page', '100')
  qs.set('date_range', dateRange)
  if (status !== 'all') qs.set('status', status)
  if (leaveType !== 'all') qs.set('leave_type', leaveType)
  return qs.toString()
}

const LEAVE_TYPE_FILTER_OPTIONS: { value: LeaveRequest['leave_type'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'annual', label: LEAVE_LABEL.annual },
  { value: 'mc', label: LEAVE_LABEL.mc },
  { value: 'emergency', label: LEAVE_LABEL.emergency },
  { value: 'unpaid', label: LEAVE_LABEL.unpaid },
  { value: 'off_day', label: LEAVE_LABEL.off_day },
]

const DATE_RANGE_OPTIONS: {
  value: DateRangePreset
  label: string
  /** One line — shown in list header on small screens */
  summaryLine: string
  description: string
}[] = [
  {
    value: 'upcoming',
    label: 'Upcoming',
    summaryLine: 'Leave that ends today or later',
    description: 'Server-side filter using app timezone (compares each request’s end date to today).',
  },
  {
    value: 'past',
    label: 'Past',
    summaryLine: 'Leave that already ended (end date before today)',
    description: 'History only — useful for reviewing old requests.',
  },
  {
    value: 'all',
    label: 'All dates',
    summaryLine: 'Every request (no date filter)',
    description: 'Shows all loaded rows regardless of start or end date.',
  },
]

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

const formatNumber = (value: number): string => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

/** ISO date string YYYY-MM-DD → readable (no UTC midnight shift) */
function formatIsoDate(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return ymd
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const toDateKey = (value: string) => value.slice(0, 10)

const todayDateKey = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const isSingleDayRange = (startDate: string, endDate: string) => toDateKey(startDate) === toDateKey(endDate)

function formatWeekdayLabel(value: string) {
  const d = new Date(`${toDateKey(value)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d)
}

function ModalSectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">{children}</p>
}

function ModalInfoCallout({
  tone = 'slate',
  title,
  children,
}: {
  tone?: 'slate' | 'violet' | 'amber' | 'emerald'
  title?: string
  children: ReactNode
}) {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone]

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? 'mt-1.5 text-xs leading-relaxed' : 'text-xs leading-relaxed'}>{children}</div>
    </div>
  )
}

function LeaveSummaryHeader({ row, badge }: { row: LeaveRequest; badge?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">{LEAVE_LABEL[row.leave_type]}</p>
          <p className="mt-1 text-sm text-slate-600">
            {DAY_TYPE_LABEL[row.day_type]} · {row.days.toFixed(2)} day(s)
          </p>
        </div>
        {badge ?? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_CLASS[row.status]}`}>
            {row.status}
          </span>
        )}
      </div>
    </div>
  )
}

function ScheduleDateBlock({
  label,
  startDate,
  endDate,
  dayType,
  tone = 'slate',
}: {
  label: string
  startDate: string
  endDate: string
  dayType?: DayType
  tone?: 'slate' | 'violet'
}) {
  const shellClass =
    tone === 'violet'
      ? 'border-violet-200 bg-violet-50 text-violet-900'
      : 'border-slate-200 bg-slate-50 text-slate-900'

  return (
    <div className={`rounded-xl border p-4 ${shellClass}`}>
      <ModalSectionLabel>{label}</ModalSectionLabel>
      <p className="mt-2 text-base font-semibold">
        {formatIsoDate(startDate)}
        {!isSingleDayRange(startDate, endDate) ? ` — ${formatIsoDate(endDate)}` : ''}
      </p>
      {isSingleDayRange(startDate, endDate) ? (
        <p className="mt-1 text-xs opacity-80">{formatWeekdayLabel(startDate)}</p>
      ) : null}
      {dayType ? <p className="mt-2 text-xs opacity-80">{DAY_TYPE_LABEL[dayType]}</p> : null}
    </div>
  )
}

function ScheduleCompare({
  currentStart,
  currentEnd,
  currentDayType,
  requestedStart,
  requestedEnd,
  requestedDayType,
}: {
  currentStart: string
  currentEnd: string
  currentDayType: DayType
  requestedStart: string
  requestedEnd: string
  requestedDayType: DayType
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <ScheduleDateBlock
          label="Current schedule"
          startDate={currentStart}
          endDate={currentEnd}
          dayType={currentDayType}
          tone="slate"
        />
        <div className="hidden text-center text-slate-400 md:block" aria-hidden>
          <i className="fa-solid fa-arrow-right-long text-lg" />
        </div>
        <div className="text-center text-xs font-medium text-violet-600 md:hidden" aria-hidden>
          Requested change
        </div>
        <ScheduleDateBlock
          label="Requested schedule"
          startDate={requestedStart}
          endDate={requestedEnd}
          dayType={requestedDayType}
          tone="violet"
        />
      </div>
    </div>
  )
}

function canRequestDateChange(row: LeaveRequest, allRequests: LeaveRequest[]) {
  if (row.status !== 'approved') return false
  if (row.request_kind === 'date_change') return false
  if (row.date_change_pending) return false
  if (toDateKey(row.end_date) < todayDateKey()) return false
  return !allRequests.some(
    (item) =>
      item.request_kind === 'date_change' &&
      item.status === 'pending' &&
      item.source_leave_request_id === row.id,
  )
}

export default function BookingMyLeavePage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [form, setForm] = useState({ leave_type: 'annual' as LeaveType, day_type: 'full_day' as DayType, start_date: '', end_date: '', reason: '' })

  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false)
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangePreset>('upcoming')
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('all')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveRequest['leave_type'] | 'all'>('all')

  const [draftDateRange, setDraftDateRange] = useState<DateRangePreset>('upcoming')
  const [draftStatus, setDraftStatus] = useState<LeaveStatus | 'all'>('all')
  const [draftLeaveType, setDraftLeaveType] = useState<LeaveRequest['leave_type'] | 'all'>('all')

  const [balanceLoading, setBalanceLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)

  const [dateChangeTarget, setDateChangeTarget] = useState<LeaveRequest | null>(null)
  const [viewChangeTarget, setViewChangeTarget] = useState<LeaveRequest | null>(null)
  const [dateChangeForm, setDateChangeForm] = useState({ start_date: '', end_date: '', change_reason: '' })
  const [dateChangeSaving, setDateChangeSaving] = useState(false)

  type ConfirmTarget =
    | { kind: 'cancel_leave'; row: LeaveRequest }
    | { kind: 'cancel_change'; row: LeaveRequest }

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const [confirmSaving, setConfirmSaving] = useState(false)

  const displayRequests = useMemo(
    () => requests.filter((row) => (row.request_kind ?? 'new') !== 'date_change'),
    [requests],
  )

  const isEmergency = form.leave_type === 'emergency'

  const openHistoryFilterModal = () => {
    setDraftDateRange(dateRangeFilter)
    setDraftStatus(statusFilter)
    setDraftLeaveType(leaveTypeFilter)
    setIsHistoryFilterOpen(true)
  }

  const closeHistoryFilterModal = () => {
    setIsHistoryFilterOpen(false)
  }

  const applyHistoryFilters = () => {
    setDateRangeFilter(draftDateRange)
    setStatusFilter(draftStatus)
    setLeaveTypeFilter(draftLeaveType)
    setIsHistoryFilterOpen(false)
  }

  const resetHistoryFilters = () => {
    setDraftDateRange('upcoming')
    setDraftStatus('all')
    setDraftLeaveType('all')
    setDateRangeFilter('upcoming')
    setStatusFilter('all')
    setLeaveTypeFilter('all')
    setIsHistoryFilterOpen(false)
  }

  const activeHistoryFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = []
    if (dateRangeFilter !== 'upcoming') {
      chips.push({
        key: 'date',
        label: dateRangeFilter === 'past' ? 'Past leave' : 'All dates',
        onRemove: () => setDateRangeFilter('upcoming'),
      })
    }
    if (statusFilter !== 'all') {
      chips.push({
        key: 'status',
        label: `Status: ${statusFilter}`,
        onRemove: () => setStatusFilter('all'),
      })
    }
    if (leaveTypeFilter !== 'all') {
      chips.push({
        key: 'type',
        label: `Type: ${LEAVE_LABEL[leaveTypeFilter]}`,
        onRemove: () => setLeaveTypeFilter('all'),
      })
    }
    return chips
  }, [dateRangeFilter, statusFilter, leaveTypeFilter])

  const loadBalances = useCallback(async () => {
    setBalanceLoading(true)
    try {
      const balanceRes = await fetch('/api/proxy/booking/my-leave/balances', { cache: 'no-store' })
      if (!balanceRes.ok) {
        setError('Failed to load leave balances.')
        return
      }
      setBalances(extractArray<LeaveBalance>(await balanceRes.json().catch(() => ({}))))
    } catch {
      setError('Failed to load leave balances.')
    } finally {
      setBalanceLoading(false)
    }
  }, [])

  const loadRequests = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const qs = buildMyLeaveRequestsQueryString(dateRangeFilter, statusFilter, leaveTypeFilter)
      const requestRes = await fetch(`/api/proxy/booking/my-leave/requests?${qs}`, { cache: 'no-store' })
      if (!requestRes.ok) {
        setError('Failed to load leave requests.')
        setRequests([])
        return
      }
      setRequests(extractArray<LeaveRequest>(await requestRes.json().catch(() => ({}))))
      setError(null)
    } catch {
      setError('Failed to load leave requests.')
      setRequests([])
    } finally {
      setHistoryLoading(false)
    }
  }, [dateRangeFilter, statusFilter, leaveTypeFilter])

  useEffect(() => {
    void loadBalances()
  }, [loadBalances])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const loadAll = useCallback(async () => {
    await Promise.all([loadBalances(), loadRequests()])
  }, [loadBalances, loadRequests])

  useEffect(() => {
    if (!isEmergency && form.day_type !== 'full_day') {
      setForm((prev) => ({ ...prev, day_type: 'full_day' }))
    }
  }, [form.day_type, isEmergency])

  const applyLeave = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('End date cannot be earlier than start date.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/proxy/booking/my-leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { message?: string }
        setError(payload.message ?? 'Failed to submit leave request.')
        return
      }

      setForm({ leave_type: 'annual', day_type: 'full_day', start_date: '', end_date: '', reason: '' })
      setIsApplyModalOpen(false)
      await loadAll()
    } finally {
      setSaving(false)
    }
  }

  const cancelRequest = async (id: number) => {
    const res = await fetch(`/api/proxy/booking/my-leave/requests/${id}/cancel`, { method: 'PATCH' })
    if (!res.ok) {
      setError('Failed to cancel leave request.')
      return false
    }
    return true
  }

  const cancelChangeRequest = async (row: LeaveRequest) => {
    const res = await fetch(`/api/proxy/booking/my-leave/requests/${row.id}/cancel-date-change`, { method: 'PATCH' })
    if (!res.ok) {
      setError('Failed to cancel day change request.')
      return false
    }
    return true
  }

  const openCancelLeaveConfirm = (row: LeaveRequest) => {
    setError(null)
    setConfirmTarget({ kind: 'cancel_leave', row })
  }

  const openCancelChangeConfirm = (row: LeaveRequest) => {
    setError(null)
    setConfirmTarget({ kind: 'cancel_change', row })
  }

  const closeConfirmModal = () => {
    if (confirmSaving) return
    setConfirmTarget(null)
  }

  const executeConfirm = async () => {
    if (!confirmTarget) return
    setConfirmSaving(true)
    setError(null)
    try {
      const ok =
        confirmTarget.kind === 'cancel_leave'
          ? await cancelRequest(confirmTarget.row.id)
          : await cancelChangeRequest(confirmTarget.row)
      if (!ok) return
      setConfirmTarget(null)
      await loadAll()
    } finally {
      setConfirmSaving(false)
    }
  }

  const actionButtonClass = (tone: 'neutral' | 'violet' | 'amber', compact: boolean) => {
    const base = compact
      ? 'inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition'
      : 'inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition'

    if (tone === 'violet') {
      return `${base} border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100`
    }
    if (tone === 'amber') {
      return `${base} border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100`
    }
    return `${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`
  }

  const openDateChangeModal = (row: LeaveRequest) => {
    setError(null)
    setDateChangeTarget(row)
    setDateChangeForm({
      start_date: '',
      end_date: '',
      change_reason: '',
    })
  }

  const openViewChangeModal = (row: LeaveRequest) => {
    setError(null)
    setViewChangeTarget(row)
  }

  const closeViewChangeModal = () => {
    setViewChangeTarget(null)
  }

  const closeDateChangeModal = () => {
    setError(null)
    setDateChangeTarget(null)
  }

  const submitDateChange = async () => {
    if (!dateChangeTarget) return
    setError(null)

    const startDate = dateChangeForm.start_date
    const endDate = isSingleDayRange(dateChangeTarget.start_date, dateChangeTarget.end_date)
      ? startDate
      : (dateChangeForm.end_date || startDate)

    if (!startDate || !endDate) {
      setError('Please select the new date(s).')
      return
    }

    if (startDate < todayDateKey()) {
      setError('You cannot move leave to a past date.')
      return
    }

    setDateChangeSaving(true)
    try {
      const res = await fetch(`/api/proxy/booking/my-leave/requests/${dateChangeTarget.id}/date-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          change_reason: dateChangeForm.change_reason || null,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { message?: string }
        setError(payload.message ?? 'Failed to submit day change request.')
        return
      }

      closeDateChangeModal()
      await loadAll()
    } finally {
      setDateChangeSaving(false)
    }
  }

  const renderStatusCell = (row: LeaveRequest) => (
    <div className="flex flex-col items-start gap-1">
      <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${STATUS_CLASS[row.status]}`}>
        {row.status}
      </span>
      {row.date_change_pending ? (
        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          Change pending
        </span>
      ) : null}
    </div>
  )

  const renderDateRangeCell = (row: LeaveRequest) => {
    const pending = row.pending_date_change_request
    return (
      <div>
        <div>
          {formatIsoDate(row.start_date)} — {formatIsoDate(row.end_date)}
        </div>
        {row.date_change_pending && pending ? (
          <div className="mt-2 rounded-md border border-violet-100 bg-violet-50/80 px-2 py-1.5 text-xs text-violet-900">
            <div className="font-semibold">Requested change:</div>
            <div className="mt-0.5">
              {formatIsoDate(pending.start_date)} — {formatIsoDate(pending.end_date)}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const renderRowActions = (row: LeaveRequest, compact = false) => {
    const wrapClass = compact ? 'inline-flex flex-wrap items-center gap-1' : 'flex w-full flex-col gap-2'

    if (row.status === 'pending') {
      return (
        <div className={wrapClass}>
          <button
            type="button"
            onClick={() => openCancelLeaveConfirm(row)}
            className={actionButtonClass('amber', compact)}
            aria-label="Cancel leave request"
          >
            <i className="fa-solid fa-ban text-[11px]" />
            {compact ? <span>Cancel</span> : <span>Cancel request</span>}
          </button>
        </div>
      )
    }

    if (row.date_change_pending && row.pending_date_change_request) {
      return (
        <div className={wrapClass}>
          <button
            type="button"
            onClick={() => openViewChangeModal(row)}
            className={actionButtonClass('neutral', compact)}
            aria-label="View day change request"
          >
            <i className="fa-regular fa-eye text-[11px]" />
            <span>View</span>
          </button>
          <button
            type="button"
            onClick={() => openCancelChangeConfirm(row)}
            className={actionButtonClass('violet', compact)}
            aria-label="Cancel day change request"
          >
            <i className="fa-solid fa-calendar-xmark text-[11px]" />
            <span>Cancel change</span>
          </button>
        </div>
      )
    }

    if (canRequestDateChange(row, displayRequests)) {
      return (
        <div className={wrapClass}>
          <button
            type="button"
            onClick={() => openDateChangeModal(row)}
            className={actionButtonClass('violet', compact)}
            aria-label="Request day change"
          >
            <i className="fa-solid fa-calendar-days text-[11px]" />
            <span>{compact ? 'Change' : 'Request day change'}</span>
          </button>
        </div>
      )
    }

    return compact ? <span className="text-slate-400">—</span> : null
  }

  const closeApplyModal = () => {
    setError(null)
    setIsApplyModalOpen(false)
  }

  return (
    <div className="space-y-6">
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeApplyModal} />
          <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Apply Leave</h2>
              </div>
              <button
                onClick={closeApplyModal}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
                type="button"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="p-5">
              {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

              <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={applyLeave}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={form.leave_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, leave_type: e.target.value as LeaveType }))}
                  >
                    <option value="annual">Annual Leave</option>
                    <option value="mc">Medical Leave (MC)</option>
                    <option value="emergency">Emergency Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day Type</label>
                  {isEmergency ? (
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={form.day_type}
                      onChange={(e) => setForm((prev) => ({ ...prev, day_type: e.target.value as DayType }))}
                    >
                      <option value="full_day">Full Day</option>
                      <option value="half_day_am">Half Day (Morning)</option>
                      <option value="half_day_pm">Half Day (Afternoon)</option>
                    </select>
                  ) : (
                    <input
                      className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      value="Full Day"
                      readOnly
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value, day_type: (prev.end_date && prev.end_date !== e.target.value) ? 'full_day' : prev.day_type }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value, day_type: (prev.start_date && prev.start_date !== e.target.value) ? 'full_day' : prev.day_type }))}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Reason"
                    value={form.reason}
                    onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-4 py-2 text-sm"
                    onClick={closeApplyModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>


                  
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {saving ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {dateChangeTarget && (
        <CrmFormModalShell
          title="Request Day Change"
          onClose={closeDateChangeModal}
          closeDisabled={dateChangeSaving}
          footer={
            <>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                onClick={closeDateChangeModal}
                disabled={dateChangeSaving}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void submitDateChange()}
                disabled={dateChangeSaving}
              >
                {dateChangeSaving ? 'Submitting…' : 'Submit for approval'}
              </button>
            </>
          }
        >
          <div className="space-y-4 p-5">
            <LeaveSummaryHeader row={dateChangeTarget} />

            <ScheduleDateBlock
              label="Current schedule"
              startDate={dateChangeTarget.start_date}
              endDate={dateChangeTarget.end_date}
              dayType={dateChangeTarget.day_type}
            />

            <ModalInfoCallout tone="slate" title="Before you submit">
              Your current approved dates stay blocked on the calendar until admin approves this change. Leave balance
              will not be adjusted. Past dates cannot be selected.
            </ModalInfoCallout>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            {isSingleDayRange(dateChangeTarget.start_date, dateChangeTarget.end_date) ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">New date</label>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  type="date"
                  min={todayDateKey()}
                  value={dateChangeForm.start_date}
                  onChange={(e) =>
                    setDateChangeForm((prev) => ({ ...prev, start_date: e.target.value, end_date: e.target.value }))
                  }
                />
                {dateChangeForm.start_date ? (
                  <p className="mt-1 text-xs text-slate-500">Weekday: {formatWeekdayLabel(dateChangeForm.start_date)}</p>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">New start date</label>
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    type="date"
                    min={todayDateKey()}
                    value={dateChangeForm.start_date}
                    onChange={(e) => setDateChangeForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">New end date</label>
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    type="date"
                    min={dateChangeForm.start_date || todayDateKey()}
                    value={dateChangeForm.end_date}
                    onChange={(e) => setDateChangeForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reason for change (optional)</label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows={2}
                placeholder="e.g. family matter, clinic appointment rescheduled"
                value={dateChangeForm.change_reason}
                onChange={(e) => setDateChangeForm((prev) => ({ ...prev, change_reason: e.target.value }))}
              />
            </div>
          </div>
        </CrmFormModalShell>
      )}

      {viewChangeTarget?.pending_date_change_request && (
        <CrmFormModalShell
          title="Day Change Details"
          onClose={closeViewChangeModal}
          footer={
            <>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={closeViewChangeModal}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-md border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100"
                onClick={() => {
                  closeViewChangeModal()
                  openCancelChangeConfirm(viewChangeTarget)
                }}
              >
                Cancel change
              </button>
            </>
          }
        >
          <div className="space-y-4 p-5 text-sm">
            <LeaveSummaryHeader
              row={viewChangeTarget}
              badge={
                <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  Change pending
                </span>
              }
            />

            <ScheduleCompare
              currentStart={viewChangeTarget.start_date}
              currentEnd={viewChangeTarget.end_date}
              currentDayType={viewChangeTarget.day_type}
              requestedStart={viewChangeTarget.pending_date_change_request.start_date}
              requestedEnd={viewChangeTarget.pending_date_change_request.end_date}
              requestedDayType={viewChangeTarget.day_type}
            />


            {viewChangeTarget.pending_date_change_request.change_reason ? (
              <div className="rounded-xl border border-slate-200 px-4 py-3">
                <ModalSectionLabel>Reason for change</ModalSectionLabel>
                <p className="mt-2 text-slate-800">{viewChangeTarget.pending_date_change_request.change_reason}</p>
              </div>
            ) : null}

            {viewChangeTarget.reason ? (
              <div className="rounded-xl border border-slate-200 px-4 py-3">
                <ModalSectionLabel>Original leave reason</ModalSectionLabel>
                <p className="mt-2 text-slate-800">{viewChangeTarget.reason}</p>
              </div>
            ) : null}
          </div>
        </CrmFormModalShell>
      )}

      {confirmTarget && (
        <CrmFormModalShell
          title={confirmTarget.kind === 'cancel_leave' ? 'Cancel Leave Request' : 'Cancel Day Change'}
          onClose={closeConfirmModal}
          closeDisabled={confirmSaving}
          footer={
            <>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                onClick={closeConfirmModal}
                disabled={confirmSaving}
              >
                Go back
              </button>
              <button
                type="button"
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  confirmTarget.kind === 'cancel_leave'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-violet-600 hover:bg-violet-700'
                }`}
                onClick={() => void executeConfirm()}
                disabled={confirmSaving}
              >
                {confirmSaving
                  ? 'Processing…'
                  : confirmTarget.kind === 'cancel_leave'
                    ? 'Cancel request'
                    : 'Cancel change'}
              </button>
            </>
          }
        >
          <div className="space-y-4 p-5 text-sm text-slate-700">
            {confirmTarget.kind === 'cancel_leave' ? (
              <>
                <p className="text-base text-slate-800">
                  Cancel this pending <span className="font-semibold">{LEAVE_LABEL[confirmTarget.row.leave_type]}</span>{' '}
                  request?
                </p>

                <ScheduleDateBlock
                  label="Requested dates"
                  startDate={confirmTarget.row.start_date}
                  endDate={confirmTarget.row.end_date}
                  dayType={confirmTarget.row.day_type}
                />

                <ModalInfoCallout tone="amber" title="What happens next">
                  The request will be marked as cancelled and removed from the approval queue. This does not affect any
                  leave that is already approved.
                </ModalInfoCallout>
              </>
            ) : (
              <>
                <p className="text-base text-slate-800">
                  Do you comfirm want cancel this day change request?
                </p>

                {confirmTarget.row.pending_date_change_request ? (
                  <ScheduleCompare
                    currentStart={confirmTarget.row.start_date}
                    currentEnd={confirmTarget.row.end_date}
                    currentDayType={confirmTarget.row.day_type}
                    requestedStart={confirmTarget.row.pending_date_change_request.start_date}
                    requestedEnd={confirmTarget.row.pending_date_change_request.end_date}
                    requestedDayType={confirmTarget.row.day_type}
                  />
                ) : null}

              </>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </CrmFormModalShell>
      )}

      {isHistoryFilterOpen && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeHistoryFilterModal} aria-hidden="true" />
          <div className="relative w-full max-w-lg rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Filter leave history</h2>
              <button
                type="button"
                onClick={closeHistoryFilterModal}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="max-h-[min(70vh,28rem)] space-y-5 overflow-y-auto p-5">
              <div>
                <span className="mb-3 block text-sm font-semibold text-slate-800">Date range</span>
                <p className="mb-3 text-xs leading-relaxed text-slate-500">
                  Choose what appears in your history list. This is sent to the server as{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.7rem] text-slate-700">date_range</code>.
                </p>
                <div className="grid gap-3" role="radiogroup" aria-label="Date range">
                  {DATE_RANGE_OPTIONS.map((opt) => {
                    const selected = draftDateRange === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setDraftDateRange(opt.value)}
                        className={`w-full rounded-xl border-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                          selected
                            ? 'border-blue-500 bg-blue-50/80 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                            }`}
                            aria-hidden
                          >
                            {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-semibold text-slate-900">{opt.label}</div>
                            <div className="mt-1 text-sm font-medium text-slate-700">{opt.summaryLine}</div>
                            <div className="mt-1.5 text-xs leading-relaxed text-slate-500">{opt.description}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="my-leave-modal-status" className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  id="my-leave-modal-status"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as LeaveStatus | 'all')}
                >
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="my-leave-modal-type" className="mb-1 block text-sm font-medium text-slate-700">
                  Leave type
                </label>
                <select
                  id="my-leave-modal-type"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={draftLeaveType}
                  onChange={(e) => setDraftLeaveType(e.target.value as LeaveRequest['leave_type'] | 'all')}
                >
                  {LEAVE_TYPE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={resetHistoryFilters}
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={closeHistoryFilterModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={applyHistoryFilters}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 min-h-[44px]"
          onClick={() => {
            setError(null)
            setIsApplyModalOpen(true)
          }}
          disabled={saving || balanceLoading}
        >
          <i className="fa-solid fa-plus" />
          Apply leave
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Leave Balance</h3>
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {balanceLoading && (
                <tr>
                  <td colSpan={2} className="px-2 py-4 text-center text-slate-500">
                    Loading balances…
                  </td>
                </tr>
              )}
              {!balanceLoading &&
                balances.map((row) => (
                  <tr key={row.leave_type} className="border-b border-slate-100">
                    <td className="px-2 py-2">{LEAVE_LABEL[row.leave_type]}</td>
                    <td className="px-2 py-2 font-medium text-slate-900">
                      {formatNumber(row.remaining_days)} / {formatNumber(row.entitled_days)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-3 md:hidden">
          {balanceLoading && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
              Loading balances…
            </p>
          )}
          {!balanceLoading &&
            balances.map((row) => (
              <div
                key={row.leave_type}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
              >
                <div className="text-sm font-semibold text-slate-900">{LEAVE_LABEL[row.leave_type]}</div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining</span>
                  <span className="text-lg font-bold tabular-nums text-slate-900">
                    {formatNumber(row.remaining_days)}
                    <span className="text-sm font-normal text-slate-500"> / {formatNumber(row.entitled_days)}</span>
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-600">
                  <span>Used</span>
                  <span className="tabular-nums">{formatNumber(row.used_days)}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">Leave Request History</h3>
            <div className="mt-3 md:hidden rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/90 to-white p-4">
              <div className="text-[0.65rem] font-bold uppercase tracking-wider text-blue-700/90">Date range</div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {DATE_RANGE_OPTIONS.find((o) => o.value === dateRangeFilter)?.label ?? dateRangeFilter}
              </div>
              <p className="mt-2 text-sm leading-snug text-slate-700">
                {DATE_RANGE_OPTIONS.find((o) => o.value === dateRangeFilter)?.summaryLine}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Tap <span className="font-semibold text-slate-700">Filter</span> to switch Past / All dates or narrow
                by status and type.
              </p>
            </div>
            <p className="mt-3 hidden text-xs text-slate-500 md:block">
              By default you see <span className="font-medium text-slate-700">upcoming</span> leave (end date on or after
              today). Open <span className="font-medium text-slate-700">Filter</span> to view past requests, all dates,
              or narrow by status and leave type.
            </p>
            {activeHistoryFilterChips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {activeHistoryFilterChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800"
                  >
                    {chip.label}
                    <button
                      type="button"
                      className="text-blue-600 hover:text-blue-900"
                      onClick={chip.onRemove}
                      aria-label={`Remove ${chip.label} filter`}
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 min-h-[44px] w-full sm:w-auto"
            onClick={openHistoryFilterModal}
            disabled={historyLoading}
          >
            <i className="fa-solid fa-filter" />
            Filter
          </button>
        </div>
        {!isApplyModalOpen && error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <div className="mt-3 hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Day Type</th>
                <th className="px-2 py-2">Date Range</th>
                <th className="px-2 py-2">Days</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Admin Remark</th>
                <th className="px-2 py-2 min-w-[9rem]">Action</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-slate-500">
                    Loading leave requests…
                  </td>
                </tr>
              )}
              {!historyLoading && displayRequests.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-slate-500">
                    No leave requests match the current filters (or none submitted yet). Open{' '}
                    <span className="font-medium">Filter</span> to try Past or All dates.
                  </td>
                </tr>
              )}
              {!historyLoading &&
                displayRequests.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{new Date(row.created_at).toLocaleDateString()}</td>
                    <td className="px-2 py-2">
                      <div>{LEAVE_LABEL[row.leave_type]}</div>
                    </td>
                    <td className="px-2 py-2">{DAY_TYPE_LABEL[row.day_type]}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{renderDateRangeCell(row)}</td>
                    <td className="px-2 py-2">{row.days.toFixed(2)}</td>
                    <td className="px-2 py-2">{renderStatusCell(row)}</td>
                    <td className="px-2 py-2">{row.admin_remark || '-'}</td>
                    <td className="px-2 py-2">{renderRowActions(row, true)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 space-y-3 md:hidden">
          {historyLoading && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
              Loading leave requests…
            </p>
          )}
          {!historyLoading && displayRequests.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-6 text-center text-sm text-slate-600">
              No leave requests match the current filters (or none submitted yet). Open{' '}
              <span className="font-semibold text-slate-800">Filter</span> to try Past or All dates.
            </div>
          )}
          {!historyLoading &&
            displayRequests.map((row) => (
              <div
                key={row.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-3">
                  {renderStatusCell(row)}
                  <span className="text-right text-xs text-slate-500">
                    Submitted {new Date(row.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Leave type</div>
                    <div className="mt-0.5 text-base font-semibold text-slate-900">{LEAVE_LABEL[row.leave_type]}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Dates</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">
                      {formatIsoDate(row.start_date)}
                      <span className="mx-1.5 font-normal text-slate-400">→</span>
                      {formatIsoDate(row.end_date)}
                    </div>
                    {row.date_change_pending && row.pending_date_change_request ? (
                      <div className="mt-2 rounded-md border border-violet-100 bg-violet-50/80 px-2 py-1.5 text-xs text-violet-900">
                        <div className="font-semibold">Requested change:</div>
                        <div className="mt-0.5">
                          {formatIsoDate(row.pending_date_change_request.start_date)} —{' '}
                          {formatIsoDate(row.pending_date_change_request.end_date)}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-slate-600">
                      {DAY_TYPE_LABEL[row.day_type]} · {row.days.toFixed(2)} day(s)
                    </div>
                  </div>
                  {row.admin_remark ? (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin remark</div>
                      <div className="mt-0.5 text-sm text-slate-700">{row.admin_remark}</div>
                    </div>
                  ) : null}
                  {renderRowActions(row, false)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
