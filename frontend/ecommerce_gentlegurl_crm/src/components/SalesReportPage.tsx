'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

type ReportType = 'by-category' | 'top-products' | 'top-customers'

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

type CategoryRow = {
  category_id: number
  category_name: string
  orders_count: number
  items_count: number
  revenue: number
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
  cogs?: number | null
  gross_profit?: number | null
}

type ReportResponse = {
  date_range?: {
    from?: string
    to?: string
  }
  rows?: CategoryRow[] | ProductRow[] | CustomerRow[]
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

export default function SalesReportPage({ reportType }: { reportType: ReportType }) {
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
  const [rows, setRows] = useState<CategoryRow[] | ProductRow[] | CustomerRow[]>([])
  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    per_page: resolvedParams.perPage,
    current_page: resolvedParams.page,
    last_page: 1,
  })
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
          `/api/proxy/reports/sales/${reportType}?${qs.toString()}`,
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
        const data: ReportResponse = await response.json()
        setRows(data.rows ?? [])
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
        setPagination((prev) => ({ ...prev, total: 0, last_page: 1 }))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchReport()

    return () => controller.abort()
  }, [reportType, resolvedParams.dateFrom, resolvedParams.dateTo, resolvedParams.page, resolvedParams.perPage])

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

  const showProfit = meta?.profit_supported === true
  const showingRange = `${formatDisplayDate(resolvedParams.dateFrom)} – ${formatDisplayDate(
    resolvedParams.dateTo,
  )}`

  const columns = useMemo(() => {
    const baseColumns =
      reportType === 'by-category'
        ? ['Category', 'Orders', 'Items', 'Revenue']
        : reportType === 'top-products'
        ? ['Product', 'SKU', 'Orders', 'Items', 'Revenue']
        : ['Customer', 'Email', 'Orders', 'Items', 'Revenue']

    if (!showProfit) {
      return baseColumns
    }

    return [...baseColumns, 'COGS', 'Gross Profit']
  }, [reportType, showProfit])

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

  return (
    <div className="space-y-6">
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
            <div>
              <span className="font-semibold text-slate-700">Showing:</span> {showingRange}
            </div>
            {meta?.default_range_applied ? (
              <div className="text-xs text-slate-400">Default range applied (This month)</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 border border-slate-200 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingRow colSpan={columns.length} />
              ) : rows.length === 0 ? (
                <TableEmptyState colSpan={columns.length} />
              ) : reportType === 'by-category' ? (
                (rows as CategoryRow[]).map((row) => (
                  <tr key={row.category_id}>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.category_name}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.orders_count}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.items_count}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      RM {formatAmount(row.revenue)}
                    </td>
                    {renderProfitCells(row)}
                  </tr>
                ))
              ) : reportType === 'top-products' ? (
                (rows as ProductRow[]).map((row) => (
                  <tr key={row.product_id}>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.product_name}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.sku ?? '—'}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.orders_count}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.items_count}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      RM {formatAmount(row.revenue)}
                    </td>
                    {renderProfitCells(row)}
                  </tr>
                ))
              ) : (
                (rows as CustomerRow[]).map((row) => (
                  <tr key={row.customer_id}>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.customer_name}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.customer_email ?? '—'}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.orders_count}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.items_count}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      RM {formatAmount(row.revenue)}
                    </td>
                    {renderProfitCells(row)}
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
