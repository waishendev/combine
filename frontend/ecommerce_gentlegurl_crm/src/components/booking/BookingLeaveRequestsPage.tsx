'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'

import CrmFilterModalShell from '@/components/CrmFilterModalShell'
import CrmFormModalShell from '@/components/CrmFormModalShell'

import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import PaginationControls from '../PaginationControls'

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type DayType = 'full_day' | 'half_day_am' | 'half_day_pm'
type RequestKind = 'new' | 'date_change'

type LeaveRow = {
  id: number
  staff_id: number
  leave_type: 'annual' | 'mc' | 'emergency' | 'unpaid' | 'off_day'
  request_kind?: RequestKind
  source_leave_request_id?: number | null
  source_leave_request?: {
    id: number
    leave_type: LeaveRow['leave_type']
    start_date: string
    end_date: string
    status: LeaveStatus
    day_type: DayType
    days: number
    reason?: string | null
  } | null
  day_type: DayType
  start_date: string
  end_date: string
  days: number
  status: LeaveStatus
  reason: string | null
  change_reason?: string | null
  admin_remark: string | null
  staff?: { id: number; name: string }
}

type StaffOption = { staff_id: number; staff_name: string }

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const LEAVE_LABEL: Record<LeaveRow['leave_type'], string> = {
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

const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const STATUS_BADGE: Record<LeaveStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-700',
}

const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  new: 'New request',
  date_change: 'Day change',
}

const REQUEST_KIND_BADGE: Record<RequestKind, string> = {
  new: 'bg-slate-100 text-slate-700',
  date_change: 'bg-violet-100 text-violet-700',
}

const formatDate = (value: string) => {
  const key = value.slice(0, 10)
  const d = new Date(`${key}T12:00:00`)
  if (Number.isNaN(d.getTime())) return key
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const isSingleDayRange = (startDate: string, endDate: string) =>
  startDate.slice(0, 10) === endDate.slice(0, 10)

function formatWeekdayLabel(value: string) {
  const key = value.slice(0, 10)
  const d = new Date(`${key}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d)
}

/** Table shows the latest reason only; full context lives in the review modal. */
function getTableReason(row: LeaveRow): string | null {
  if (row.request_kind === 'date_change') {
    return row.change_reason?.trim() || row.reason?.trim() || null
  }
  return row.reason?.trim() || null
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

function ReviewSummaryHeader({ row, requestKind }: { row: LeaveRow; requestKind: RequestKind }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">
            {row.staff?.name ?? `Staff #${row.staff_id}`}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {LEAVE_LABEL[row.leave_type]} · {DAY_TYPE_LABEL[row.day_type]} · {row.days.toFixed(2)} day(s)
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${REQUEST_KIND_BADGE[requestKind]}`}
        >
          {REQUEST_KIND_LABEL[requestKind]}
        </span>
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
  dayType: DayType
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
        {formatDate(startDate)}
        {!isSingleDayRange(startDate, endDate) ? ` — ${formatDate(endDate)}` : ''}
      </p>
      {isSingleDayRange(startDate, endDate) ? (
        <p className="mt-1 text-xs opacity-80">{formatWeekdayLabel(startDate)}</p>
      ) : null}
      <p className="mt-2 text-xs opacity-80">{DAY_TYPE_LABEL[dayType]}</p>
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
    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <ScheduleDateBlock
        label="Original schedule"
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
  )
}

function ReasonReviewBlock({
  originalReason,
  changeReason,
}: {
  originalReason?: string | null
  changeReason?: string | null
}) {
  const hasOriginal = Boolean(originalReason?.trim())
  const hasChange = Boolean(changeReason?.trim())

  if (!hasOriginal && !hasChange) {
    return (
      <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
        No reason provided.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {hasOriginal ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <ModalSectionLabel>Original leave reason</ModalSectionLabel>
          <p className="mt-2 text-sm text-slate-800">{originalReason}</p>
        </div>
      ) : null}
      {hasChange ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <ModalSectionLabel>Reason for change</ModalSectionLabel>
          <p className="mt-2 text-sm text-violet-900">{changeReason}</p>
        </div>
      ) : null}
    </div>
  )
}

const extractPaginated = <T,>(payload: unknown): { rows: T[]; meta: PaginationMeta } => {
  const emptyMeta: PaginationMeta = { current_page: 1, last_page: 1, per_page: 50, total: 0 }
  if (!payload || typeof payload !== 'object') return { rows: [], meta: emptyMeta }

  const root = payload as { data?: unknown; meta?: unknown; success?: boolean; message?: string }
  const metaFromResponse = root.meta && typeof root.meta === 'object' ? (root.meta as Partial<PaginationMeta>) : {}

  if (Array.isArray(root.data)) {
    const rows = root.data as T[]
    const total = Number(metaFromResponse.total ?? rows.length) || rows.length
    const per_page = Number(metaFromResponse.per_page ?? 50) || 50
    const last_page = Number(metaFromResponse.last_page ?? Math.max(1, Math.ceil(total / per_page))) || 1
    const current_page = Number(metaFromResponse.current_page ?? 1) || 1
    return {
      rows,
      meta: { current_page, last_page, per_page, total },
    }
  }

  if (root.data && typeof root.data === 'object' && 'data' in root.data) {
    const nested = root.data as {
      data?: unknown
      current_page?: number
      last_page?: number
      per_page?: number
      total?: number
    }
    const rows = Array.isArray(nested.data) ? (nested.data as T[]) : []
    const total = Number(metaFromResponse.total ?? nested.total ?? rows.length) || rows.length
    const per_page = Number(metaFromResponse.per_page ?? nested.per_page ?? 50) || 50
    const last_page = Number(metaFromResponse.last_page ?? nested.last_page ?? Math.max(1, Math.ceil(total / per_page))) || 1
    const current_page = Number(metaFromResponse.current_page ?? nested.current_page ?? 1) || 1
    return {
      rows,
      meta: { current_page, last_page, per_page, total },
    }
  }

  return { rows: [], meta: emptyMeta }
}

const extractArray = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  return []
}

export default function BookingLeaveRequestsPage({
  onDecisionComplete,
}: {
  onDecisionComplete?: () => void
} = {}) {
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({ current_page: 1, last_page: 1, per_page: 50, total: 0 })
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [decisionTarget, setDecisionTarget] = useState<{ row: LeaveRow; action: 'approved' | 'rejected' } | null>(null)
  const [isDeciding, setIsDeciding] = useState(false)

  const [inputs, setInputs] = useState<{ staffId: string }>({ staffId: '' })
  const [filters, setFilters] = useState<{ staffId: string }>({ staffId: '' })
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const [decisionRemark, setDecisionRemark] = useState('')

  const loadRows = async () => {
    setLoading(true)
    try {
      setError(null)
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      // Default view: pending only (not user-editable in UI)
      qs.set('status', 'pending')
      if (filters.staffId) qs.set('staff_id', filters.staffId)
      const res = await fetch(`/api/proxy/admin/booking/leave-requests?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Failed to load leave requests.')
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }
      const payload = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; data?: unknown }
      if (payload?.success === false && payload?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      const parsed = extractPaginated<LeaveRow>(payload)
      setRows(parsed.rows)
      setMeta(parsed.meta)
    } finally {
      setLoading(false)
    }
  }

  const loadStaffOptions = async () => {
    const res = await fetch('/api/proxy/admin/booking/leave-balances', { cache: 'no-store' })
    if (!res.ok) return
    const list = extractArray<StaffOption>(await res.json().catch(() => ({})))
    setStaffOptions(list)
  }

  useEffect(() => {
    void loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage, pageSize])

  useEffect(() => {
    void loadStaffOptions()
  }, [])

  const decide = async (id: number, status: 'approved' | 'rejected') => {
    try {
      setIsDeciding(true)
      const res = await fetch(`/api/proxy/admin/booking/leave-requests/${id}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_remark: decisionRemark || null }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { message?: string }
        setError(payload.message ?? 'Failed to update leave request.')
        return
      }
      setDecisionTarget(null)
      setDecisionRemark('')
      await loadRows()
      onDecisionComplete?.()
    } finally {
      setIsDeciding(false)
    }
  }

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof typeof filters, string][])
      .filter(([, v]) => Boolean(v))
  }, [filters])

  const filterLabels: Record<keyof typeof filters, string> = {
    staffId: 'Staff',
  }

  const renderFilterValue = (key: keyof typeof filters, value: string) => {
    if (key === 'staffId') {
      const staff = staffOptions.find((s) => String(s.staff_id) === value)
      return staff ? staff.staff_name : value
    }
    return value
  }

  const handleBadgeRemove = (field: keyof typeof filters) => {
    const next = { ...filters, [field]: '' } as typeof filters
    setFilters(next)
    setInputs(next)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const closeFilterModal = () => {
    setError(null)
    setIsFilterModalOpen(false)
  }

  const closeDecisionModal = () => {
    setError(null)
    setDecisionTarget(null)
    setDecisionRemark('')
  }

  return (
    <div>
      {isFilterModalOpen && (
        <CrmFilterModalShell
          title="Filter"
          onClose={closeFilterModal}
          footer={
            <>
              <button
                type="reset"
                form="booking-leave-requests-filters-form"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Reset
              </button>
              <button
                type="submit"
                form="booking-leave-requests-filters-form"
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                Apply filter
              </button>
            </>
          }
        >
          <form
            id="booking-leave-requests-filters-form"
            onSubmit={(e) => {
              e.preventDefault()
              setFilters(inputs)
              setCurrentPage(1)
              closeFilterModal()
            }}
            onReset={(e) => {
              e.preventDefault()
              const next = { staffId: '' }
              setInputs(next)
              setFilters(next)
              setCurrentPage(1)
            }}
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="staffId" className="block text-sm font-medium text-gray-700 mb-1">
                  Staff
                </label>
                <select
                  id="staffId"
                  name="staffId"
                  value={inputs.staffId}
                  onChange={(e) => setInputs((p) => ({ ...p, staffId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  {staffOptions.map((row) => (
                    <option key={row.staff_id} value={row.staff_id}>
                      {row.staff_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </form>
        </CrmFilterModalShell>
      )}

      {decisionTarget && (() => {
        const row = decisionTarget.row
        const requestKind: RequestKind = row.request_kind === 'date_change' ? 'date_change' : 'new'
        const isDateChange = requestKind === 'date_change' && Boolean(row.source_leave_request)
        const isApprove = decisionTarget.action === 'approved'

        return (
        <CrmFormModalShell
          title={
            isDateChange
              ? isApprove
                ? 'Approve Day Change'
                : 'Reject Day Change'
              : isApprove
                ? 'Approve Leave Request'
                : 'Reject Leave Request'
          }
          onClose={closeDecisionModal}
          closeDisabled={isDeciding}
          footer={
            <>
              <button
                type="button"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:w-auto sm:rounded-md sm:py-2"
                onClick={closeDecisionModal}
                disabled={isDeciding}
              >
                Cancel
              </button>
              {isApprove ? (
                <button
                  type="button"
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:rounded-md sm:py-2"
                  onClick={() => decide(row.id, 'approved')}
                  disabled={isDeciding}
                >
                  {isDeciding ? 'Processing…' : isDateChange ? 'Approve change' : 'Approve'}
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 sm:w-auto sm:rounded-md sm:py-2"
                  onClick={() => decide(row.id, 'rejected')}
                  disabled={isDeciding}
                >
                  {isDeciding ? 'Processing…' : isDateChange ? 'Reject change' : 'Reject'}
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4 p-4 sm:p-5">
            <ReviewSummaryHeader row={row} requestKind={requestKind} />

            {isDateChange && row.source_leave_request ? (
              <>
                <ScheduleCompare
                  currentStart={row.source_leave_request.start_date}
                  currentEnd={row.source_leave_request.end_date}
                  currentDayType={row.source_leave_request.day_type}
                  requestedStart={row.start_date}
                  requestedEnd={row.end_date}
                  requestedDayType={row.day_type}
                />

                <ReasonReviewBlock
                  originalReason={row.source_leave_request.reason}
                  changeReason={row.change_reason}
                />

                <ModalInfoCallout tone="amber" title="Impact">
                  <ul className="list-disc space-y-1 pl-4">
                    <li>No leave balance adjustment</li>
                    <li>Original calendar slot remains blocked until you approve this change</li>
                    <li>On approval, the old date is released and the new date is blocked in one step</li>
                  </ul>
                </ModalInfoCallout>
              </>
            ) : (
              <>
                <ScheduleDateBlock
                  label="Requested dates"
                  startDate={row.start_date}
                  endDate={row.end_date}
                  dayType={row.day_type}
                />

                {row.reason?.trim() ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <ModalSectionLabel>Staff reason</ModalSectionLabel>
                    <p className="mt-2 text-sm text-slate-800">{row.reason}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                    No reason provided.
                  </div>
                )}
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Admin remark (optional)</label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Note for audit trail or staff communication"
                value={decisionRemark}
                onChange={(e) => setDecisionRemark(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </CrmFormModalShell>
        )
      })()}

      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 sm:w-auto sm:min-h-0 sm:py-2"
          onClick={() => setIsFilterModalOpen(true)}
          disabled={loading}
          type="button"
        >
          <i className="fa-solid fa-filter" />
          Filter
        </button>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <label htmlFor="pageSize" className="text-sm text-gray-700">
            Show
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 sm:min-h-0"
            disabled={loading}
          >
            {[50, 100, 150, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeFilters.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs"
            >
              <span className="font-medium">{filterLabels[key]}</span>
              <span>{renderFilterValue(key, value)}</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800"
                onClick={() => handleBadgeRemove(key)}
                aria-label={`Remove filter ${filterLabels[key]}`}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!isFilterModalOpen && !decisionTarget && error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Loading…
          </div>
        ) : rows.length > 0 ? (
          rows.map((row) => {
            const requestKind: RequestKind = row.request_kind === 'date_change' ? 'date_change' : 'new'
            const reason = getTableReason(row)

            return (
              <article
                key={row.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{row.staff?.name ?? `Staff #${row.staff_id}`}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{LEAVE_LABEL[row.leave_type]} · {DAY_TYPE_LABEL[row.day_type]}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${REQUEST_KIND_BADGE[requestKind]}`}>
                        {REQUEST_KIND_LABEL[requestKind]}
                      </span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_BADGE[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 px-4 py-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Dates</p>
                    {row.request_kind === 'date_change' && row.source_leave_request ? (
                      <div className="mt-1 space-y-1 text-sm">
                        <p className="text-xs text-slate-500">
                          From {formatDate(row.source_leave_request.start_date)}
                          {!isSingleDayRange(row.source_leave_request.start_date, row.source_leave_request.end_date)
                            ? ` – ${formatDate(row.source_leave_request.end_date)}`
                            : ''}
                        </p>
                        <p className="font-medium text-slate-900">
                          To {formatDate(row.start_date)}
                          {!isSingleDayRange(row.start_date, row.end_date) ? ` – ${formatDate(row.end_date)}` : ''}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDate(row.start_date)}
                        {!isSingleDayRange(row.start_date, row.end_date) ? ` – ${formatDate(row.end_date)}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Days</span>
                    <span className="font-semibold text-slate-900">{row.days.toFixed(2)}</span>
                  </div>

                  {reason ? (
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold text-slate-500">Reason</span>
                      <p className="mt-1 leading-relaxed">{reason}</p>
                    </div>
                  ) : null}
                </div>

                {row.status === 'pending' ? (
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-3">
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
                      onClick={() => { setError(null); setDecisionRemark(row.admin_remark ?? ''); setDecisionTarget({ row, action: 'approved' }) }}
                    >
                      {requestKind === 'date_change' ? 'Review' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700"
                      onClick={() => { setError(null); setDecisionRemark(row.admin_remark ?? ''); setDecisionTarget({ row, action: 'rejected' }) }}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No leave requests found.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg bg-white shadow md:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Staff</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Request Type</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Leave Type</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Day Type</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Date Range</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Days</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Reason</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Status</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={9} />
            ) : rows.length > 0 ? (
              rows.map((row) => {
                const requestKind: RequestKind = row.request_kind === 'date_change' ? 'date_change' : 'new'
                return (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-2">{row.staff?.name ?? `Staff #${row.staff_id}`}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${REQUEST_KIND_BADGE[requestKind]}`}
                    >
                      {REQUEST_KIND_LABEL[requestKind]}
                    </span>
                  </td>
                  <td className="px-4 py-2">{LEAVE_LABEL[row.leave_type]}</td>
                  <td className="px-4 py-2">{DAY_TYPE_LABEL[row.day_type]}</td>
                  <td className="px-4 py-2">
                    {row.request_kind === 'date_change' && row.source_leave_request ? (
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500">
                          From {formatDate(row.source_leave_request.start_date)}
                          {row.source_leave_request.start_date.slice(0, 10) !== row.source_leave_request.end_date.slice(0, 10)
                            ? ` – ${formatDate(row.source_leave_request.end_date)}`
                            : ''}
                        </div>
                        <div className="font-medium">
                          To {formatDate(row.start_date)}
                          {row.start_date.slice(0, 10) !== row.end_date.slice(0, 10)
                            ? ` – ${formatDate(row.end_date)}`
                            : ''}
                        </div>
                      </div>
                    ) : (
                      <span>{row.start_date} → {row.end_date}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{row.days.toFixed(2)}</td>
                  <td className="px-4 py-2 max-w-[14rem]">
                    <span className="line-clamp-2">{getTableReason(row) || '—'}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {row.status === 'pending' ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          onClick={() => { setError(null); setDecisionRemark(row.admin_remark ?? ''); setDecisionTarget({ row, action: 'approved' }) }}
                        >
                          {requestKind === 'date_change' ? 'Review' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                          onClick={() => { setError(null); setDecisionRemark(row.admin_remark ?? ''); setDecisionTarget({ row, action: 'rejected' }) }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                )
              })
            ) : (
              <TableEmptyState colSpan={9} message="No leave requests found." />
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={meta.last_page || 1}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        disabled={loading}
      />
    </div>
  )
}
