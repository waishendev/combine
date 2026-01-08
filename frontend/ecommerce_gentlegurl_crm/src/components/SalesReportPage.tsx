'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

type ReportType = 'by-category' | 'by-products' | 'by-customers'

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type ReportMeta = {
  default_range_applied?: boolean
  profit_supported?: boolean
}

type ReportSummary = {
  revenue?: number
  return_amount?: number
  net_revenue?: number
  cogs?: number | null
  gross_profit?: number | null
  gross_margin?: number | null
}

type CategoryRow = {
  category_id: number
  category_name: string
  orders_count: number
  items_count: number
  revenue: number
  return_amount?: number
  net_revenue?: number
  cogs?: number | null
  gross_profit?: number | null
}

type ProductRow = {
  product_id: number
  product_name: string
  sku: string | null
  orders_count: number
  items_count: number
  revenue: number
  return_amount?: number
  net_revenue?: number
  cogs?: number | null
  gross_profit?: number | null
}

type CustomerRow = {
  customer_id: number
  customer_name: string
  customer_email: string | null
  orders_count: number
  items_count: number
  revenue: number
  return_amount?: number
  net_revenue?: number
  cogs?: number | null
  gross_profit?: number | null
}

type ReportResponse = {
  date_range?: {
    from?: string
    to?: string
  }
  totals_page?: ReportSummary
  grand_totals?: ReportSummary
  tops?: CategoryRow[] | ProductRow[] | CustomerRow[]
  rows?: CategoryRow[] | ProductRow[] | CustomerRow[]
  pagination?: Partial<Pagination>
  meta?: ReportMeta
}

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1
const DEFAULT_TOP_COUNT = 5
const TOP_N_OPTIONS = [5, 10, 20, 50]
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

const formatMargin = (value: number) => `${value.toFixed(2)}%`

export default function SalesReportPage({
  reportType,
  canExport = false,
}: {
  reportType: ReportType
  canExport?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultRange = useMemo(() => getDefaultRange(), [])

  const resolvedParams = useMemo(() => {
    const parsedPage = Number(searchParams.get('page'))
    const parsedPerPage = Number(searchParams.get('per_page'))
    const hasValidPage = Number.isFinite(parsedPage) && parsedPage > 0
    const hasValidPerPage = Number.isFinite(parsedPerPage) && parsedPerPage > 0
    const parsedTop = Number(searchParams.get('top'))
    const hasValidTop = Number.isFinite(parsedTop) && parsedTop > 0
    return {
      dateFrom: searchParams.get('date_from') ?? defaultRange.from,
      dateTo: searchParams.get('date_to') ?? defaultRange.to,
      page: hasValidPage ? parsedPage : DEFAULT_PAGE,
      perPage: hasValidPerPage ? parsedPerPage : DEFAULT_PAGE_SIZE,
      top: hasValidTop ? parsedTop : DEFAULT_TOP_COUNT,
      hasValidPage,
      hasValidPerPage,
      hasValidTop,
      hasDateFrom: searchParams.has('date_from'),
      hasDateTo: searchParams.has('date_to'),
    }
  }, [defaultRange.from, defaultRange.to, searchParams])

  const [inputs, setInputs] = useState({
    date_from: resolvedParams.dateFrom,
    date_to: resolvedParams.dateTo,
  })
  const [rows, setRows] = useState<CategoryRow[] | ProductRow[] | CustomerRow[]>([])
  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [totalsPage, setTotalsPage] = useState<ReportSummary | null>(null)
  const [grandTotals, setGrandTotals] = useState<ReportSummary | null>(null)
  const [tops, setTops] = useState<CategoryRow[] | ProductRow[] | CustomerRow[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    per_page: resolvedParams.perPage,
    current_page: resolvedParams.page,
    last_page: 1,
  })
  const [loading, setLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null,
  )

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
      !resolvedParams.hasValidPerPage ||
      !resolvedParams.hasValidTop

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
    if (!resolvedParams.hasValidTop) {
      nextParams.set('top', String(DEFAULT_TOP_COUNT))
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
    resolvedParams.hasValidTop,
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
      qs.set('top', String(resolvedParams.top))

      try {
        const response = await fetch(
          `/api/proxy/ecommerce/reports/sales/${reportType}?${qs.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )
        if (!response.ok) {
          setRows([])
          setTotalsPage(null)
          setGrandTotals(null)
          setTops([])
          setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
          return
        }
        const data: ReportResponse = await response.json()
        const normalizedRows = (data.rows ?? []).map((row) => ({
          ...row,
          net_revenue: row.net_revenue ?? row.revenue,
          return_amount: row.return_amount ?? 0,
        }))
        setRows(normalizedRows)
        setTotalsPage(data.totals_page ?? null)
        setGrandTotals(data.grand_totals ?? null)
        setTops(data.tops ?? [])
        if (data.meta) {
          setMeta(data.meta)
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Sales Report ${reportType}] meta`, data.meta)
          }
        }
        setPagination({
          total: data.pagination?.total ?? 0,
          per_page: data.pagination?.per_page ?? resolvedParams.perPage,
          current_page: data.pagination?.current_page ?? resolvedParams.page,
          last_page: data.pagination?.last_page ?? 1,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setRows([])
        setTotalsPage(null)
        setGrandTotals(null)
        setTops([])
        setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchReport()

    return () => controller.abort()
  }, [
    reportType,
    resolvedParams.dateFrom,
    resolvedParams.dateTo,
    resolvedParams.page,
    resolvedParams.perPage,
    resolvedParams.top,
  ])

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
    setIsFilterOpen(false)
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
    setIsFilterOpen(false)
  }

  const showProfit = meta?.profit_supported === true
  const showingRange = `${formatDisplayDate(resolvedParams.dateFrom)} – ${formatDisplayDate(
    resolvedParams.dateTo,
  )}`
  const exportUrl = useMemo(() => {
    if (!canExport) return ''
    const qs = new URLSearchParams()
    qs.set('date_from', resolvedParams.dateFrom)
    qs.set('date_to', resolvedParams.dateTo)
    qs.set('format', 'csv')
    return `/api/proxy/ecommerce/reports/sales/export/${reportType}?${qs.toString()}`
  }, [canExport, reportType, resolvedParams.dateFrom, resolvedParams.dateTo])

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = []
    if (resolvedParams.hasDateFrom && resolvedParams.hasDateTo) {
      filters.push({
        key: 'date_range',
        label: 'Date Range',
        value: showingRange,
      })
    }
    if (resolvedParams.top !== DEFAULT_TOP_COUNT) {
      filters.push({
        key: 'top',
        label: 'Top N',
        value: String(resolvedParams.top),
      })
    }
    return filters
  }, [resolvedParams.hasDateFrom, resolvedParams.hasDateTo, resolvedParams.top, showingRange])

  const columns = useMemo(() => {
    const baseColumns =
      reportType === 'by-category'
        ? [
            { label: 'Category', key: 'category_name' },
            { label: 'Orders', key: 'orders_count', sortable: true },
            { label: 'Items', key: 'items_count', sortable: true },
            { label: 'NET REVENUE', key: 'net_revenue', sortable: true },
          ]
        : reportType === 'by-products'
        ? [
            { label: 'Product', key: 'product_name' },
            { label: 'SKU', key: 'sku' },
            { label: 'Orders', key: 'orders_count', sortable: true },
            { label: 'Items', key: 'items_count', sortable: true },
            { label: 'NET REVENUE', key: 'net_revenue', sortable: true },
          ]
        : [
            { label: 'Customer', key: 'customer_name' },
            { label: 'Email', key: 'customer_email' },
            { label: 'Orders', key: 'orders_count', sortable: true },
            { label: 'Items', key: 'items_count', sortable: true },
            { label: 'NET REVENUE', key: 'net_revenue', sortable: true },
          ]

    if (!showProfit) {
      return baseColumns
    }

    return [
      ...baseColumns,
      { label: 'COGS', key: 'cogs', sortable: true },
      { label: 'Gross Profit', key: 'gross_profit', sortable: true },
    ]
  }, [reportType, showProfit])

  const filteredRows = rows

  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows
    const { key, direction } = sortConfig
    return [...filteredRows].sort((a, b) => {
      const aValue = Number((a as unknown as Record<string, number | null>)[key] ?? 0)
      const bValue = Number((b as unknown as Record<string, number | null>)[key] ?? 0)
      if (aValue === bValue) return 0
      return direction === 'asc' ? aValue - bValue : bValue - aValue
    })
  }, [filteredRows, sortConfig])

  const totalsPageSource = useMemo(() => {
    if (totalsPage) {
      return {
        summary: {
          ...totalsPage,
          net_revenue: totalsPage.net_revenue ?? totalsPage.revenue,
          return_amount: totalsPage.return_amount ?? 0,
        },
        isFallback: false,
      }
    }
    const revenue = sortedRows.reduce((total, row) => total + (row.revenue ?? 0), 0)
    const returnAmount = sortedRows.reduce((total, row) => total + (row.return_amount ?? 0), 0)
    const netRevenue = revenue - returnAmount
    const cogsTotal = showProfit
      ? sortedRows.reduce((total, row) => total + (row.cogs ?? 0), 0)
      : null
    const grossProfit = showProfit && cogsTotal !== null ? netRevenue - cogsTotal : null
    const grossMargin =
      grossProfit !== null && netRevenue > 0 ? (grossProfit / netRevenue) * 100 : null
    return {
      summary: {
        revenue,
        return_amount: returnAmount,
        net_revenue: netRevenue,
        cogs: cogsTotal,
        gross_profit: grossProfit,
        gross_margin: grossMargin,
      },
      isFallback: true,
    }
  }, [showProfit, sortedRows, totalsPage])

  const summaryCards = [
    { label: 'NET REVENUE', value: totalsPageSource.summary.net_revenue, isMoney: true },
    { label: 'COGS', value: totalsPageSource.summary.cogs, isMoney: true },
    { label: 'Gross Profit', value: totalsPageSource.summary.gross_profit, isMoney: true },
    { label: 'Gross Margin %', value: totalsPageSource.summary.gross_margin, isMoney: false },
  ]

  const grandTotalCards = [
    { label: 'NET REVENUE', value: grandTotals?.net_revenue ?? grandTotals?.revenue, isMoney: true },
    { label: 'COGS', value: grandTotals?.cogs, isMoney: true },
    { label: 'Gross Profit', value: grandTotals?.gross_profit, isMoney: true },
    { label: 'Gross Margin %', value: grandTotals?.gross_margin, isMoney: false },
  ]

  // Get amount columns for tfoot
  const amountColumns = useMemo(() => {
    const cols: Array<{ key: string; label: string }> = [
      { key: 'net_revenue', label: 'NET REVENUE' },
    ]
    if (showProfit) {
      cols.push({ key: 'cogs', label: 'COGS' })
      cols.push({ key: 'gross_profit', label: 'Gross Profit' })
    }
    return cols
  }, [showProfit])

  const renderProfitCells = (row: CategoryRow | ProductRow | CustomerRow) => {
    if (!showProfit) return null
    const cogs = row.cogs ?? 0
    const grossProfit = row.gross_profit ?? 0
    return (
      <>
        <td className="px-4 py-2 border border-gray-200">RM {formatAmount(cogs)}</td>
        <td className="px-4 py-2 border border-gray-200">RM {formatAmount(grossProfit)}</td>
      </>
    )
  }

  const topLabel =
    reportType === 'by-category' ? 'Category' : reportType === 'by-products' ? 'Product' : 'Customer'
  const topTitle =
    reportType === 'by-category' ? 'Categories' : reportType === 'by-products' ? 'Products' : 'Customers'

  return (
    <div className="space-y-6">
      {isFilterOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsFilterOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Filters</p>
                <h3 className="text-lg font-semibold text-slate-700">Refine report data</h3>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                onClick={() => setIsFilterOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Top N</label>
                <select
                  className="h-10 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
                  value={resolvedParams.top}
                  onChange={(event) => {
                    updateQuery({
                      top: event.target.value,
                    })
                  }}
                >
                  {TOP_N_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="h-10 rounded border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="h-10 rounded bg-blue-600 px-4 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                Apply
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
                  } else if (filter.key === 'top') {
                    updateQuery({
                      top: String(DEFAULT_TOP_COUNT),
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">
          <span>
            Top {resolvedParams.top} {topTitle}
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading ? (
            <div className="col-span-full text-sm text-slate-400">Loading top performers...</div>
          ) : tops.length === 0 ? (
            <div className="col-span-full text-sm text-slate-400">No top results found.</div>
          ) : (
            tops.map((row) => {
              const name =
                'category_name' in row
                  ? row.category_name
                  : 'product_name' in row
                  ? row.product_name
                  : row.customer_name
              return (
                <div
                  key={
                    'category_id' in row ? row.category_id : 'product_id' in row ? row.product_id : row.customer_id
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase text-slate-400">{topLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{name}</p>
                  <p className="text-xs font-semibold uppercase text-slate-400 mt-2">NET REVENUE</p>
                  <p className="text-lg font-semibold text-slate-700">
                    RM {formatAmount(row.net_revenue ?? row.revenue)}
                  </p>

                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
              <tr>
                {columns.map((column) => {
                  const isSortable = column.sortable
                  const isActive = sortConfig?.key === column.key
                  const nextDirection =
                    isActive && sortConfig?.direction === 'desc' ? 'asc' : 'desc'
                  return (
                    <th
                      key={column.label}
                      className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                    >
                      <button
                        type="button"
                        className={`flex items-center gap-1 ${
                          isSortable ? 'cursor-pointer select-none' : 'cursor-default'
                        }`}
                        onClick={() => {
                          if (!isSortable) return
                          setSortConfig({ key: column.key, direction: nextDirection })
                        }}
                      >
                        <span>{column.label}</span>
                        {isSortable ? (
                          <svg
                            className="ml-1 inline-block align-middle"
                            width="15"
                            height="15"
                            viewBox="0 0 10 12"
                            aria-hidden="true"
                            focusable="false"
                          >
                            <path
                              d="M5 1 L9 5 H1 Z"
                              fill={
                                isActive && sortConfig?.direction === 'asc'
                                  ? '#122350ff'
                                  : '#afb2b8ff'
                              }
                            />
                            <path
                              d="M5 11 L1 7 H9 Z"
                              fill={
                                isActive && sortConfig?.direction === 'desc'
                                  ? '#122350ff'
                                  : '#afb2b8ff'
                              }
                            />
                          </svg>
                        ) : null}
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingRow colSpan={columns.length} />
              ) : sortedRows.length === 0 ? (
                <TableEmptyState colSpan={columns.length} />
              ) : reportType === 'by-category' ? (
                (sortedRows as CategoryRow[]).map((row) => (
                  <tr key={row.category_id}>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.category_name}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.orders_count}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.items_count}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      RM {formatAmount(row.net_revenue ?? row.revenue)}
                    </td>
                    {renderProfitCells(row)}
                  </tr>
                ))
              ) : reportType === 'by-products' ? (
                (sortedRows as ProductRow[]).map((row) => (
                  <tr key={row.product_id}>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.product_name}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.sku ?? '—'}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.orders_count}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.items_count}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      RM {formatAmount(row.net_revenue ?? row.revenue)}
                    </td>
                    {renderProfitCells(row)}
                  </tr>
                ))
              ) : (
                (sortedRows as CustomerRow[]).map((row) => (
                  <tr key={row.customer_id}>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.customer_name}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.customer_email ?? '—'}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.orders_count}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.items_count}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      RM {formatAmount(row.net_revenue ?? row.revenue)}
                    </td>
                    {renderProfitCells(row)}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td className="border border-gray-300 px-4 py-2 text-left">
                  Page Totals
                </td>
                {columns.slice(1).map((column) => {
                  const isAmountColumn = amountColumns.some((ac) => ac.key === column.key)
                  if (!isAmountColumn) {
                    return (
                      <td
                        key={column.key}
                        className="border border-gray-300 px-4 py-2 text-left text-sm"
                      >
                        —
                      </td>
                    )
                  }
                  const amountKey = column.key as keyof ReportSummary
                  const amountValue = totalsPageSource.summary[amountKey] ?? 0
                  return (
                    <td
                      key={column.key}
                      className="border border-gray-300 px-4 py-2 text-left text-sm"
                    >
                      <span>RM {formatAmount(Number(amountValue))}</span>
                    </td>
                  )
                })}
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td className="border border-gray-300 px-4 py-2 text-left">
                  Grand Totals
                </td>
                {columns.slice(1).map((column) => {
                  const isAmountColumn = amountColumns.some((ac) => ac.key === column.key)
                  if (!isAmountColumn) {
                    return (
                      <td
                        key={column.key}
                        className="border border-gray-300 px-4 py-2 text-left text-sm"
                      >
                        —
                      </td>
                    )
                  }
                  const amountKey = column.key as keyof ReportSummary
                  const amountValue = grandTotals?.[amountKey] ?? 0
                  return (
                    <td
                      key={column.key}
                      className="border border-gray-300 px-4 py-2 text-left text-sm"
                    >
                      <span>RM {formatAmount(Number(amountValue))}</span>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
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
