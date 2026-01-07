'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type ReportMeta = {
  costing?: {
    missing_cost_products_count?: number | null
  }
}

type DailyTotals = {
  revenue?: number
  cogs?: number | null
  gross_profit?: number | null
}

type DailyRow = {
  date: string
  orders_count: number
  items_count: number
  revenue: number
  cogs?: number | null
  gross_profit?: number | null
}

type DailyReportResponse = {
  totals?: DailyTotals
  rows?: DailyRow[]
  pagination?: Partial<Pagination>
  meta?: ReportMeta
}

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1

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

const formatMargin = (value: number) => `${value.toFixed(2)}%`

export default function SalesDailyReportPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultRange = useMemo(() => getDefaultRange(), [])

  const resolvedParams = useMemo(() => {
    const parsedPage = Number(searchParams.get('page'))
    const parsedPerPage = Number(searchParams.get('per_page'))
    const hasValidPage = Number.isFinite(parsedPage) && parsedPage > 0
    const hasValidPerPage = Number.isFinite(parsedPerPage) && parsedPerPage > 0
    return {
      dateFrom: searchParams.get('date_from') ?? defaultRange.from,
      dateTo: searchParams.get('date_to') ?? defaultRange.to,
      page: hasValidPage ? parsedPage : DEFAULT_PAGE,
      perPage: hasValidPerPage ? parsedPerPage : DEFAULT_PAGE_SIZE,
      hasValidPage,
      hasValidPerPage,
      hasDateFrom: searchParams.has('date_from'),
      hasDateTo: searchParams.has('date_to'),
    }
  }, [defaultRange.from, defaultRange.to, searchParams])

  const [inputs, setInputs] = useState({
    date_from: resolvedParams.dateFrom,
    date_to: resolvedParams.dateTo,
  })
  const [rows, setRows] = useState<DailyRow[]>([])
  const [summary, setSummary] = useState<DailyTotals | null>(null)
  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    per_page: resolvedParams.perPage,
    current_page: resolvedParams.page,
    last_page: 1,
  })
  const [hasServerPagination, setHasServerPagination] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setInputs({
      date_from: resolvedParams.dateFrom,
      date_to: resolvedParams.dateTo,
    })
  }, [resolvedParams.dateFrom, resolvedParams.dateTo])

  useEffect(() => {
    const needsDefaults =
      !resolvedParams.hasDateFrom ||
      !resolvedParams.hasDateTo ||
      !resolvedParams.hasValidPage ||
      !resolvedParams.hasValidPerPage

    if (!needsDefaults) return

    const nextParams = new URLSearchParams(searchParams.toString())
    if (!resolvedParams.hasDateFrom) {
      nextParams.set('date_from', defaultRange.from)
    }
    if (!resolvedParams.hasDateTo) {
      nextParams.set('date_to', defaultRange.to)
    }
    if (!resolvedParams.hasValidPage) {
      nextParams.set('page', String(DEFAULT_PAGE))
    }
    if (!resolvedParams.hasValidPerPage) {
      nextParams.set('per_page', String(DEFAULT_PAGE_SIZE))
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
      qs.set('date_from', resolvedParams.dateFrom)
      qs.set('date_to', resolvedParams.dateTo)
      qs.set('page', String(resolvedParams.page))
      qs.set('per_page', String(resolvedParams.perPage))

      try {
        const response = await fetch(
          `/api/proxy/ecommerce/reports/sales/daily?${qs.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )
        if (!response.ok) {
          setRows([])
          setSummary(null)
          setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
          setHasServerPagination(false)
          return
        }
        const data: DailyReportResponse = await response.json()
        const responseRows = data.rows ?? []
        setRows(responseRows)
        setSummary(data.totals ?? null)
        setMeta(data.meta ?? null)
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
      } catch (error) {
        if (controller.signal.aborted) return
        setRows([])
        setSummary(null)
        setMeta(null)
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
  }, [resolvedParams.dateFrom, resolvedParams.dateTo, resolvedParams.page, resolvedParams.perPage])

  const updateQuery = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => params.set(key, value))
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleApply = () => {
    updateQuery({
      date_from: inputs.date_from || defaultRange.from,
      date_to: inputs.date_to || defaultRange.to,
      page: String(DEFAULT_PAGE),
      per_page: String(resolvedParams.perPage),
    })
  }

  const handleReset = () => {
    setInputs({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
    })
    updateQuery({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
      page: String(DEFAULT_PAGE),
      per_page: String(resolvedParams.perPage),
    })
  }

  const showingRange = `${formatDisplayDate(resolvedParams.dateFrom)} – ${formatDisplayDate(
    resolvedParams.dateTo,
  )}`

  const hasMissingCosts =
    (meta?.costing?.missing_cost_products_count ?? 0) > 0

  const summaryCards = useMemo(() => {
    const revenue = summary?.revenue ?? 0
    const cogs = summary?.cogs ?? null
    const grossProfit = summary?.gross_profit ?? null
    const margin =
      grossProfit !== null ? (revenue > 0 ? (grossProfit / revenue) * 100 : 0) : null

    return [
      { label: 'Revenue', value: revenue, isMoney: true },
      { label: 'COGS', value: cogs, isMoney: true },
      { label: 'Gross Profit', value: grossProfit, isMoney: true },
      { label: 'Gross Margin %', value: margin, isMoney: false },
    ]
  }, [summary])

  const visibleRows = useMemo(() => {
    if (hasServerPagination) return rows
    const page = pagination.current_page || resolvedParams.page
    const start = (page - 1) * resolvedParams.perPage
    const end = start + resolvedParams.perPage
    return rows.slice(start, end)
  }, [hasServerPagination, pagination.current_page, resolvedParams.page, resolvedParams.perPage, rows])

  const buildOrdersLink = (date: string) => {
    const params = new URLSearchParams({
      date_from: date,
      date_to: date,
      payment_status: 'paid',
      status: 'completed',
    })
    return `/orders?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {hasMissingCosts ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Some products are missing cost price. Profit may be inaccurate.
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-4">
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
            <button
              type="button"
              onClick={handleApply}
              className="h-10 rounded bg-blue-600 px-4 text-sm font-semibold text-white shadow hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="h-10 rounded border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Showing:</span> {showingRange}
          </div>
        </div>
      </div>

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
                : formatMargin(card.value)

            return (
              <div key={card.label} className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="text-xs font-semibold uppercase text-slate-400">{card.label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-700">{value}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-700">
          Sales Summary (Daily)
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 border border-slate-200 font-semibold">Date</th>
                <th className="px-4 py-3 border border-slate-200 font-semibold">Orders</th>
                <th className="px-4 py-3 border border-slate-200 font-semibold">Items</th>
                <th className="px-4 py-3 border border-slate-200 font-semibold">Revenue</th>
                <th className="px-4 py-3 border border-slate-200 font-semibold">COGS</th>
                <th className="px-4 py-3 border border-slate-200 font-semibold">Gross Profit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingRow colSpan={6} />
              ) : visibleRows.length === 0 ? (
                <TableEmptyState colSpan={6} />
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.date}>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      <Link
                        href={buildOrdersLink(row.date)}
                        className="text-blue-600 hover:underline"
                      >
                        {formatDisplayDate(row.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.orders_count}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.items_count}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      RM {formatAmount(row.revenue)}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.cogs === null || row.cogs === undefined
                        ? '—'
                        : `RM ${formatAmount(row.cogs)}`}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.gross_profit === null || row.gross_profit === undefined
                        ? '—'
                        : `RM ${formatAmount(row.gross_profit)}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">
          <PaginationControls
            currentPage={pagination.current_page}
            totalPages={pagination.last_page}
            pageSize={pagination.per_page}
            onPageChange={(page) => updateQuery({ page: String(page) })}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  )
}
