'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import OfflineOrderActions from './reports/OfflineOrderActions'

type Summary = {
  orders_count: number
  items_count: number
  items_with_staff_count: number
  items_without_staff_count: number
  total_item_amount: number
  total_staff_commission: number
  my_commission: number
  free_items_count: number
  free_items_snapshot_total: number
  free_items_effective_total: number
}

type StaffOption = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
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
  created_by_user_id: number | null
  created_by_name: string | null
  created_by_phone: string | null
  created_by_email: string | null
  order_item_id: number
  item_type?: 'product' | 'service_package' | 'booking_deposit' | 'final_settlement' | 'booking_settlement' | 'settlement_services'
  product_name: string | null
  qty: number
  item_total_price: number
  item_snapshot_total: number
  is_staff_free_applied: boolean
  has_staff_assignment: boolean
  staff_splits: StaffSplit[]
}

const normalizeItemType = (itemType?: string | null) => String(itemType ?? '').trim().toLowerCase()
const isBookingDepositType = (itemType?: string | null) => {
  const type = normalizeItemType(itemType)
  return type === 'booking_deposit' || type === 'deposit'
}
const isFinalSettlementType = (itemType?: string | null) => {
  const type = normalizeItemType(itemType)
  return type === 'final_settlement' || type === 'booking_settlement' || type === 'settlement_services' || type === 'settlement_service'
}
const isBookingRelatedType = (itemType?: string | null) => isBookingDepositType(itemType) || isFinalSettlementType(itemType)
const getItemTypeLabel = (itemType?: string | null) => {
  const type = normalizeItemType(itemType)
  if (type === 'service_package') return 'Service Package'
  if (isBookingDepositType(type)) return 'Booking Deposit'
  if (isFinalSettlementType(type)) return 'Final Settlement'
  return 'Product'
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

const getStaffDropdownPrimary = (staff: StaffOption) => {
  if (staff.phone) {
    return `${staff.name} (${staff.phone})`
  }

  return staff.name
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
  free_items_count: 0,
  free_items_snapshot_total: 0,
  free_items_effective_total: 0,
}

type MyPosSummaryPageProps = {
  reportPath?: string
  initialCreatedByUserId?: string
  initialHandledByName?: string
}

export default function MyPosSummaryPage({
  reportPath = '/api/proxy/ecommerce/reports/my-pos-summary',
  initialCreatedByUserId = '',
  initialHandledByName = '',
}: MyPosSummaryPageProps) {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [filterInputs, setFilterInputs] = useState({
    date_from: defaultRange.from,
    date_to: defaultRange.to,
    created_by_user_id: initialCreatedByUserId,
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
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<DetailRow | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE)
  const [createdByUserIdFilter, setCreatedByUserIdFilter] = useState(initialCreatedByUserId)
  const [handledByName, setHandledByName] = useState(initialHandledByName)
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [staffLookupLoading, setStaffLookupLoading] = useState(false)
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false)
  const [staffLookupQuery, setStaffLookupQuery] = useState(initialHandledByName)

  const loadStaffOptions = useCallback(async () => {
    setStaffLookupLoading(true)
    try {
      const res = await fetch('/api/proxy/staffs?page=1&per_page=50', { cache: 'no-store' })
      if (!res.ok) return

      const json = await res.json().catch(() => ({}))
      const list: unknown[] = Array.isArray(json?.data?.data) ? json.data.data : []
      type StaffApiRow = {
        id?: number
        name?: string
        phone?: string | null
        email?: string | null
        admin?: { email?: string | null }
      }
      const mapped: StaffOption[] = list
        .map((item: unknown): StaffOption => {
          const rec = item as StaffApiRow
          return {
            id: Number(rec.id),
            name: rec.name ?? `Staff #${rec.id}`,
            phone: rec.phone ?? null,
            email: rec.email ?? rec.admin?.email ?? null,
          }
        })
        .filter((item) => Number.isFinite(item.id))

      setStaffOptions(mapped)

      if (createdByUserIdFilter) {
        const selected = mapped.find((item) => String(item.id) === createdByUserIdFilter)
        if (selected) {
          setHandledByName(selected.name)
          setStaffLookupQuery(getStaffDropdownPrimary(selected))
        }
      }
    } finally {
      setStaffLookupLoading(false)
    }
  }, [createdByUserIdFilter])

  const loadData = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        start_date: appliedFilters.date_from,
        end_date: appliedFilters.date_to,
        page: String(page),
        per_page: String(perPage),
      })
      if (createdByUserIdFilter) {
        qs.set('created_by_user_id', createdByUserIdFilter)
      }

      const res = await fetch(`${reportPath}?${qs.toString()}`, {
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
  }, [appliedFilters.date_from, appliedFilters.date_to, perPage, reportPath, createdByUserIdFilter])

  useEffect(() => {
    loadData(1).catch(() => {})
  }, [loadData])

  useEffect(() => {
    loadStaffOptions().catch(() => {})
  }, [loadStaffOptions])

  const handleApply = () => {
    setAppliedFilters({
      date_from: filterInputs.date_from || defaultRange.from,
      date_to: filterInputs.date_to || defaultRange.to,
    })
    setCreatedByUserIdFilter(filterInputs.created_by_user_id)
    setCurrentPage(1)
    setIsFilterOpen(false)
    setStaffDropdownOpen(false)
  }

  const handleReset = () => {
    setFilterInputs({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
      created_by_user_id: '',
    })
    setAppliedFilters({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
    })
    setCreatedByUserIdFilter('')
    setHandledByName('')
    setStaffLookupQuery('')
    setCurrentPage(1)
    setIsFilterOpen(false)
    setStaffDropdownOpen(false)
  }

  const showingRange = `${formatDisplayDate(appliedFilters.date_from)} – ${formatDisplayDate(
    appliedFilters.date_to,
  )}`

  const filteredStaffOptions = useMemo(() => {
    const query = staffLookupQuery.trim().toLowerCase()
    if (!query) return staffOptions

    return staffOptions.filter((staff) =>
      [staff.name, staff.phone ?? '', staff.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [staffLookupQuery, staffOptions])

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = []
    filters.push({
      key: 'date_range',
      label: 'Date Range',
      value: showingRange,
    })

    if (createdByUserIdFilter) {
      filters.push({
        key: 'handled_by',
        label: 'Handled by',
        value: handledByName || `User #${createdByUserIdFilter}`,
      })
    }

    return filters
  }, [showingRange, createdByUserIdFilter, handledByName])

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
                <div className="sm:col-span-2 relative flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Handled By (optional)</label>
                  <input
                    value={staffLookupQuery}
                    onFocus={() => setStaffDropdownOpen(true)}
                    onChange={(event) => {
                      setStaffLookupQuery(event.target.value)
                      setStaffDropdownOpen(true)
                      setFilterInputs((prev) => ({ ...prev, created_by_user_id: '' }))
                      setHandledByName('')
                    }}
                    placeholder="Search name / phone / email"
                    className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                  />
                  {staffDropdownOpen && (
                    <div className="absolute z-20 mt-[68px] max-h-64 w-full overflow-auto rounded border border-slate-200 bg-white shadow-xl">
                      {staffLookupLoading ? (
                        <p className="px-3 py-2 text-xs text-gray-500">Loading staff...</p>
                      ) : filteredStaffOptions.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-500">No staff found.</p>
                      ) : (
                        filteredStaffOptions.map((staff) => (
                          <button
                            key={staff.id}
                            type="button"
                            className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              setFilterInputs((prev) => ({ ...prev, created_by_user_id: String(staff.id) }))
                              setHandledByName(staff.name)
                              setStaffLookupQuery(getStaffDropdownPrimary(staff))
                              setStaffDropdownOpen(false)
                            }}
                          >
                            <p className="text-sm font-semibold text-slate-900">{getStaffDropdownPrimary(staff)}</p>
                            <p className="text-xs text-slate-600">{staff.email || '—'}</p>
                          </button>
                        ))
                      )}
                    </div>
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
            onClick={() => {
              setFilterInputs((prev) => ({ ...prev, created_by_user_id: createdByUserIdFilter }))
              setStaffLookupQuery(handledByName || '')
              setIsFilterOpen(true)
            }}
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
                onClick={() => {
                  if (filter.key === 'date_range') {
                    handleReset()
                    return
                  }

                  if (filter.key === 'handled_by') {
                    setCreatedByUserIdFilter('')
                    setHandledByName('')
                    setStaffLookupQuery('')
                    setFilterInputs((prev) => ({ ...prev, created_by_user_id: '' }))
                    setCurrentPage(1)
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
        <Card label="Orders" value={String(summary.orders_count)} color="blue" />
        <Card label="Items" value={String(summary.items_count)} color="purple" />
        <Card label="With Staff (items)" value={String(summary.items_with_staff_count)} color="emerald" />
        <Card label="Without Staff (items)" value={String(summary.items_without_staff_count)} color="orange" />
        <Card label="Total Amount" value={money(Number(summary.total_item_amount))} color="indigo" />
        <Card label="Total Staff Commission" value={money(Number(summary.total_staff_commission))} color="teal" />
        <Card label="Free Items Count" value={String(summary.free_items_count)} color="orange" />
        <Card label="Free Items Value (Snapshot)" value={money(Number(summary.free_items_snapshot_total))} color="pink" />
        <Card label="Free Items Actual (Effective)" value={money(Number(summary.free_items_effective_total))} color="emerald" />
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Order No
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Order Date
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Product
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Handled By
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">
                Qty
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">
                Snapshot
              </th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">
                Effective
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Staff-Free
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Has Assign
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
                <Fragment key={`${row.item_type ?? 'product'}-${row.order_item_id}`}>
                  <tr>
                    <td className="px-4 py-2 border border-gray-200 font-medium">
                      {row.order_no ?? row.order_id}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
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
                    <td className="px-4 py-2 border border-gray-200">
                      <p className="font-medium text-slate-900">{row.product_name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{getItemTypeLabel(row.item_type)}</p>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <p className="font-medium text-slate-900">
                        {row.created_by_name ?? (row.created_by_user_id ? `User #${row.created_by_user_id}` : '—')}{row.created_by_phone ? ` (${row.created_by_phone})` : ''}
                      </p>
                      <p className="text-xs text-slate-500">{row.created_by_email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right">
                      {row.qty}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right">
                      RM {money(Number(row.item_snapshot_total))}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right">
                      RM {money(Number(row.item_total_price))}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.is_staff_free_applied ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.has_staff_assignment ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700"
                          onClick={() => {
                            setSelectedRow(row)
                            setDetailOpen(true)
                          }}
                          aria-label={`View details for ${row.order_no ?? row.order_id}`}
                        >
                          <i className="fa-solid fa-eye" />
                        </button>
                        <OfflineOrderActions
                          orderId={row.order_id}
                          channel="offline"
                          staffActionLabel={isFinalSettlementType(row.item_type) ? 'worker' : 'sales_person'}
                          hideStaffAction={isBookingDepositType(row.item_type)}
                          onDone={() => {
                            void loadData(currentPage)
                          }}
                        />
                      </div>
                    </td>
                  </tr>
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

      {detailOpen && selectedRow && (
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
                    ORDER NO
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-white">
                    {selectedRow.order_no ?? `Order #${selectedRow.order_id}`}
                  </h3>
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
                {/* Order Information Section */}
                <div className="mb-6 space-y-4">
                  <div>
                    <h4 className="mb-1 text-sm font-semibold text-gray-700">Order Information</h4>
                    <div className="mb-4 text-sm font-medium text-gray-700">
                      {(() => {
                        const { time, date } = formatDateTimeForTable(selectedRow.order_date)
                        return `${date} ${time}`
                      })()}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <p className="text-xs font-semibold text-blue-600">
                          Item
                        </p>
                        <p className="mt-1 text-base font-bold text-blue-900">
                          {selectedRow.product_name ?? '—'}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase text-blue-600">
                          {getItemTypeLabel(selectedRow.item_type)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-semibold text-emerald-600">
                          Quantity
                        </p>
                        <p className="mt-1 text-base font-bold text-emerald-700">
                          {selectedRow.qty}
                        </p>
                      </div>
                      <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
                        <p className="text-xs font-semibold text-purple-600">
                          Snapshot Value
                        </p>
                        <p className="mt-1 text-base font-bold text-purple-900">
                          RM {money(Number(selectedRow.item_snapshot_total))}
                        </p>
                      </div>
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                        <p className="text-xs font-semibold text-indigo-600">
                          Effective Value
                        </p>
                        <p className="mt-1 text-base font-bold text-indigo-900">
                          RM {money(Number(selectedRow.item_total_price))}
                        </p>
                      </div>
                      <div className="rounded-xl border border-pink-100 bg-pink-50 px-4 py-3">
                        <p className="text-xs font-semibold text-pink-600">
                          Staff-Free
                        </p>
                        <p className="mt-1 text-base font-bold text-pink-900">
                          {selectedRow.is_staff_free_applied ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                        <p className="text-xs font-semibold text-orange-600">
                          Has Assign
                        </p>
                        <p className="mt-1 text-base font-bold text-orange-900">
                          {selectedRow.has_staff_assignment ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Staff Splits Section - Outside border */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700">{isBookingRelatedType(selectedRow.item_type) ? 'Assigned Staff' : 'Staff Splits'}</h4>
                  {selectedRow.staff_splits.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-500">
                      {isBookingRelatedType(selectedRow.item_type) ? 'No worker assignment.' : 'No staff splits.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                      <table className="min-w-full text-xs sm:text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 font-semibold text-left text-gray-700">
                              {isBookingRelatedType(selectedRow.item_type) ? 'Worker' : 'Staff'}
                            </th>
                            <th className="px-4 py-2 font-semibold text-right text-gray-700">
                              Share %
                            </th>
                            <th className="px-4 py-2 font-semibold text-right text-gray-700">
                              Rate Snapshot
                            </th>
                            <th className="px-4 py-2 font-semibold text-right text-gray-700">
                              Commission
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRow.staff_splits.map((split, idx) => (
                            <tr key={`${selectedRow.order_item_id}-${split.staff_id}-${idx}`} className="border-t border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-2">
                                {split.staff_name ?? (split.staff_id ? `#${split.staff_id}` : '-')}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {split.share_percent}%
                              </td>
                              <td className="px-4 py-2 text-right">
                                {(Number(split.commission_rate_snapshot) * 100).toFixed(2)}%
                              </td>
                              <td className="px-4 py-2 text-right">
                                RM {money(Number(split.staff_commission_amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
