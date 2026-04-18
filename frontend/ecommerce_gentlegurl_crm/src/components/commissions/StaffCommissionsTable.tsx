'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from '@/components/PaginationControls'
import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import BookingCommissionOverrideModal from '@/components/booking/BookingCommissionOverrideModal'

type CommissionType = 'BOOKING' | 'ECOMMERCE'
type CommissionStatus = 'OPEN' | 'FROZEN'

type CommissionRow = {
  id: number
  type: CommissionType
  year: number
  month: number
  total_sales: string | number
  booking_count: number
  tier_percent: string | number
  tier_percent_snapshot?: string | number | null
  commission_amount: string | number
  calculated_at?: string | null
  status?: CommissionStatus
  frozen_at?: string | null
  reopened_at?: string | null
  is_overridden: boolean
  override_amount?: string | number | null
  staff?: { id: number; name: string }
}

type StaffOption = { id: number; name: string }

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type CommissionApiResponse = {
  data?: {
    data?: CommissionRow[]
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
  }
}

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1
const PAGE_SIZE_OPTIONS = [15, 50, 100, 150, 200]

const formatAmount = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

type Props = {
  type: CommissionType
  routeBasePath: string
  countLabel: string
}

export default function StaffCommissionsTable({ type, routeBasePath, countLabel }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const resolvedParams = useMemo(() => {
    const parsedPage = Number(searchParams.get('page'))
    const parsedPerPage = Number(searchParams.get('per_page'))
    const hasValidPage = Number.isFinite(parsedPage) && parsedPage > 0
    const hasValidPerPage = Number.isFinite(parsedPerPage) && parsedPerPage > 0

    return {
      staffId: searchParams.get('staff_id') || '',
      year: searchParams.get('year') || '',
      month: searchParams.get('month') || '',
      page: hasValidPage ? parsedPage : DEFAULT_PAGE,
      perPage: hasValidPerPage ? parsedPerPage : DEFAULT_PAGE_SIZE,
      hasValidPage,
      hasValidPerPage,
    }
  }, [searchParams])

  const [inputs, setInputs] = useState({
    staff_id: resolvedParams.staffId,
    year: resolvedParams.year,
    month: resolvedParams.month,
  })
  const [rows, setRows] = useState<CommissionRow[]>([])
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    per_page: resolvedParams.perPage,
    current_page: resolvedParams.page,
    last_page: 1,
  })
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [overrideTarget, setOverrideTarget] = useState<CommissionRow | null>(null)
  const [monthActionType, setMonthActionType] = useState<'freeze' | 'reopen' | null>(null)
  const [monthActionLoading, setMonthActionLoading] = useState(false)
  const [monthActionForm, setMonthActionForm] = useState({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
  })
  const [refreshKey, setRefreshKey] = useState(0)

  const loadStaffs = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      const data = Array.isArray(json?.data) ? json.data : []
      setStaffs(data)
    } catch {
      setStaffs([])
    }
  }, [])

  useEffect(() => {
    void loadStaffs()
  }, [loadStaffs])

  useEffect(() => {
    setInputs({
      staff_id: resolvedParams.staffId,
      year: resolvedParams.year,
      month: resolvedParams.month,
    })
  }, [resolvedParams.staffId, resolvedParams.year, resolvedParams.month])

  useEffect(() => {
    const needsDefaults = !resolvedParams.hasValidPage || !resolvedParams.hasValidPerPage

    if (!needsDefaults) return

    const nextParams = new URLSearchParams(searchParams.toString())
    if (!resolvedParams.hasValidPage) {
      nextParams.set('page', String(DEFAULT_PAGE))
    }
    if (!resolvedParams.hasValidPerPage) {
      nextParams.set('per_page', String(DEFAULT_PAGE_SIZE))
    }

    router.replace(`${routeBasePath}?${nextParams.toString()}`)
  }, [resolvedParams.hasValidPage, resolvedParams.hasValidPerPage, routeBasePath, router, searchParams])

  const fetchCommissions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (resolvedParams.staffId) qs.set('staff_id', resolvedParams.staffId)
    if (resolvedParams.year) qs.set('year', resolvedParams.year)
    if (resolvedParams.month) qs.set('month', resolvedParams.month)
    qs.set('type', type)
    qs.set('page', String(resolvedParams.page))
    qs.set('per_page', String(resolvedParams.perPage))

    try {
      const response = await fetch(`/api/proxy/admin/booking/commissions?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      if (!response.ok) {
        setRows([])
        setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
        return
      }

      const data: CommissionApiResponse = await response.json()
      const responseData = data.data

      if (!responseData || typeof responseData !== 'object' || !Array.isArray(responseData.data)) {
        setRows([])
        setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
        return
      }

      setRows(responseData.data)
      setPagination({
        total: responseData.total ?? responseData.data.length,
        per_page: responseData.per_page ?? resolvedParams.perPage,
        current_page: responseData.current_page ?? resolvedParams.page,
        last_page: responseData.last_page ?? 1,
      })
    } catch {
      if (signal?.aborted) return
      setRows([])
      setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [resolvedParams.staffId, resolvedParams.year, resolvedParams.month, resolvedParams.page, resolvedParams.perPage, type])

  useEffect(() => {
    const controller = new AbortController()
    void fetchCommissions(controller.signal)
    return () => controller.abort()
  }, [fetchCommissions, refreshKey])

  const updateQuery = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    router.push(`${routeBasePath}?${params.toString()}`)
  }

  const handleStatusAction = async (row: CommissionRow, action: 'freeze' | 'reopen') => {
    setActionLoadingId(row.id)
    try {
      const res = await fetch(`/api/proxy/admin/booking/commissions/${row.id}/${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        throw new Error('Failed to update month status.')
      }
      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update month status.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const openMonthActionModal = (action: 'freeze' | 'reopen') => {
    const now = new Date()
    setMonthActionForm({
      year: resolvedParams.year || String(now.getFullYear()),
      month: resolvedParams.month || String(now.getMonth() + 1),
    })
    setMonthActionType(action)
  }

  const handleMonthAction = async () => {
    if (!monthActionType) return
    setMonthActionLoading(true)
    try {
      const endpoint = monthActionType === 'freeze' ? 'freeze-month' : 'reopen-month'
      const res = await fetch(`/api/proxy/admin/booking/commissions/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          year: Number(monthActionForm.year),
          month: Number(monthActionForm.month),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to update selected month.')
      }
      setRefreshKey((prev) => prev + 1)
      setMonthActionType(null)
      alert(`${monthActionType === 'freeze' ? 'Freeze' : 'Reopen'} month done. Updated rows: ${json?.data?.updated_count ?? 0}`)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update selected month.')
    } finally {
      setMonthActionLoading(false)
    }
  }

  const summaryCards = useMemo(() => {
    const totalSales = rows.reduce((sum, row) => sum + Number(row.total_sales || 0), 0)
    const totalCount = rows.reduce((sum, row) => sum + (row.booking_count || 0), 0)
    const totalCommission = rows.reduce((sum, row) => {
      const amount = row.is_overridden && row.override_amount
        ? Number(row.override_amount)
        : Number(row.commission_amount || 0)
      return sum + amount
    }, 0)
    const overriddenCount = rows.filter((row) => row.is_overridden).length

    return [
      { label: 'Total Sales', value: totalSales, isMoney: true },
      { label: countLabel, value: totalCount, isMoney: false },
      { label: 'Total Commission', value: totalCommission, isMoney: true },
      { label: 'Overridden', value: overriddenCount, isMoney: false },
    ]
  }, [countLabel, rows])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <div className="space-y-6">
      {isFilterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
          <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Filter</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none" aria-label="Close">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Staff</label>
                  <select value={inputs.staff_id} onChange={(e) => setInputs((prev) => ({ ...prev, staff_id: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm">
                    <option value="">All Staff</option>
                    {staffs.map((staff) => (
                      <option key={staff.id} value={staff.id}>{staff.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Year</label>
                  <select value={inputs.year} onChange={(e) => setInputs((prev) => ({ ...prev, year: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm">
                    <option value="">All Years</option>
                    {years.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Month</label>
                  <select value={inputs.month} onChange={(e) => setInputs((prev) => ({ ...prev, month: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm">
                    <option value="">All Months</option>
                    {months.map((month) => (
                      <option key={month} value={month}>{monthNames[month - 1]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
              <button type="button" onClick={() => { setInputs({ staff_id: '', year: '', month: '' }); updateQuery({ staff_id: '', year: '', month: '', page: String(DEFAULT_PAGE), per_page: String(resolvedParams.perPage) }); setIsFilterOpen(false) }} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200">
                Reset
              </button>
              <button type="button" onClick={() => { updateQuery({ staff_id: inputs.staff_id || '', year: inputs.year || '', month: inputs.month || '', page: String(DEFAULT_PAGE), per_page: String(resolvedParams.perPage) }); setIsFilterOpen(false) }} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={loading}>
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {monthActionType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMonthActionType(null)} />
          <div className="relative w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-5 space-y-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{monthActionType === 'freeze' ? 'Freeze Month' : 'Reopen Month'}</h2>
              <button
                type="button"
                onClick={() => setMonthActionType(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Apply this action to all {type.toLowerCase()} commission rows in the selected month.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Year</label>
                <select
                  value={monthActionForm.year}
                  onChange={(e) => setMonthActionForm((prev) => ({ ...prev, year: e.target.value }))}
                  className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Month</label>
                <select
                  value={monthActionForm.month}
                  onChange={(e) => setMonthActionForm((prev) => ({ ...prev, month: e.target.value }))}
                  className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                >
                  {months.map((month) => (
                    <option key={month} value={month}>{monthNames[month - 1]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMonthActionType(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                disabled={monthActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleMonthAction()}
                className={`px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 ${monthActionType === 'freeze' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                disabled={monthActionLoading}
              >
                {monthActionLoading ? 'Processing...' : monthActionType === 'freeze' ? 'Freeze Month' : 'Reopen Month'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setIsFilterOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50" disabled={loading}>
            <i className="fa-solid fa-filter" />
            Filter
          </button>
          <button
            type="button"
            onClick={() => openMonthActionModal('freeze')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            disabled={loading}
          >
            Freeze Month
          </button>
          <button
            type="button"
            onClick={() => openMonthActionModal('reopen')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            disabled={loading}
          >
            Reopen Month
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="pageSize" className="text-sm text-gray-700">Show</label>
          <select id="pageSize" value={resolvedParams.perPage} onChange={(event) => updateQuery({ per_page: event.target.value, page: String(DEFAULT_PAGE) })} className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50" disabled={loading}>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-lg border border-slate-200 px-4 py-3">
              <div className="text-xs font-semibold uppercase text-slate-400">{card.label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-700">
                {card.isMoney ? `RM ${formatAmount(Number(card.value || 0))}` : Number(card.value || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Staff</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Period</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Status</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Total Sales</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">{countLabel}</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Tier % (Snapshot)</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Commission</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Calculated At</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={9} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={9} />
            ) : (
              rows.map((row) => {
                const commissionAmount = row.is_overridden && row.override_amount
                  ? Number(row.override_amount)
                  : Number(row.commission_amount || 0)
                const status = row.status ?? 'OPEN'
                const tierDisplay = Number(row.tier_percent_snapshot ?? row.tier_percent ?? 0).toFixed(2)

                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border border-gray-200 font-medium">{row.staff?.name ?? '-'}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.year}-{String(row.month).padStart(2, '0')}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status === 'FROZEN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">RM {formatAmount(Number(row.total_sales || 0))}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.booking_count}</td>
                    <td className="px-4 py-2 border border-gray-200">{tierDisplay}%</td>
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex flex-col">
                        <span>RM {formatAmount(commissionAmount)}</span>
                        {row.is_overridden && <span className="text-xs text-amber-600">(Overridden)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="text-xs text-gray-600">{formatDateTime(row.calculated_at)}</div>
                      <div className="text-xs text-gray-500">F: {formatDateTime(row.frozen_at)}</div>
                      <div className="text-xs text-gray-500">R: {formatDateTime(row.reopened_at)}</div>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={status === 'FROZEN'}
                          onClick={() => setOverrideTarget(row)}
                          className="text-blue-600 hover:text-blue-800 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {row.is_overridden ? 'Edit Override' : 'Override'}
                        </button>
                        {status === 'FROZEN' ? (
                          <button
                            type="button"
                            disabled={actionLoadingId === row.id}
                            onClick={() => void handleStatusAction(row, 'reopen')}
                            className="text-emerald-700 hover:text-emerald-900 text-sm disabled:opacity-50"
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoadingId === row.id}
                            onClick={() => void handleStatusAction(row, 'freeze')}
                            className="text-amber-700 hover:text-amber-900 text-sm disabled:opacity-50"
                          >
                            Freeze
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={pagination.current_page}
        totalPages={pagination.last_page}
        pageSize={pagination.per_page}
        onPageChange={(page) => updateQuery({ page: String(page) })}
        disabled={loading}
      />

      {overrideTarget && (
        <BookingCommissionOverrideModal
          commission={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onSuccess={() => {
            setOverrideTarget(null)
            setRefreshKey((prev) => prev + 1)
          }}
        />
      )}
    </div>
  )
}
