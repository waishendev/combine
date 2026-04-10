'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import PaginationControls from '../PaginationControls'

type LeaveType = 'annual' | 'mc' | 'emergency' | 'unpaid'

type LeaveItem = { leave_type: LeaveType; entitled_days: number; used_days: number; remaining_days: number }
type StaffBalance = { staff_id: number; staff_name: string; balances: LeaveItem[] }

const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: 'Annual',
  mc: 'MC',
  emergency: 'Emergency',
  unpaid: 'Unpaid',
}

const LEAVE_TYPES: LeaveType[] = ['annual', 'mc', 'emergency']
const ADJUSTABLE_LEAVE_TYPES: LeaveType[] = ['annual', 'mc', 'emergency']

type LeaveBalanceFilterValues = {
  staffId: string
  query: string
}

const emptyLeaveBalanceFilters: LeaveBalanceFilterValues = {
  staffId: '',
  query: '',
}

const extractArray = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  return []
}

const toNumber = (value: string): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const formatDays = (value: number): string => {
  if (!Number.isFinite(value)) return '-'
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

const formatRemainEntitled = (remaining: number, entitled: number): string => {
  return `${formatDays(remaining)}/${formatDays(entitled)}`
}

export default function BookingLeaveBalancesPage() {
  const [rows, setRows] = useState<StaffBalance[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [inputs, setInputs] = useState<LeaveBalanceFilterValues>({ ...emptyLeaveBalanceFilters })
  const [filters, setFilters] = useState<LeaveBalanceFilterValues>({ ...emptyLeaveBalanceFilters })
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [adjustForm, setAdjustForm] = useState({
    staff_id: '',
    staff_name: '',
    mode: 'add' as 'add' | 'reduce',
    leave_type: 'annual' as LeaveType,
    days: '',
    remark: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const loadRows = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/leave-balances', { cache: 'no-store' })
      if (!res.ok) {
        setError('Failed to load leave balances.')
        setRows([])
        return
      }
      const payload = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; data?: unknown }
      if (payload?.success === false && payload?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }
      setError(null)
      setRows(extractArray<StaffBalance>(payload))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows()
  }, [])

  const filteredRows = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return rows.filter((row) => {
      if (filters.staffId && String(row.staff_id) !== filters.staffId) return false
      if (!q) return true
      return row.staff_name.toLowerCase().includes(q) || String(row.staff_id).includes(q)
    })
  }, [rows, filters.query, filters.staffId])

  const totalPages = useMemo(() => {
    if (loading) return 1
    return Math.max(1, Math.ceil(filteredRows.length / Math.max(1, pageSize)))
  }, [filteredRows.length, loading, pageSize])

  const pagedRows = useMemo(() => {
    const safePage = Math.min(Math.max(1, currentPage), totalPages)
    const start = (safePage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [currentPage, filteredRows, pageSize, totalPages])

  const adjustEntitlement = async (staffId: number, leaveType: LeaveType, deltaDays: number, remark?: string): Promise<boolean> => {
    const res = await fetch(`/api/proxy/admin/booking/leave-balances/${staffId}/adjust`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leave_type: leaveType, delta_days: deltaDays, remark: remark || null }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { message?: string }
      setError(payload.message ?? 'Failed to adjust leave entitlement.')
      return false
    }

    await loadRows()
    return true
  }

  const balanceByStaff = useMemo(() => {
    const map = new Map<number, Record<LeaveType, LeaveItem>>()
    rows.forEach((row) => {
      const record = {} as Record<LeaveType, LeaveItem>
      row.balances.forEach((b) => {
        record[b.leave_type] = b
      })
      map.set(row.staff_id, record)
    })
    return map
  }, [rows])

  const selectedAdjustBalance = useMemo(() => {
    const staffId = toNumber(adjustForm.staff_id)
    if (!staffId) return null
    const byType = balanceByStaff.get(staffId)
    if (!byType) return null
    return byType[adjustForm.leave_type] ?? null
  }, [adjustForm.leave_type, adjustForm.staff_id, balanceByStaff])

  const maxReducibleDays = useMemo(() => {
    if (adjustForm.mode !== 'reduce') return null
    if (!selectedAdjustBalance) return 0
    const remaining = Number(selectedAdjustBalance.remaining_days)
    return Number.isFinite(remaining) ? Math.max(0, remaining) : 0
  }, [adjustForm.mode, selectedAdjustBalance])

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof LeaveBalanceFilterValues, string][]).filter(([, value]) =>
      Boolean(value?.trim?.() ? value.trim() : value),
    )
  }, [filters])

  const filterLabels: Record<keyof LeaveBalanceFilterValues, string> = {
    staffId: 'Staff',
    query: 'Search',
  }

  const renderFilterValue = (key: keyof LeaveBalanceFilterValues, value: string) => {
    if (key === 'staffId') {
      const staff = rows.find((r) => String(r.staff_id) === value)
      return staff ? staff.staff_name : value
    }
    return value
  }

  const handleBadgeRemove = (field: keyof LeaveBalanceFilterValues) => {
    const next = { ...filters, [field]: '' }
    setFilters(next)
    setInputs(next)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const openAdjustModal = (staff: StaffBalance, mode: 'add' | 'reduce') => {
    setError(null)
    setAdjustForm({
      staff_id: String(staff.staff_id),
      staff_name: staff.staff_name,
      mode,
      leave_type: 'annual',
      days: '',
      remark: '',
    })
    setIsAdjustOpen(true)
  }

  const closeAdjustModal = () => {
    setError(null)
    setIsAdjustOpen(false)
  }

  const closeFilterModal = () => {
    setError(null)
    setIsFilterModalOpen(false)
  }

  const submitAdjustment = async () => {
    setError(null)
    const staffId = toNumber(adjustForm.staff_id)
    if (!staffId) {
      setError('Please select a staff.')
      return
    }

    const days = toNumber(adjustForm.days)
    if (!Number.isFinite(days) || days <= 0) {
      setError('Please enter days (must be > 0).')
      return
    }

    if (adjustForm.mode === 'reduce') {
      const max = maxReducibleDays ?? 0
      if (days > max) {
        setError(`Reduce days cannot exceed remaining balance (${formatDays(max)}).`)
        return
      }
    }

    const delta = adjustForm.mode === 'add' ? days : -days

    try {
      setIsSaving(true)
      const ok = await adjustEntitlement(staffId, adjustForm.leave_type, delta, adjustForm.remark)
      if (ok) {
        setIsAdjustOpen(false)
        setAdjustForm({
          staff_id: '',
          staff_name: '',
          mode: 'add',
          leave_type: 'annual',
          days: '',
          remark: '',
        })
      }
    } finally {
      setIsSaving(false)
    }
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
                id="booking-leave-balance-filters-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  setFilters(inputs)
                  setCurrentPage(1)
                  closeFilterModal()
                }}
                onReset={(e) => {
                  e.preventDefault()
                  setInputs({ ...emptyLeaveBalanceFilters })
                  setFilters({ ...emptyLeaveBalanceFilters })
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
                      {rows.map((row) => (
                        <option key={row.staff_id} value={row.staff_id}>
                          {row.staff_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1">
                      Search
                    </label>
                    <input
                      id="query"
                      name="query"
                      type="text"
                      value={inputs.query}
                      onChange={(e) => setInputs((p) => ({ ...p, query: e.target.value }))}
                      placeholder="Name / ID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
              <button
                type="reset"
                form="booking-leave-balance-filters-form"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Reset
              </button>
              <button
                type="submit"
                form="booking-leave-balance-filters-form"
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
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

      {!isAdjustOpen && !isFilterModalOpen && error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600  tracking-wider">Staff</th>
              {LEAVE_TYPES.map((t) => (
                <th key={`head-${t}`} className="px-4 py-2 font-semibold text-left text-gray-600  tracking-wider">
                  {LEAVE_LABEL[t]}
                </th>
              ))}
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={1 + LEAVE_TYPES.length + 1} />
            ) : pagedRows.length > 0 ? (
              pagedRows.map((row) => {
                const byType = balanceByStaff.get(row.staff_id) ?? ({} as Record<LeaveType, LeaveItem>)
                return (
                  <tr key={row.staff_id} className="align-top">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{row.staff_name}</div>
                    </td>

                    {LEAVE_TYPES.map((t) => {
                      const item = byType[t] ?? { leave_type: t, entitled_days: 0, used_days: 0, remaining_days: 0 }
                      return (
                        <td key={`${row.staff_id}-${t}`} className="px-4 py-2 font-medium text-slate-900">
                          {formatRemainEntitled(item.remaining_days, item.entitled_days)}
                        </td>
                      )
                    })}

                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => openAdjustModal(row, 'add')}
                          aria-label="ADD"
                          title="ADD"
                        >
                          <i className="fa-solid fa-plus" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-rose-600 text-white hover:bg-rose-700"
                          onClick={() => openAdjustModal(row, 'reduce')}
                          aria-label="REDUCE"
                          title="REDUCE"
                        >
                          <i className="fa-solid fa-minus" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <TableEmptyState colSpan={1 + LEAVE_TYPES.length + 1} message="No staff found." />
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        disabled={loading}
      />

      {isAdjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={closeAdjustModal}>
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">{adjustForm.mode === 'add' ? 'ADD' : 'REDUCE'}</h4>
              <button type="button" className="text-slate-500 hover:text-slate-800" onClick={closeAdjustModal}>✕</button>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              This will {adjustForm.mode === 'add' ? 'increase' : 'decrease'} the entitled days for the selected leave type.
            </p>

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-500">Staff</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50"
                  value={adjustForm.staff_name ? `${adjustForm.staff_name} (ID: ${adjustForm.staff_id})` : ''}
                  readOnly
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">Leave Type</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={adjustForm.leave_type}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, leave_type: e.target.value as LeaveType }))}
                >
                  {ADJUSTABLE_LEAVE_TYPES.map((t) => <option key={`lt-${t}`} value={t}>{LEAVE_LABEL[t]}</option>)}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs text-slate-500">Days</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. 1 or 0.5"
                  value={adjustForm.days}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, days: e.target.value }))}
                  max={adjustForm.mode === 'reduce' ? (maxReducibleDays ?? 0) : undefined}
                />
                {adjustForm.mode === 'reduce' && (
                  <p className="mt-1 text-xs text-slate-500">
                    Remaining balance: <span className="font-medium">{formatDays(maxReducibleDays ?? 0)}</span>
                  </p>
                )}
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-xs text-slate-500">Remark (optional)</label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  value={adjustForm.remark}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, remark: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="rounded border px-3 py-2 text-sm" onClick={closeAdjustModal} disabled={isSaving}>Cancel</button>
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={submitAdjustment}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : (adjustForm.mode === 'add' ? 'ADD' : 'REDUCE')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
