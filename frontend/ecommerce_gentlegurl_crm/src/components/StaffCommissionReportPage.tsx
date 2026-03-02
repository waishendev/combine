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
}

type DetailRow = {
  order_no: string | null
  order_id: number
  order_date: string
  product_name: string | null
  qty: number
  item_net_amount: number
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
        return
      }

      const json = await res.json().catch(() => ({}))
      setRows(Array.isArray(json?.rows) ? json.rows : [])
      setGrandTotalSales(Number(json?.grand_total_sales ?? 0))
      setGrandTotalCommission(Number(json?.grand_total_commission ?? 0))
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

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Staff
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Commission Rate
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                Total Sales
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                Total Commission
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                Orders Count
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                Items Count
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
                    {row.orders_count}
                  </td>
                  <td className="px-4 py-2 border border-gray-200 text-right">
                    {row.items_count}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">
                    <button
                      className="text-blue-600 hover:text-blue-800"
                      onClick={() => openDetails(row)}
                    >
                      View details
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
              <td className="border border-gray-300 px-4 py-2" colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-lg font-semibold">Details — {detailStaff?.staff_name ?? '-'}</h3>
              <button
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                onClick={() => setDetailOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto">
              <table className="min-w-full text-sm">
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
                      Item Net
                    </th>
                    <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                      Share %
                    </th>
                    <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                      Staff Item Sales
                    </th>
                    <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-4 py-2 font-semibold text-right text-gray-600 uppercase tracking-wider">
                      Staff Item Commission
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <TableLoadingRow colSpan={9} />
                  ) : detailRows.length === 0 ? (
                    <TableEmptyState colSpan={9} />
                  ) : (
                    detailRows.map((row, index) => (
                      <tr key={`${row.order_id}-${index}`}>
                        <td className="px-4 py-2 border border-gray-200">
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
                          RM {money(Number(row.item_net_amount))}
                        </td>
                        <td className="px-4 py-2 border border-gray-200 text-right">
                          {row.share_percent}%
                        </td>
                        <td className="px-4 py-2 border border-gray-200 text-right">
                          RM {money(Number(row.staff_item_sales))}
                        </td>
                        <td className="px-4 py-2 border border-gray-200 text-right">
                          {(Number(row.commission_rate) * 100).toFixed(2)}%
                        </td>
                        <td className="px-4 py-2 border border-gray-200 text-right">
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
      )}
    </div>
  )
}
