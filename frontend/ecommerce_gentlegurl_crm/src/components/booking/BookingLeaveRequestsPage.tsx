'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import PaginationControls from '../PaginationControls'

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type DayType = 'full_day' | 'half_day_am' | 'half_day_pm'

type LeaveRow = {
  id: number
  staff_id: number
  leave_type: 'annual' | 'mc' | 'emergency' | 'unpaid' | 'off_day'
  day_type: DayType
  start_date: string
  end_date: string
  days: number
  status: LeaveStatus
  reason: string | null
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

export default function BookingLeaveRequestsPage() {
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({ current_page: 1, last_page: 1, per_page: 50, total: 0 })
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isOffDayModalOpen, setIsOffDayModalOpen] = useState(false)
  const [decisionTarget, setDecisionTarget] = useState<{ row: LeaveRow; action: 'approved' | 'rejected' } | null>(null)
  const [isDeciding, setIsDeciding] = useState(false)

  const [inputs, setInputs] = useState<{ staffId: string }>({ staffId: '' })
  const [filters, setFilters] = useState<{ staffId: string }>({ staffId: '' })
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const [decisionRemark, setDecisionRemark] = useState('')
  const [offDayForm, setOffDayForm] = useState({ staff_id: '', start_date: '', end_date: '', reason: '' })

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
    } finally {
      setIsDeciding(false)
    }
  }

  const createOffDay = async () => {
    if (!offDayForm.staff_id || !offDayForm.start_date || !offDayForm.end_date) {
      setError('Please complete staff and date fields for Off Day.')
      return
    }

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

    setOffDayForm({ staff_id: '', start_date: '', end_date: '', reason: '' })
    setIsOffDayModalOpen(false)
    await loadRows()
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

  const closeOffDayModal = () => {
    setError(null)
    setIsOffDayModalOpen(false)
  }

  const closeDecisionModal = () => {
    setError(null)
    setDecisionTarget(null)
    setDecisionRemark('')
  }

  return (
    <div>
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
            </div>

            <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
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
            </div>
          </div>
        </div>
      )}

      {isOffDayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeOffDayModal}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Create Off Days</h2>
              <button
                onClick={closeOffDayModal}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
                type="button"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">
                Off Day is admin-managed and blocks booking availability without deducting leave balance.
              </p>

              {error && <p className="text-sm text-rose-600">{error}</p>}

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

            <div className="flex items-center justify-end gap-2 border-t border-gray-300 px-5 py-3">
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeOffDayModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
                onClick={createOffDay}
                disabled={loading}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {decisionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeDecisionModal}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">{decisionTarget.action === 'approved' ? 'APPROVE' : 'REJECT'}</h2>
              <button
                onClick={closeDecisionModal}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
                type="button"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Staff</p>
                  <p className="font-medium">{decisionTarget.row.staff?.name ?? `Staff #${decisionTarget.row.staff_id}`}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Type</p>
                  <p className="font-medium">{LEAVE_LABEL[decisionTarget.row.leave_type]}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date range</p>
                  <p className="font-medium">{decisionTarget.row.start_date} → {decisionTarget.row.end_date}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Days</p>
                  <p className="font-medium">{decisionTarget.row.days.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin remark (optional)</label>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                  value={decisionRemark}
                  onChange={(e) => setDecisionRemark(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-300 px-5 py-3">
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeDecisionModal}
                disabled={isDeciding}
              >
                Cancel
              </button>
              {decisionTarget.action === 'rejected' ? (
                <button
                  type="button"
                  className="rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => decide(decisionTarget.row.id, 'rejected')}
                  disabled={isDeciding}
                >
                  REJECT
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => decide(decisionTarget.row.id, 'approved')}
                  disabled={isDeciding}
                >
                  APPROVE
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            onClick={() => { setError(null); setIsOffDayModalOpen(true) }}
            type="button"
          >
            <i className="fa-solid fa-plus" />
            Create Off Days
          </button>

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
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
            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
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

      {!isFilterModalOpen && !isOffDayModalOpen && !decisionTarget && error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Staff</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Day Type</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Date Range</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Days</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Reason</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={8} />
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-2">{row.staff?.name ?? `Staff #${row.staff_id}`}</td>
                  <td className="px-4 py-2">{LEAVE_LABEL[row.leave_type]}</td>
                  <td className="px-4 py-2">{DAY_TYPE_LABEL[row.day_type]}</td>
                  <td className="px-4 py-2">{row.start_date} → {row.end_date}</td>
                  <td className="px-4 py-2">{row.days.toFixed(2)}</td>
                  <td className="px-4 py-2">{row.reason || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {row.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded bg-emerald-600 px-3 py-1 text-xs text-white"
                          onClick={() => { setError(null); setDecisionRemark(row.admin_remark ?? ''); setDecisionTarget({ row, action: 'approved' }) }}
                        >
                          APPROVE
                        </button>
                        <button
                          type="button"
                          className="rounded bg-rose-600 px-3 py-1 text-xs text-white"
                          onClick={() => { setError(null); setDecisionRemark(row.admin_remark ?? ''); setDecisionTarget({ row, action: 'rejected' }) }}
                        >
                          REJECT
                        </button>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <TableEmptyState colSpan={8} message="No leave requests found." />
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
