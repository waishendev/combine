'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

type StaffOption = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
}

type SummaryRow = {
  staff_id: number
  staff_name: string
  commission_rate: number
  total_sales: number
  total_commission: number
  orders_count: number
  items_count: number
  free_items_count: number
  free_items_snapshot_total: number
  free_items_effective_total: number
}

type DetailRow = {
  order_no: string | null
  order_id: number
  order_date: string
  product_name: string | null
  qty: number
  item_net_amount: number
  item_snapshot_amount: number
  is_staff_free_applied: boolean
  share_percent: number
  staff_item_sales: number
  commission_rate: number
  staff_item_commission: number
}

const money = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

const formatDateTimeForTable = (dateString: string) => {
  if (!dateString) return { time: '—', date: '—' }
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return { time: '—', date: '—' }
  }
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const dateStr = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return { time, date: dateStr }
}

export default function StaffCommissionReportPage() {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [filterInputs, setFilterInputs] = useState({
    date_from: defaultRange.from,
    date_to: defaultRange.to,
    staff_id: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({
    date_from: defaultRange.from,
    date_to: defaultRange.to,
    staff_id: '',
  })
  const [staffSearch, setStaffSearch] = useState('')
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [grandTotalSales, setGrandTotalSales] = useState(0)
  const [grandTotalCommission, setGrandTotalCommission] = useState(0)
  const [freeItemsCount, setFreeItemsCount] = useState(0)
  const [freeItemsSnapshotTotal, setFreeItemsSnapshotTotal] = useState(0)
  const [freeItemsEffectiveTotal, setFreeItemsEffectiveTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailStaff, setDetailStaff] = useState<SummaryRow | null>(null)
  const [detailRows, setDetailRows] = useState<DetailRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const selectedStaff = useMemo(
    () => staffOptions.find((option) => option.id === Number(appliedFilters.staff_id)),
    [staffOptions, appliedFilters.staff_id],
  )

  const loadStaffOptions = async (query: string) => {
    const qs = new URLSearchParams()
    qs.set('per_page', '20')
    if (query.trim()) qs.set('search', query.trim())

    const res = await fetch(`/api/proxy/staffs?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) return

    const json = await res.json().catch(() => ({}))
    const list = Array.isArray(json?.data?.data) ? json.data.data : []
    const mapped: StaffOption[] = list.map((item: { id?: number; name?: string; email?: string | null; phone?: string | null; admin?: { email?: string | null } }) => ({
      id: Number(item.id),
      name: item.name ?? `Staff #${item.id}`,
      email: item.email ?? item.admin?.email ?? null,
      phone: item.phone ?? null,
    }))
    setStaffOptions(mapped)
  }

  const applyFilter = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        start_date: appliedFilters.date_from,
        end_date: appliedFilters.date_to,
      })
      if (appliedFilters.staff_id) qs.set('staff_id', appliedFilters.staff_id)

      const res = await fetch(`/api/proxy/ecommerce/reports/staff-commission?${qs.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        setRows([])
        setGrandTotalSales(0)
        setGrandTotalCommission(0)
        setFreeItemsCount(0)
        setFreeItemsSnapshotTotal(0)
        setFreeItemsEffectiveTotal(0)
        return
      }

      const json = await res.json().catch(() => ({}))
      setRows(Array.isArray(json?.rows) ? json.rows : [])
      setGrandTotalSales(Number(json?.grand_total_sales ?? 0))
      setGrandTotalCommission(Number(json?.grand_total_commission ?? 0))
      setFreeItemsCount(Number(json?.free_items_count ?? 0))
      setFreeItemsSnapshotTotal(Number(json?.free_items_snapshot_total ?? 0))
      setFreeItemsEffectiveTotal(Number(json?.free_items_effective_total ?? 0))
    } finally {
      setLoading(false)
    }
  }, [appliedFilters])

  useEffect(() => {
    loadStaffOptions('').catch(() => {})
  }, [])

  useEffect(() => {
    applyFilter().catch(() => {})
  }, [applyFilter])

  const handleApply = () => {
    setAppliedFilters({
      date_from: filterInputs.date_from || defaultRange.from,
      date_to: filterInputs.date_to || defaultRange.to,
      staff_id: filterInputs.staff_id,
    })
    setIsFilterOpen(false)
  }

  const handleReset = () => {
    setFilterInputs({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
      staff_id: '',
    })
    setAppliedFilters({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
      staff_id: '',
    })
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
    if (appliedFilters.staff_id && selectedStaff) {
      filters.push({
        key: 'staff',
        label: 'Staff',
        value: selectedStaff.name,
      })
    }
    return filters
  }, [showingRange, appliedFilters.staff_id, selectedStaff])

  const openDetails = async (row: SummaryRow) => {
    setDetailOpen(true)
    setDetailStaff(row)
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams({
        staff_id: String(row.staff_id),
        start_date: appliedFilters.date_from,
        end_date: appliedFilters.date_to,
        per_page: '100',
      })
      const res = await fetch(`/api/proxy/ecommerce/reports/staff-commission/detail?${qs.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        setDetailRows([])
        return
      }

      const json = await res.json().catch(() => ({}))
      setDetailRows(Array.isArray(json?.data) ? json.data : [])
    } finally {
      setDetailLoading(false)
    }
  }

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
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Staff (optional)</label>
                  <div className="flex gap-2">
                    <input
                      placeholder="Search name / phone / email"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="flex-1 h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                    />
                    <button
                      className="px-3 py-2 text-sm border border-slate-200 rounded hover:bg-gray-50"
                      onClick={() => loadStaffOptions(staffSearch)}
                    >
                      Search
                    </button>
                  </div>
                  <select
                    className="mt-2 h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                    value={filterInputs.staff_id}
                    onChange={(e) => setFilterInputs((prev) => ({ ...prev, staff_id: e.target.value }))}
                  >
                    <option value="">All staff</option>
                    {staffOptions.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}{staff.phone ? ` • ${staff.phone}` : ''}{staff.email ? ` • ${staff.email}` : ''}
                      </option>
                    ))}
                  </select>
                  {filterInputs.staff_id && selectedStaff && (
                    <p className="mt-1 text-xs text-gray-500">Selected: {selectedStaff.name}</p>
                  )}
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
                  } else if (filter.key === 'staff') {
                    setFilterInputs((prev) => ({ ...prev, staff_id: '' }))
                    setAppliedFilters((prev) => ({ ...prev, staff_id: '' }))
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Card label="Grand Total Sales" value={`RM ${money(grandTotalSales)}`} color="indigo" />
        <Card label="Grand Total Commission" value={`RM ${money(grandTotalCommission)}`} color="teal" />
        <Card label="Free Items Count" value={String(freeItemsCount)} color="orange" />
        <Card label="Free Items Value (Snapshot)" value={`RM ${money(freeItemsSnapshotTotal)}`} color="purple" />
        <Card label="Free Items Actual (Effective)" value={`RM ${money(freeItemsEffectiveTotal)}`} color="emerald" />
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Staff
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Commission Rate
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">
                Total Sales
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">
                Total Commission
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">
                Free Count
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">
                Free Snapshot
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">
                Free Effective
              </th>
              <th className="px-4 py-2 font-semibold text-center text-gray-600 tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={10} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={10} />
            ) : (
              rows.map((row) => (
                <tr key={row.staff_id}>
                  <td className="px-4 py-2 border border-gray-200 font-medium">
                    {row.staff_name}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">
                    {(Number(row.commission_rate) * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right">
                    RM {money(Number(row.total_sales))}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right">
                    RM {money(Number(row.total_commission))}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right">
                    {row.free_items_count}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right">
                    RM {money(Number(row.free_items_snapshot_total))}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right">
                    RM {money(Number(row.free_items_effective_total))}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-center">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700"
                      onClick={() => openDetails(row)}
                      aria-label={`View details for ${row.staff_name}`}
                    >
                      <i className="fa-solid fa-eye" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold">
              <td className="border border-gray-300 px-4 py-2 text-left" colSpan={2}>
                Grand Total
              </td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                RM {money(grandTotalSales)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                RM {money(grandTotalCommission)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                {freeItemsCount}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                RM {money(freeItemsSnapshotTotal)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                RM {money(freeItemsEffectiveTotal)}
              </td>
              <td className="border border-gray-300 px-4 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      {detailOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
            onClick={() => setDetailOpen(false)}
          />
          {/* Drawer - slides in from right, larger width */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-6xl bg-white shadow-2xl transition-transform duration-300 ease-out">
            <div className="flex h-full flex-col">
              {/* Header - Dark background */}
              <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-6 py-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400">
                    Staff Commission Details
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">
                    {detailStaff?.staff_name ?? '-'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Period: {showingRange}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                  onClick={() => setDetailOpen(false)}
                  aria-label="Close drawer"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {detailStaff && (
                  <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                      <p className="text-xs font-semibold text-blue-600">
                        Total Sales
                      </p>
                      <p className="mt-1 text-base font-bold text-blue-900">
                        RM {money(Number(detailStaff.total_sales))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-semibold text-emerald-600">
                        Total Commission
                      </p>
                      <p className="mt-1 text-base font-bold text-emerald-700">
                        RM {money(Number(detailStaff.total_commission))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
                      <p className="text-xs font-semibold text-purple-600">
                        Orders
                      </p>
                      <p className="mt-1 text-base font-bold text-purple-900">
                        {detailStaff.orders_count}
                      </p>
                    </div>
                    <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                      <p className="text-xs font-semibold text-orange-600">
                        Items
                      </p>
                      <p className="mt-1 text-base font-bold text-orange-900">
                        {detailStaff.items_count}
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-left text-gray-700">
                            Order No
                          </th>
                          <th className="px-4 py-2 font-semibold text-left text-gray-700">
                            Date
                          </th>
                          <th className="px-4 py-2 font-semibold text-left text-gray-700">
                            Product
                          </th>
                          <th className="px-4 py-2 font-semibold text-right text-gray-700">
                            Qty
                          </th>
                          <th className="px-4 py-2 font-semibold text-right text-gray-700">
                            Snapshot
                          </th>
                          <th className="px-4 py-2 font-semibold text-right text-gray-700">
                            Effective
                          </th>
                          <th className="px-4 py-2 font-semibold text-left text-gray-700">
                            Staff-Free
                          </th>
                          <th className="px-4 py-2 font-semibold text-right text-gray-700">
                            Share %
                          </th>
                          <th className="px-4 py-2 font-semibold text-right text-gray-700">
                            Rate
                          </th>
                          <th className="px-4 py-2 font-semibold text-right text-gray-700">
                            Commission
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailLoading ? (
                          <TableLoadingRow colSpan={10} />
                        ) : detailRows.length === 0 ? (
                          <TableEmptyState colSpan={10} />
                        ) : (
                          detailRows.map((row, index) => (
                            <tr key={`${row.order_id}-${index}`} className="border-t border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-2">
                                {row.order_no ?? row.order_id}
                              </td>
                              <td className="px-4 py-2">
                                {(() => {
                                  const { time, date } = formatDateTimeForTable(row.order_date)
                                  return (
                                    <div className="flex flex-col">
                                      <span className="text-xs font-medium text-gray-900">{time}</span>
                                      <span className="text-xs text-gray-500">{date}</span>
                                    </div>
                                  )
                                })()}
                              </td>
                              <td className="px-4 py-2">
                                {row.product_name ?? '—'}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {row.qty}
                              </td>
                              <td className="px-4 py-2 text-right">
                                RM {money(Number(row.item_snapshot_amount))}
                              </td>
                              <td className="px-4 py-2 text-right">
                                RM {money(Number(row.item_net_amount))}
                              </td>
                              <td className="px-4 py-2">
                                {row.is_staff_free_applied ? 'Yes' : 'No'}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {row.share_percent}%
                              </td>
                              <td className="px-4 py-2 text-right">
                                {(Number(row.commission_rate) * 100).toFixed(2)}%
                              </td>
                              <td className="px-4 py-2 text-right">
                                RM {money(Number(row.staff_item_commission))}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


function Card({ label, value, color = 'gray' }: { label: string; value: string; color?: string }) {
  const colorClasses = {
    blue: 'border-blue-100 bg-blue-50 text-blue-600',
    purple: 'border-purple-100 bg-purple-50 text-purple-600',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    orange: 'border-orange-100 bg-orange-50 text-orange-600',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-600',
    teal: 'border-teal-100 bg-teal-50 text-teal-600',
    pink: 'border-pink-100 bg-pink-50 text-pink-600',
    gray: 'border-gray-100 bg-gray-50 text-gray-600',
  }

  const valueColorClasses = {
    blue: 'text-blue-900',
    purple: 'text-purple-900',
    emerald: 'text-emerald-700',
    orange: 'text-orange-900',
    indigo: 'text-indigo-900',
    teal: 'text-teal-700',
    pink: 'text-pink-900',
    gray: 'text-gray-900',
  }

  const classes = colorClasses[color as keyof typeof colorClasses] || colorClasses.gray
  const valueClasses = valueColorClasses[color as keyof typeof valueColorClasses] || valueColorClasses.gray

  return (
    <div className={`rounded-xl border ${classes} px-4 py-3 shadow-sm`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className={`mt-1 text-lg font-bold ${valueClasses}`}>{value}</p>
    </div>
  )
}
