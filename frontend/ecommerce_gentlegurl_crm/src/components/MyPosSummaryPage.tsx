'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

type Summary = {
  orders_count: number
  items_count: number
  items_with_staff_count: number
  items_without_staff_count: number
  total_item_amount: number
  total_staff_commission: number
  my_commission: number
}

type StaffSplit = {
  staff_id: number | null
  staff_name: string | null
  share_percent: number
  commission_rate_snapshot: number
  staff_commission_amount: number
}

type DetailRow = {
  order_no: string | null
  order_id: number
  order_date: string
  order_item_id: number
  product_name: string | null
  qty: number
  item_total_price: number
  has_staff_assignment: boolean
  staff_splits: StaffSplit[]
}

const money = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1
const PAGE_SIZE_OPTIONS = [15, 50, 100, 150, 200]

const emptySummary: Summary = {
  orders_count: 0,
  items_count: 0,
  items_with_staff_count: 0,
  items_without_staff_count: 0,
  total_item_amount: 0,
  total_staff_commission: 0,
  my_commission: 0,
}

export default function MyPosSummaryPage() {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [filterInputs, setFilterInputs] = useState({
    date_from: defaultRange.from,
    date_to: defaultRange.to,
  })
  const [appliedFilters, setAppliedFilters] = useState({
    date_from: defaultRange.from,
    date_to: defaultRange.to,
  })
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [rows, setRows] = useState<DetailRow[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE)

  const loadData = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        start_date: appliedFilters.date_from,
        end_date: appliedFilters.date_to,
        page: String(page),
        per_page: String(perPage),
      })

      const res = await fetch(`/api/proxy/ecommerce/reports/my-pos-summary?${qs.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        setSummary(emptySummary)
        setRows([])
        setCurrentPage(1)
        setLastPage(1)
        setTotal(0)
        return
      }

      const json = await res.json().catch(() => ({}))
      setSummary(json?.summary ?? emptySummary)
      setRows(Array.isArray(json?.data) ? json.data : [])
      setCurrentPage(Number(json?.meta?.current_page ?? 1))
      setLastPage(Number(json?.meta?.last_page ?? 1))
      setTotal(Number(json?.meta?.total ?? 0))
      setExpanded({})
    } finally {
      setLoading(false)
    }
  }, [appliedFilters.date_from, appliedFilters.date_to, perPage])

  useEffect(() => {
    loadData(1).catch(() => {})
  }, [loadData])

  const handleApply = () => {
    setAppliedFilters({
      date_from: filterInputs.date_from || defaultRange.from,
      date_to: filterInputs.date_to || defaultRange.to,
    })
    setCurrentPage(1)
    setIsFilterOpen(false)
  }

  const handleReset = () => {
    setFilterInputs({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
    })
    setAppliedFilters({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
    })
    setCurrentPage(1)
    setIsFilterOpen(false)
  }

  const showingRange = `${formatDisplayDate(appliedFilters.date_from)} – ${formatDisplayDate(
    appliedFilters.date_to,
  )}`

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = []
    filters.push({
      key: 'date_range',
      label: 'Date Range',
      value: showingRange,
    })
    return filters
  }, [showingRange])

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
                    value={filterInputs.date_from}
                    onChange={(event) =>
                      setFilterInputs((prev) => ({ ...prev, date_from: event.target.value }))
                    }
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Date To</label>
                  <input
                    type="date"
                    value={filterInputs.date_to}
                    onChange={(event) =>
                      setFilterInputs((prev) => ({ ...prev, date_to: event.target.value }))
                    }
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  />
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
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value))
              setCurrentPage(1)
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
                onClick={handleReset}
                aria-label={`Remove ${filter.label} filter`}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Card label="Orders" value={String(summary.orders_count)} />
        <Card label="Items" value={String(summary.items_count)} />
        <Card label="With Staff" value={String(summary.items_with_staff_count)} />
        <Card label="Without Staff" value={String(summary.items_without_staff_count)} />
        <Card label="Total Amount" value={money(Number(summary.total_item_amount))} />
        <Card label="Total Staff Commission" value={money(Number(summary.total_staff_commission))} />
        <Card label="My Commission" value={money(Number(summary.my_commission))} />
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Order No
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Order Date
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Product
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                Item Total
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Has Staff
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={7} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={7} />
            ) : (
              rows.map((row) => (
                <Fragment key={row.order_item_id}>
                  <tr>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.order_no ?? row.order_id}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      {new Date(row.order_date).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.product_name ?? '—'}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right">
                      {row.qty}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right">
                      RM {money(Number(row.item_total_price))}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.has_staff_assignment ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => setExpanded((prev) => ({ ...prev, [row.order_item_id]: !prev[row.order_item_id] }))}
                      >
                        {expanded[row.order_item_id] ? 'Hide splits' : 'View splits'}
                      </button>
                    </td>
                  </tr>
                  {expanded[row.order_item_id] && (
                    <tr className="bg-slate-50">
                      <td className="px-4 py-2 border border-gray-200" colSpan={7}>
                        {row.staff_splits.length === 0 ? (
                          <div className="text-gray-500">No staff splits.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="px-2 py-1 text-left">Staff</th>
                                  <th className="px-2 py-1 text-right">Share %</th>
                                  <th className="px-2 py-1 text-right">Rate Snapshot</th>
                                  <th className="px-2 py-1 text-right">Commission</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.staff_splits.map((split, idx) => (
                                  <tr key={`${row.order_item_id}-${split.staff_id}-${idx}`}>
                                    <td className="px-2 py-1">{split.staff_name ?? (split.staff_id ? `#${split.staff_id}` : '-')}</td>
                                    <td className="px-2 py-1 text-right">{split.share_percent}%</td>
                                    <td className="px-2 py-1 text-right">{(Number(split.commission_rate_snapshot) * 100).toFixed(2)}%</td>
                                    <td className="px-2 py-1 text-right">{money(Number(split.staff_commission_amount))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={lastPage}
        pageSize={perPage}
        onPageChange={(page) => {
          setCurrentPage(page)
          loadData(page).catch(() => {})
        }}
        disabled={loading}
      />
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
