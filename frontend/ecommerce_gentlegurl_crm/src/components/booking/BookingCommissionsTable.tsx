'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from '../PaginationControls'
import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import BookingCommissionOverrideModal from './BookingCommissionOverrideModal'

type CommissionRow = {
  id: number
  year: number
  month: number
  total_sales: string | number
  booking_count: number
  tier_percent: string | number
  commission_amount: string | number
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
  data?: CommissionRow[] | {
    data?: CommissionRow[]
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
  }
  meta?: Partial<Pagination>
}

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1
const PAGE_SIZE_OPTIONS = [15, 50, 100, 150, 200]

const formatAmount = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const extractData = <T,>(json: unknown, fallback: T): T => {
  if (Array.isArray(json)) return json as T
  if (json && typeof json === 'object' && 'data' in json) {
    const data = (json as { data: unknown }).data
    if (Array.isArray(data)) return data as T
  }
  return fallback
}

export default function BookingCommissionsTable() {
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
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [overrideTarget, setOverrideTarget] = useState<CommissionRow | null>(null)

  const loadStaffs = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      const data = extractData<StaffOption[]>(json, [])
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

    router.replace(`/booking/commissions?${nextParams.toString()}`)
  }, [resolvedParams.hasValidPage, resolvedParams.hasValidPerPage, router, searchParams])

  useEffect(() => {
    const controller = new AbortController()
    const fetchCommissions = async () => {
      setLoading(true)
      const qs = new URLSearchParams()
      if (resolvedParams.staffId) qs.set('staff_id', resolvedParams.staffId)
      if (resolvedParams.year) qs.set('year', resolvedParams.year)
      if (resolvedParams.month) qs.set('month', resolvedParams.month)
      qs.set('page', String(resolvedParams.page))
      qs.set('per_page', String(resolvedParams.perPage))

      try {
        const response = await fetch(
          `/api/proxy/admin/booking/commissions?${qs.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )
        if (!response.ok) {
          setRows([])
          setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
          return
        }
        const data: CommissionApiResponse = await response.json()
        const responseData = data.data
        let responseRows: CommissionRow[] = []
        let paginationData: Partial<Pagination> | null = null

        if (Array.isArray(responseData)) {
          responseRows = responseData
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          responseRows = Array.isArray(responseData.data) ? responseData.data : []
          paginationData = {
            total: responseData.total ?? responseRows.length,
            per_page: responseData.per_page ?? resolvedParams.perPage,
            current_page: responseData.current_page ?? resolvedParams.page,
            last_page: responseData.last_page ?? 1,
          }
        }

        setRows(responseRows)
        if (paginationData) {
          setPagination({
            total: paginationData.total ?? responseRows.length,
            per_page: paginationData.per_page ?? resolvedParams.perPage,
            current_page: paginationData.current_page ?? resolvedParams.page,
            last_page: paginationData.last_page ?? 1,
          })
        } else {
          const total = responseRows.length
          const lastPage = Math.max(1, Math.ceil(total / resolvedParams.perPage))
          setPagination({
            total,
            per_page: resolvedParams.perPage,
            current_page: Math.min(resolvedParams.page, lastPage),
            last_page: lastPage,
          })
        }
      } catch {
        if (controller.signal.aborted) return
        setRows([])
        setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchCommissions()

    return () => controller.abort()
  }, [resolvedParams.staffId, resolvedParams.year, resolvedParams.month, resolvedParams.page, resolvedParams.perPage])

  const updateQuery = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    router.push(`/booking/commissions?${params.toString()}`)
  }

  const handleApply = () => {
    updateQuery({
      staff_id: inputs.staff_id || '',
      year: inputs.year || '',
      month: inputs.month || '',
      page: String(DEFAULT_PAGE),
      per_page: String(resolvedParams.perPage),
    })
    setIsFilterOpen(false)
  }

  const handleReset = () => {
    setInputs({
      staff_id: '',
      year: '',
      month: '',
    })
    updateQuery({
      staff_id: '',
      year: '',
      month: '',
      page: String(DEFAULT_PAGE),
      per_page: String(resolvedParams.perPage),
    })
    setIsFilterOpen(false)
  }

  const handleOverrideSuccess = () => {
    setOverrideTarget(null)
    // Reload will happen via useEffect
  }

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = []
    if (resolvedParams.staffId) {
      const staff = staffs.find((s) => String(s.id) === resolvedParams.staffId)
      filters.push({
        key: 'staff_id',
        label: 'Staff',
        value: staff?.name || resolvedParams.staffId,
      })
    }
    if (resolvedParams.year) {
      filters.push({
        key: 'year',
        label: 'Year',
        value: resolvedParams.year,
      })
    }
    if (resolvedParams.month) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ]
      filters.push({
        key: 'month',
        label: 'Month',
        value: monthNames[Number(resolvedParams.month) - 1] || resolvedParams.month,
      })
    }
    return filters
  }, [resolvedParams.staffId, resolvedParams.year, resolvedParams.month, staffs])

  const summaryCards = useMemo(() => {
    const totalSales = rows.reduce((sum, row) => sum + Number(row.total_sales || 0), 0)
    const totalBookings = rows.reduce((sum, row) => sum + (row.booking_count || 0), 0)
    const totalCommission = rows.reduce((sum, row) => {
      const amount = row.is_overridden && row.override_amount
        ? Number(row.override_amount)
        : Number(row.commission_amount || 0)
      return sum + amount
    }, 0)
    const overriddenCount = rows.filter((row) => row.is_overridden).length

    return [
      { label: 'Total Sales', value: totalSales, isMoney: true },
      { label: 'Total Bookings', value: totalBookings, isMoney: false },
      { label: 'Total Commission', value: totalCommission, isMoney: true },
      { label: 'Overridden', value: overriddenCount, isMoney: false },
    ]
  }, [rows])

  const visibleRows = useMemo(() => {
    const page = pagination.current_page || resolvedParams.page
    const start = (page - 1) * resolvedParams.perPage
    const end = start + resolvedParams.perPage
    return rows.slice(start, end)
  }, [pagination.current_page, resolvedParams.page, resolvedParams.perPage, rows])

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsFilterOpen(false)}
          />
          <div
            className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Filter</h2>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Staff</label>
                  <select
                    value={inputs.staff_id}
                    onChange={(e) => setInputs((prev) => ({ ...prev, staff_id: e.target.value }))}
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  >
                    <option value="">All Staff</option>
                    {staffs.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Year</label>
                  <select
                    value={inputs.year}
                    onChange={(e) => setInputs((prev) => ({ ...prev, year: e.target.value }))}
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  >
                    <option value="">All Years</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Month</label>
                  <select
                    value={inputs.month}
                    onChange={(e) => setInputs((prev) => ({ ...prev, month: e.target.value }))}
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  >
                    <option value="">All Months</option>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {monthNames[month - 1]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            disabled={loading}
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
            value={resolvedParams.perPage}
            onChange={(event) => {
              updateQuery({
                per_page: event.target.value,
                page: String(DEFAULT_PAGE),
              })
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs"
            >
              <span className="font-medium">{filter.label}</span>
              <span>{filter.value}</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800"
                onClick={() => {
                  updateQuery({
                    [filter.key]: '',
                    page: String(DEFAULT_PAGE),
                  })
                }}
                aria-label={`Remove ${filter.label} filter`}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Summary</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const value =
              card.value === null || card.value === undefined
                ? '—'
                : card.isMoney
                  ? `RM ${formatAmount(card.value)}`
                  : card.value.toLocaleString()

            return (
              <div key={card.label} className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="text-xs font-semibold uppercase text-slate-400">{card.label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-700">{value}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Staff
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Period
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Total Sales
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Booking Count
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Tier %
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Commission
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={7} />
            ) : visibleRows.length === 0 ? (
              <TableEmptyState colSpan={7} />
            ) : (
              visibleRows.map((row) => {
                const commissionAmount = row.is_overridden && row.override_amount
                  ? Number(row.override_amount)
                  : Number(row.commission_amount || 0)

                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.staff?.name ?? '-'}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.year}-{String(row.month).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      RM {formatAmount(Number(row.total_sales || 0))}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.booking_count}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      {Number(row.tier_percent || 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex flex-col">
                        <span>RM {formatAmount(commissionAmount)}</span>
                        {row.is_overridden && (
                          <span className="text-xs text-amber-600">(Overridden)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setOverrideTarget(row)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {row.is_overridden ? 'Edit Override' : 'Override'}
                      </button>
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
          onSuccess={handleOverrideSuccess}
        />
      )}
    </div>
  )
}
