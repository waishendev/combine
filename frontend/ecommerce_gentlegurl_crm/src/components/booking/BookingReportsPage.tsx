'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from '../PaginationControls'
import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type SummaryTotals = {
  total_bookings: number
  completed_count: number
  notified_cancellation_count: number
  deposit_collected: number
}

type SummaryRow = {
  period: string
  total_bookings: number
  notified_cancellation_count: number
  completed_count: number
  deposit_collected: number
}

type BookingReportResponse = {
  rows?: SummaryRow[]
  grand_totals?: SummaryTotals
  totals_page?: SummaryTotals
  pagination?: Partial<Pagination>
}

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1
const PAGE_SIZE_OPTIONS = [15, 50, 100, 150, 200]

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: formatDateInput(start),
    to: formatDateInput(end),
  }
}

const formatDisplayDate = (dateString: string) => {
  if (!dateString) return '—'
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const formatAmount = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function BookingReportsPage({ canExport = false }: { canExport?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultRange = useMemo(() => getDefaultRange(), [])

  const resolvedParams = useMemo(() => {
    const parsedPage = Number(searchParams.get('page'))
    const parsedPerPage = Number(searchParams.get('per_page'))
    const groupBy = searchParams.get('group_by') || 'day'
    const hasValidPage = Number.isFinite(parsedPage) && parsedPage > 0
    const hasValidPerPage = Number.isFinite(parsedPerPage) && parsedPerPage > 0
    return {
      dateFrom: searchParams.get('from') ?? defaultRange.from,
      dateTo: searchParams.get('to') ?? defaultRange.to,
      groupBy,
      page: hasValidPage ? parsedPage : DEFAULT_PAGE,
      perPage: hasValidPerPage ? parsedPerPage : DEFAULT_PAGE_SIZE,
      hasValidPage,
      hasValidPerPage,
      hasDateFrom: searchParams.has('from'),
      hasDateTo: searchParams.has('to'),
    }
  }, [defaultRange.from, defaultRange.to, searchParams])

  const [inputs, setInputs] = useState({
    date_from: resolvedParams.dateFrom,
    date_to: resolvedParams.dateTo,
    group_by: resolvedParams.groupBy,
  })
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [totalsPage, setTotalsPage] = useState<SummaryTotals | null>(null)
  const [grandTotals, setGrandTotals] = useState<SummaryTotals | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    per_page: resolvedParams.perPage,
    current_page: resolvedParams.page,
    last_page: 1,
  })
  const [hasServerPagination, setHasServerPagination] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  useEffect(() => {
    setInputs({
      date_from: resolvedParams.dateFrom,
      date_to: resolvedParams.dateTo,
      group_by: resolvedParams.groupBy,
    })
  }, [resolvedParams.dateFrom, resolvedParams.dateTo, resolvedParams.groupBy])

  useEffect(() => {
    const needsDefaults =
      !resolvedParams.hasDateFrom ||
      !resolvedParams.hasDateTo ||
      !resolvedParams.hasValidPage ||
      !resolvedParams.hasValidPerPage

    if (!needsDefaults) return

    const nextParams = new URLSearchParams(searchParams.toString())
    if (!resolvedParams.hasDateFrom) {
      nextParams.set('from', defaultRange.from)
    }
    if (!resolvedParams.hasDateTo) {
      nextParams.set('to', defaultRange.to)
    }
    if (!resolvedParams.hasValidPage) {
      nextParams.set('page', String(DEFAULT_PAGE))
    }
    if (!resolvedParams.hasValidPerPage) {
      nextParams.set('per_page', String(DEFAULT_PAGE_SIZE))
    }
    if (!searchParams.has('group_by')) {
      nextParams.set('group_by', 'day')
    }

    router.replace(`${pathname}?${nextParams.toString()}`)
  }, [
    defaultRange.from,
    defaultRange.to,
    pathname,
    resolvedParams.hasDateFrom,
    resolvedParams.hasDateTo,
    resolvedParams.hasValidPage,
    resolvedParams.hasValidPerPage,
    router,
    searchParams,
  ])

  useEffect(() => {
    const controller = new AbortController()
    const fetchReport = async () => {
      setLoading(true)
      const qs = new URLSearchParams()
      qs.set('from', resolvedParams.dateFrom)
      qs.set('to', resolvedParams.dateTo)
      qs.set('group_by', resolvedParams.groupBy)
      qs.set('page', String(resolvedParams.page))
      qs.set('per_page', String(resolvedParams.perPage))

      try {
        const response = await fetch(
          `/api/proxy/admin/booking/reports/summary?${qs.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )
        if (!response.ok) {
          setRows([])
          setTotalsPage(null)
          setGrandTotals(null)
          setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
          setHasServerPagination(false)
          return
        }
        const data: BookingReportResponse = await response.json()
        const responseRows = data.rows ?? []
        setRows(responseRows)
        setTotalsPage(data.totals_page ?? null)
        setGrandTotals(data.grand_totals ?? null)
        const hasPagination = Boolean(data.pagination)
        setHasServerPagination(hasPagination)

        if (hasPagination) {
          setPagination({
            total: data.pagination?.total ?? responseRows.length,
            per_page: data.pagination?.per_page ?? resolvedParams.perPage,
            current_page: data.pagination?.current_page ?? resolvedParams.page,
            last_page: data.pagination?.last_page ?? 1,
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
        setTotalsPage(null)
        setGrandTotals(null)
        setHasServerPagination(false)
        setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchReport()

    return () => controller.abort()
  }, [resolvedParams.dateFrom, resolvedParams.dateTo, resolvedParams.groupBy, resolvedParams.page, resolvedParams.perPage])

  const updateQuery = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => params.set(key, value))
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleApply = () => {
    updateQuery({
      from: inputs.date_from || defaultRange.from,
      to: inputs.date_to || defaultRange.to,
      group_by: inputs.group_by || 'day',
      page: String(DEFAULT_PAGE),
      per_page: String(resolvedParams.perPage),
    })
    setIsFilterOpen(false)
  }

  const handleReset = () => {
    setInputs({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
      group_by: 'day',
    })
    updateQuery({
      from: defaultRange.from,
      to: defaultRange.to,
      group_by: 'day',
      page: String(DEFAULT_PAGE),
      per_page: String(resolvedParams.perPage),
    })
    setIsFilterOpen(false)
  }

  const showingRange = `${formatDisplayDate(resolvedParams.dateFrom)} – ${formatDisplayDate(
    resolvedParams.dateTo,
  )}`

  const exportUrl = useMemo(() => {
    if (!canExport) return ''
    const qs = new URLSearchParams()
    qs.set('from', resolvedParams.dateFrom)
    qs.set('to', resolvedParams.dateTo)
    qs.set('group_by', resolvedParams.groupBy)
    return `/api/proxy/admin/booking/reports/summary/export.csv?${qs.toString()}`
  }, [canExport, resolvedParams.dateFrom, resolvedParams.dateTo, resolvedParams.groupBy])

  const activeFilters = useMemo(() => {
    if (!resolvedParams.hasDateFrom || !resolvedParams.hasDateTo) {
      return []
    }
    return [
      {
        key: 'date_range',
        label: 'Date Range',
        value: showingRange,
      },
      {
        key: 'group_by',
        label: 'Group By',
        value: resolvedParams.groupBy === 'day' ? 'Day' : resolvedParams.groupBy === 'week' ? 'Week' : 'Month',
      },
    ]
  }, [resolvedParams.hasDateFrom, resolvedParams.hasDateTo, resolvedParams.groupBy, showingRange])

  const summaryCards = useMemo(() => {
    if (!grandTotals) return []
    return [
      { label: 'Total', value: grandTotals.total_bookings, isMoney: false },
      { label: 'Completed Bookings', value: grandTotals.completed_count, isMoney: false },
      { label: 'Notified Cancel', value: grandTotals.notified_cancellation_count, isMoney: false },
      { label: 'Deposit Collected', value: grandTotals.deposit_collected, isMoney: true },
    ]
  }, [grandTotals])

  const visibleRows = useMemo(() => {
    if (hasServerPagination) return rows
    const page = pagination.current_page || resolvedParams.page
    const start = (page - 1) * resolvedParams.perPage
    const end = start + resolvedParams.perPage
    return rows.slice(start, end)
  }, [hasServerPagination, pagination.current_page, resolvedParams.page, resolvedParams.perPage, rows])

  const pageTotals = useMemo(() => {
    if (totalsPage) return totalsPage
    if (visibleRows.length === 0) {
      return null
    }
    return visibleRows.reduce(
      (acc, row) => {
        acc.total_bookings += row.total_bookings
        acc.completed_count += row.completed_count
        acc.notified_cancellation_count += row.notified_cancellation_count
        acc.deposit_collected += Number(row.deposit_collected || 0)
        return acc
      },
      {
        total_bookings: 0,
        completed_count: 0,
        notified_cancellation_count: 0,
        deposit_collected: 0,
      },
    )
  }, [totalsPage, visibleRows])

  const maxTotal = useMemo(() => Math.max(1, ...rows.map((r) => Number(r.total_bookings || 0))), [rows])

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
              <h2 className="text-lg font-semibold">
                Filter
              </h2>
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
                  <label className="text-xs font-semibold text-slate-500">Date From</label>
                  <input
                    type="date"
                    value={inputs.date_from}
                    onChange={(event) =>
                      setInputs((prev) => ({ ...prev, date_from: event.target.value }))
                    }
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Date To</label>
                  <input
                    type="date"
                    value={inputs.date_to}
                    onChange={(event) =>
                      setInputs((prev) => ({ ...prev, date_to: event.target.value }))
                    }
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Group By</label>
                  <select
                    value={inputs.group_by}
                    onChange={(event) =>
                      setInputs((prev) => ({ ...prev, group_by: event.target.value }))
                    }
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
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
          {canExport ? (
            <a
              href={exportUrl}
              className="flex items-center gap-2 rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:border-emerald-700 hover:bg-emerald-700"
            >
              <i className="fa-solid fa-download" />
              Export CSV
            </a>
          ) : null}
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
                  if (filter.key === 'date_range') {
                    handleReset()
                  } else {
                    updateQuery({
                      group_by: 'day',
                      page: String(DEFAULT_PAGE),
                    })
                  }
                }}
                aria-label={`Remove ${filter.label} filter`}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ))}
        </div>
      )}

      {summaryCards.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Summary (Grand Total)</span>
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
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Period
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Total
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Completed
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Notified Cancel
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Deposit
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={5} />
            ) : visibleRows.length === 0 ? (
              <TableEmptyState colSpan={5} />
            ) : (
              visibleRows.map((row) => (
                <tr key={row.period} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border border-gray-200 font-medium">
                    {row.period}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span>{row.total_bookings}</span>
                      </div>
                      <div className="h-2 w-full rounded bg-gray-200">
                        <div
                          className="h-2 rounded bg-blue-500"
                          style={{ width: `${(Number(row.total_bookings || 0) / maxTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 border border-gray-200">{row.completed_count}</td>
                  <td className="px-4 py-2 border border-gray-200">{row.notified_cancellation_count}</td>
                  <td className="px-4 py-2 border border-gray-200">
                    RM {formatAmount(Number(row.deposit_collected || 0))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {pageTotals && (
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td className="border border-gray-300 px-4 py-2 text-left">Page Totals</td>
                <td className="border border-gray-300 px-4 py-2 text-left text-sm">
                  {pageTotals.total_bookings}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-left text-sm">
                  {pageTotals.completed_count}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-left text-sm">
                  {pageTotals.notified_cancellation_count}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-left text-sm">
                  RM {formatAmount(pageTotals.deposit_collected)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <PaginationControls
        currentPage={pagination.current_page}
        totalPages={pagination.last_page}
        pageSize={pagination.per_page}
        onPageChange={(page) => updateQuery({ page: String(page) })}
        disabled={loading}
      />
    </div>
  )
}
