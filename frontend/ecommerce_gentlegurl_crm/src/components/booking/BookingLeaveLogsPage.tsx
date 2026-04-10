'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from '../TableEmptyState'
import PaginationControls from '../PaginationControls'

type ActionType = 'created' | 'approved' | 'rejected' | 'cancelled' | 'adjusted'

type LeaveLogRow = {
  id: number
  created_at: string
  staff_id: number
  leave_request_id: number | null
  action_type: ActionType
  remark: string | null
  before_value: unknown
  after_value: unknown
  staff?: { id: number; name: string }
  creator?: { id: number; name: string }
}

type StaffOption = { staff_id: number; staff_name: string }

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const ACTION_LABEL: Record<ActionType, string> = {
  created: 'Created',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  adjusted: 'Adjusted',
}

const ACTION_BADGE: Record<ActionType, string> = {
  created: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-amber-100 text-amber-700',
  adjusted: 'bg-violet-100 text-violet-700',
}

const readNumberField = (value: unknown, key: string): number | null => {
  if (!value || typeof value !== 'object') return null
  const v = (value as Record<string, unknown>)[key]
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const getAdjustedLabelAndBadge = (row: LeaveLogRow): { label: string; badge: string } => {
  if (row.action_type !== 'adjusted') {
    return { label: ACTION_LABEL[row.action_type], badge: ACTION_BADGE[row.action_type] }
  }

  // Try to infer direction from before/after entitled days
  const beforeEntitled = readNumberField(row.before_value, 'entitled_days')
  const afterEntitled = readNumberField(row.after_value, 'entitled_days')
  if (beforeEntitled != null && afterEntitled != null) {
    const delta = afterEntitled - beforeEntitled
    if (delta > 0) return { label: 'Add', badge: 'bg-emerald-100 text-emerald-700' }
    if (delta < 0) return { label: 'Reduce', badge: 'bg-rose-100 text-rose-700' }
  }

  return { label: 'Adjust', badge: ACTION_BADGE.adjusted }
}

const extractPaginated = (payload: unknown): { rows: LeaveLogRow[]; meta: PaginationMeta } => {
  const emptyMeta = { current_page: 1, last_page: 1, per_page: 20, total: 0 }
  if (!payload || typeof payload !== 'object') return { rows: [], meta: emptyMeta }

  const root = payload as { data?: unknown }
  if (!root.data || typeof root.data !== 'object') return { rows: [], meta: emptyMeta }

  const p = root.data as { data?: unknown; current_page?: number; last_page?: number; per_page?: number; total?: number }
  const rows = Array.isArray(p.data) ? (p.data as LeaveLogRow[]) : []

  return {
    rows,
    meta: {
      current_page: Number(p.current_page ?? 1),
      last_page: Number(p.last_page ?? 1),
      per_page: Number(p.per_page ?? 20),
      total: Number(p.total ?? rows.length),
    },
  }
}

const extractStaffOptions = (payload: unknown): StaffOption[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (!Array.isArray(root.data)) return []
  return root.data
    .map((r) => {
      if (!r || typeof r !== 'object') return null
      const row = r as { staff_id?: number; staff_name?: string }
      if (!row.staff_id || !row.staff_name) return null
      return { staff_id: row.staff_id, staff_name: row.staff_name }
    })
    .filter((v): v is StaffOption => Boolean(v))
}

type LeaveLogFilterValues = {
  staffId: string
  actionType: ActionType | ''
  fromDate: string
  toDate: string
}

const emptyLeaveLogFilters: LeaveLogFilterValues = {
  staffId: '',
  actionType: '',
  fromDate: '',
  toDate: '',
}

export default function BookingLeaveLogsPage() {
  const [rows, setRows] = useState<LeaveLogRow[]>([])
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [inputs, setInputs] = useState<LeaveLogFilterValues>({ ...emptyLeaveLogFilters })
  const [filters, setFilters] = useState<LeaveLogFilterValues>({ ...emptyLeaveLogFilters })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [meta, setMeta] = useState<PaginationMeta>({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [detailsRow, setDetailsRow] = useState<LeaveLogRow | null>(null)

  const loadStaffOptions = async () => {
    const res = await fetch('/api/proxy/admin/booking/leave-balances', { cache: 'no-store' })
    if (!res.ok) return
    const payload = await res.json().catch(() => ({}))
    setStaffOptions(extractStaffOptions(payload))
  }

  const loadRows = async () => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('per_page', String(pageSize))
    if (filters.staffId) qs.set('staff_id', filters.staffId)
    if (filters.actionType) qs.set('action_type', filters.actionType)
    if (filters.fromDate) qs.set('from_date', filters.fromDate)
    if (filters.toDate) qs.set('to_date', filters.toDate)

    const res = await fetch(`/api/proxy/admin/booking/leave-logs?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      setError('Failed to load leave logs.')
      return
    }

    setError(null)
    const payload = await res.json().catch(() => ({}))
    const parsed = extractPaginated(payload)
    setRows(parsed.rows)
    setMeta(parsed.meta)
  }

  useEffect(() => {
    void loadStaffOptions()
  }, [])

  useEffect(() => {
    void loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters])

  const prettyJson = (value: unknown) => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  const pageInfo = useMemo(() => {
    if (meta.total === 0) return '0 logs'
    const start = (meta.current_page - 1) * meta.per_page + 1
    const end = Math.min(meta.current_page * meta.per_page, meta.total)
    return `${start}-${end} of ${meta.total}`
  }, [meta])

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof LeaveLogFilterValues, string][])
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof LeaveLogFilterValues, string> = {
    staffId: 'Staff',
    actionType: 'Action Type',
    fromDate: 'From',
    toDate: 'To',
  }

  const renderFilterValue = (key: keyof LeaveLogFilterValues, value: string) => {
    if (key === 'staffId') {
      const staff = staffOptions.find((s) => String(s.staff_id) === value)
      return staff ? staff.staff_name : value
    }
    if (key === 'actionType') {
      const k = value as ActionType
      return ACTION_LABEL[k] ?? value
    }
    return value
  }

  const handleBadgeRemove = (field: keyof LeaveLogFilterValues) => {
    const next = { ...filters, [field]: '' }
    setFilters(next)
    setInputs(next)
    setPage(1)
  }

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > (meta.last_page || 1)) return
    setPage(nextPage)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const closeFilterModal = () => {
    setError(null)
    setIsFilterModalOpen(false)
  }

  const openDetails = (row: LeaveLogRow) => {
    setError(null)
    setDetailsRow(row)
  }

  return (
    <div className="space-y-4">
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeFilterModal} />
          <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Filter</h2>
              <button
                onClick={closeFilterModal}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
                type="button"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="p-5">
              <form
                id="booking-leave-logs-filters-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  setFilters(inputs)
                  setPage(1)
                  closeFilterModal()
                }}
                onReset={(e) => {
                  e.preventDefault()
                  setInputs({ ...emptyLeaveLogFilters })
                  setFilters({ ...emptyLeaveLogFilters })
                  setPage(1)
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

                  <div>
                    <label htmlFor="actionType" className="block text-sm font-medium text-gray-700 mb-1">
                      Action Type
                    </label>
                    <select
                      id="actionType"
                      name="actionType"
                      value={inputs.actionType}
                      onChange={(e) => setInputs((p) => ({ ...p, actionType: e.target.value as ActionType | '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All</option>
                      {Object.entries(ACTION_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="fromDate" className="block text-sm font-medium text-gray-700 mb-1">
                        From
                      </label>
                      <input
                        id="fromDate"
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        value={inputs.fromDate}
                        onChange={(e) => setInputs((p) => ({ ...p, fromDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="toDate" className="block text-sm font-medium text-gray-700 mb-1">
                        To
                      </label>
                      <input
                        id="toDate"
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        value={inputs.toDate}
                        onChange={(e) => setInputs((p) => ({ ...p, toDate: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
              <button
                type="reset"
                form="booking-leave-logs-filters-form"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Reset
              </button>
              <button
                type="submit"
                form="booking-leave-logs-filters-form"
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Apply filter
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            onClick={() => setIsFilterModalOpen(true)}
            type="button"
          >
            <i className="fa-solid fa-filter" />
            Filter
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="pageSize" className="text-sm text-gray-700">
            Show
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {[20, 50, 100, 150, 200].map((size) => (
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

      {!detailsRow && !isFilterModalOpen && error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600">Created At</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600">Staff</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600">Action</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600">Remark</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600">Created By</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <TableEmptyState colSpan={6} message="No leave logs found." />
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-2">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{row.staff?.name ?? `Staff #${row.staff_id}`}</td>
                  <td className="px-4 py-2">
                    {(() => {
                      const view = getAdjustedLabelAndBadge(row)
                      return (
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${view.badge}`}>
                          {view.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-2">{row.remark || '-'}</td>
                  <td className="px-4 py-2">{row.creator?.name ?? '-'}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => openDetails(row)}
                      aria-label="View details"
                      title="View details"
                    >
                      <i className="fa-solid fa-eye" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={meta.current_page || page}
        totalPages={meta.last_page || 1}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />

      {detailsRow && (
        <div
          className="fixed inset-0 z-50 flex bg-black/40 px-0 md:bg-transparent md:px-0"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailsRow(null)}
        >
          <div className="hidden flex-1 bg-black/40 md:block" />
          <aside
            className="mr-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">Leave Log </h3>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setDetailsRow(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5">
                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Summary</p>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-700">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-500">Created at</p>
                        <p className="font-medium">{new Date(detailsRow.created_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Staff</p>
                        <p className="font-medium">{detailsRow.staff?.name ?? `Staff #${detailsRow.staff_id}`}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Leave request</p>
                        <p className="font-medium">{detailsRow.leave_request_id ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Action</p>
                        {(() => {
                          const view = getAdjustedLabelAndBadge(detailsRow)
                          return (
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${view.badge}`}>
                              {view.label}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-slate-500">Remark</p>
                        <p className="font-medium">{detailsRow.remark || '—'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-slate-500">Created by</p>
                        <p className="font-medium">{detailsRow.creator?.name ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Before Value</p>
                  </div>
                  <div className="px-4 py-3">
                    <pre className="whitespace-pre-wrap break-words text-xs text-slate-700 font-mono overflow-x-auto">
                      {prettyJson(detailsRow.before_value)}
                    </pre>
                  </div>
                </section>

                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">After Value</p>
                  </div>
                  <div className="px-4 py-3">
                    <pre className="whitespace-pre-wrap break-words text-xs text-slate-700 font-mono overflow-x-auto">
                      {prettyJson(detailsRow.after_value)}
                    </pre>
                  </div>
                </section>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
